// Onboarding Agent Command
// Guides client from zero to first rendered video artifact with green QA.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { stdin as defaultInput, stdout as defaultOutput } from 'node:process';
import { checkBinary, findSystemFont, run as studioRun } from './studio.js';
import { validateEditPlan } from '../roles/mediaProducer.js';

export function getFfmpegInstallInstructions(platform = process.platform) {
  if (platform === 'win32') {
    return 'winget install Gyan.FFmpeg (or: choco install ffmpeg)';
  }
  if (platform === 'darwin') {
    return 'brew install ffmpeg';
  }
  return 'sudo apt install ffmpeg (Debian/Ubuntu) or your package manager';
}

export function detectEnvironment() {
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor < 18) {
    throw new Error(`Node.js >= 18 is required (current: ${process.versions.node}). Please upgrade Node.js.`);
  }

  const hasFfmpeg = checkBinary('ffmpeg');
  const hasFfprobe = checkBinary('ffprobe');
  if (!hasFfmpeg || !hasFfprobe) {
    const missing = [!hasFfmpeg && 'ffmpeg', !hasFfprobe && 'ffprobe'].filter(Boolean).join(' and ');
    throw new Error(
      `${missing} is not installed or not found on PATH.\nTo install ffmpeg on ${process.platform}:\n  ${getFfmpegInstallInstructions()}`
    );
  }

  const font = findSystemFont();
  return { nodeVersion: process.versions.node, ffmpeg: true, font };
}

export function loadProfile(dir) {
  if (!dir) return null;
  const uskFile = path.join(dir, '.universal-skill', 'profile.json');
  if (fs.existsSync(uskFile)) {
    try {
      return JSON.parse(fs.readFileSync(uskFile, 'utf8'));
    } catch {}
  }
  const studioFile = path.join(dir, 'studio.json');
  if (fs.existsSync(studioFile)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(studioFile, 'utf8'));
      if (manifest.profile) return manifest.profile;
    } catch {}
  }
  return null;
}

export function saveProfile(targetDir, profileData) {
  const uskDir = path.join(targetDir, '.universal-skill');
  fs.mkdirSync(uskDir, { recursive: true });
  fs.writeFileSync(path.join(uskDir, 'profile.json'), JSON.stringify(profileData, null, 2) + '\n');

  const studioFile = path.join(targetDir, 'studio.json');
  if (fs.existsSync(studioFile)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(studioFile, 'utf8'));
      manifest.profile = profileData;
      fs.writeFileSync(studioFile, JSON.stringify(manifest, null, 2) + '\n');
    } catch {}
  }
}

// ponytail: minimal 2-clip / text templates; upgrade when interactive storyboard editing or custom caption styling is needed.
export function buildOnboardPlan({ mode, assets = [] }) {
  if (mode === 'dark') {
    return {
      schema_version: 1,
      mode: 'dark',
      clips: [
        {
          kind: 'text',
          text: 'Universal Skill Onboarding',
          duration_ms: 1000,
          timeline_start_ms: 0,
        },
        {
          kind: 'text',
          text: 'Autonomous Video Pipeline Ready',
          duration_ms: 1000,
          timeline_start_ms: 1000,
        },
      ],
      output: {
        width: 1080,
        height: 1920,
        fps_num: 30,
        fps_den: 1,
        video_codec: 'h264',
        audio_codec: 'aac',
      },
    };
  }

  if (mode === 'edit_only') {
    if (!assets || assets.length === 0) {
      throw new Error('edit_only mode requires at least one imported asset');
    }
    let clips = [];
    if (assets.length === 1) {
      const a = assets[0];
      const durMs = Math.max(200, Math.floor((a.metadata?.duration_s || 2) * 1000));
      const midMs = Math.max(100, Math.floor(durMs / 2));
      clips = [
        {
          kind: 'video',
          asset_id: a.id,
          clip_id: 'c1',
          in_ms: 0,
          out_ms: midMs,
          timeline_start_ms: 0,
          speed: 1,
        },
        {
          kind: 'video',
          asset_id: a.id,
          clip_id: 'c2',
          in_ms: midMs,
          out_ms: durMs,
          timeline_start_ms: midMs,
          speed: 1,
        },
      ];
    } else {
      const a0 = assets[0];
      const a1 = assets[1];
      const dur0 = Math.max(100, Math.floor((a0.metadata?.duration_s || 1) * 1000));
      const dur1 = Math.max(100, Math.floor((a1.metadata?.duration_s || 1) * 1000));
      const len0 = Math.min(dur0, 1000);
      const len1 = Math.min(dur1, 1000);
      clips = [
        {
          kind: 'video',
          asset_id: a0.id,
          clip_id: 'c1',
          in_ms: 0,
          out_ms: len0,
          timeline_start_ms: 0,
          speed: 1,
        },
        {
          kind: 'video',
          asset_id: a1.id,
          clip_id: 'c2',
          in_ms: 0,
          out_ms: len1,
          timeline_start_ms: len0,
          speed: 1,
        },
      ];
    }
    return {
      schema_version: 1,
      mode: 'edit_only',
      clips,
      audio_tracks: [
        { kind: 'source', clip_id: 'c1', gain_db: 0 },
        { kind: 'source', clip_id: 'c2', gain_db: 0 },
      ],
      output: {
        width: 1080,
        height: 1920,
        fps_num: 30,
        fps_den: 1,
        video_codec: 'h264',
        audio_codec: 'aac',
      },
    };
  }

  if (mode === 'podcast_clip') {
    if (!assets || assets.length === 0) {
      throw new Error('podcast_clip mode requires at least one imported asset');
    }
    let currentTimeline = 0;
    const clips = [];
    const audioTracks = [];
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const dur = Math.max(100, Math.floor((a.metadata?.duration_s || 1) * 1000));
      const len = Math.min(dur, 1000);
      const clipId = `c${i + 1}`;
      clips.push({
        kind: 'video',
        asset_id: a.id,
        clip_id: clipId,
        in_ms: 0,
        out_ms: len,
        timeline_start_ms: currentTimeline,
        speed: 1,
      });
      audioTracks.push({
        kind: 'source',
        clip_id: clipId,
        gain_db: 0,
      });
      currentTimeline += len;
    }
    return {
      schema_version: 1,
      mode: 'podcast_clip',
      clips,
      audio_tracks: audioTracks,
      captions: [
        {
          text: 'Universal Podcast Clip',
          timeline_start_ms: 0,
          duration_ms: Math.min(currentTimeline, 1000),
        },
      ],
      output: {
        width: 1080,
        height: 1920,
        fps_num: 30,
        fps_den: 1,
        video_codec: 'h264',
        audio_codec: 'aac',
      },
    };
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

async function runSilentIfJson(isJson, fn) {
  if (!isJson) return await fn();
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
  }
}

export async function run({ positionals = [], flags = {}, io = {} } = {}) {
  if (flags.help || positionals[0] === 'help') {
    console.log(`Universal Skill Onboard Agent

Usage:
  universal-skill onboard [options]

Guided onboarding agent that takes a client from zero to their first rendered video.

Options:
  --mode <mode>     Video mode: dark | edit_only | podcast_clip
  --dest <path>     Workspace destination directory (defaults to cwd or saved profile)
  --file <path>     Media file to import for edit_only or podcast_clip (can repeat)
  --json            Output results in JSON format
  -h, --help        Show help message`);
    return;
  }

  // 1. Environment Detection
  let env;
  try {
    env = detectEnvironment();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  if (!flags.json) {
    console.log(`Universal Skill Onboarding Agent`);
    console.log(`- Node: ${env.nodeVersion}`);
    console.log(`- FFmpeg & FFprobe: available`);
    if (env.font) {
      console.log(`- System font: ${path.basename(env.font)}`);
    } else {
      console.log(`- System font: none detected (ffmpeg fallback font will be used)`);
    }
  }

  let rl = null;
  const getRl = () => {
    if (!rl) {
      rl = readline.createInterface({
        input: io.input || defaultInput,
        output: flags.json ? undefined : (io.output || defaultOutput),
      });
    }
    return rl;
  };

  const ask = async (promptMsg, defaultVal = '') => {
    const promptStr = defaultVal ? `${promptMsg} [${defaultVal}]: ` : `${promptMsg}: `;
    const r = getRl();
    const answer = (await r.question(promptStr)).trim();
    return answer || defaultVal;
  };

  const canPrompt = Boolean(io.input || process.stdin.isTTY || process.env.UNIVERSAL_SKILL_INTERACTIVE);

  try {
    // 2. Directory Resolution
    let targetDir = flags.dest || positionals[0];
    const cwdProfile = loadProfile(process.cwd());

    if (!targetDir && cwdProfile?.default_dir) {
      targetDir = cwdProfile.default_dir;
    }

    if (!targetDir) {
      if (!flags.mode && canPrompt) {
        targetDir = await ask('Working directory', process.cwd());
      } else {
        targetDir = process.cwd();
      }
    }
    targetDir = path.resolve(targetDir);

    const wsProfile = loadProfile(targetDir);
    const activeProfile = wsProfile || cwdProfile;

    // 3. Mode Resolution
    let mode = flags.mode;
    if (!mode && activeProfile?.preferred_mode) {
      mode = activeProfile.preferred_mode;
    }

    if (!mode) {
      if (canPrompt) {
        mode = await ask('Select mode (dark / edit_only / podcast_clip)', 'dark');
      } else {
        throw new Error('Non-interactive run requires --mode flag (edit_only, dark, podcast_clip)');
      }
    }

    mode = mode.toLowerCase().trim();
    if (!['dark', 'edit_only', 'podcast_clip'].includes(mode)) {
      throw new Error(`Invalid mode '${mode}'. Expected: dark, edit_only, or podcast_clip.`);
    }

    // 4. Media Files Resolution
    let files = [];
    if (flags.file) {
      const raw = Array.isArray(flags.file) ? flags.file : [flags.file];
      files = raw.flatMap((f) => f.split(',')).map((f) => f.trim()).filter(Boolean);
    }

    if (mode !== 'dark' && files.length === 0) {
      let existingAssets = [];
      const manifestPath = path.join(targetDir, 'studio.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          existingAssets = m.assets || [];
        } catch {}
      }

      if (existingAssets.length === 0) {
        if (canPrompt) {
          const ans = await ask('Enter media file path(s) (comma-separated)');
          files = ans.split(',').map((s) => s.trim()).filter(Boolean);
        }
        if (files.length === 0) {
          throw new Error(`Mode '${mode}' requires at least one media file.`);
        }
      }
    }

    for (const f of files) {
      if (!fs.existsSync(path.resolve(f))) {
        throw new Error(`Media file not found: ${f}`);
      }
    }

    if (rl) {
      rl.close();
      rl = null;
    }

    // 5. Execution Pipeline
    if (!flags.json) console.log(`\n[1/4] Initializing studio workspace at ${targetDir}...`);
    await runSilentIfJson(flags.json, () => studioRun({ positionals: ['init'], flags: { dest: targetDir, json: false } }));

    if (!flags.json) console.log(`[2/4] Importing media assets...`);
    const importedAssets = [];
    for (const f of files) {
      const asset = await runSilentIfJson(flags.json, () => studioRun({ positionals: ['import', path.resolve(f)], flags: { dest: targetDir, json: false } }));
      if (asset) importedAssets.push(asset);
    }

    if (importedAssets.length === 0 && mode !== 'dark') {
      const manifestPath = path.join(targetDir, 'studio.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          importedAssets.push(...(m.assets || []));
        } catch {}
      }
    }

    const plan = buildOnboardPlan({ mode, assets: importedAssets });
    validateEditPlan(plan);

    const packagesDir = path.join(targetDir, 'packages');
    fs.mkdirSync(packagesDir, { recursive: true });
    const planPath = path.join(packagesDir, 'onboard-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');

    if (!flags.json) console.log(`[3/4] Rendering video artifact (${mode} mode)...`);
    const artifact = await runSilentIfJson(flags.json, () => studioRun({ positionals: ['render', planPath], flags: { dest: targetDir, json: false } }));
    if (!artifact || !artifact.path) {
      throw new Error('Failed to render video artifact');
    }

    const artifactFullPath = path.resolve(targetDir, artifact.path);

    if (!flags.json) console.log(`[4/4] Running automated QA verification...`);
    const qaReport = await runSilentIfJson(flags.json, () => studioRun({ positionals: ['qa', artifactFullPath], flags: { dest: targetDir, json: false } }));
    if (!qaReport || !qaReport.passed) {
      throw new Error(`QA verification failed: ${qaReport?.errors?.join(', ') || 'QA check failed'}`);
    }

    // 6. Persist Profile
    const profileData = {
      default_dir: targetDir,
      preferred_mode: mode,
      updated_at: new Date().toISOString(),
    };
    saveProfile(targetDir, profileData);

    // 7. Delivery
    if (flags.json) {
      console.log(JSON.stringify({
        status: 'ok',
        workspace: targetDir,
        mode,
        artifact,
        qa: qaReport,
        profile: profileData,
        next_steps: [
          `universal-skill studio render ${path.relative(process.cwd(), planPath).replace(/\\/g, '/')}`,
          `universal-skill studio qa ${path.relative(process.cwd(), artifactFullPath).replace(/\\/g, '/')}`,
        ],
      }, null, 2));
      return;
    }

    console.log(`
=================================================================
  Universal Skill Onboarding Complete!
=================================================================
Final Video Artifact:
  Path: ${artifactFullPath}
  ID:   ${artifact.id}
  Size: ${artifact.size_bytes} bytes

QA Verification: PASSED
  Resolution: ${qaReport.streams?.video?.width || '?'}x${qaReport.streams?.video?.height || '?'} (${qaReport.streams?.video?.codec || '?'})
  Audio:      ${qaReport.streams?.audio?.codec || '?'} (${qaReport.streams?.audio?.channels || '?'}ch @ ${qaReport.streams?.audio?.sample_rate || '?'}Hz)
  Duration:   ${qaReport.duration_s?.toFixed(2) || '?'}s

Profile Saved:
  Workspace:      ${targetDir}
  Preferred Mode: ${mode}

Next Commands:
  Render new cuts: universal-skill studio render <plan.json>
  Import footage:  universal-skill studio import <file.mp4>
  Verify QA:       universal-skill studio qa <file.mp4>
=================================================================
`);
    return { status: 'ok', artifact, qa: qaReport, profile: profileData };
  } catch (err) {
    if (rl) {
      try { rl.close(); } catch {}
    }
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export default run;

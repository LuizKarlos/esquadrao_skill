// Video Studio Execution Slice
// Minimal self-contained local video pipeline with zero npm dependencies.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import process from 'node:process';
import { validateEditPlan } from '../roles/mediaProducer.js';

export function checkBinary(name) {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function findWorkspaceDir(customDest) {
  if (customDest) return path.resolve(customDest);
  let cur = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(cur, 'studio.json'))) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

export function findSystemFont() {
  if (process.platform === 'win32') {
    const winDir = process.env.WINDIR || 'C:\\Windows';
    for (const name of ['arial.ttf', 'segoeui.ttf', 'calibri.ttf']) {
      const p = path.join(winDir, 'Fonts', name);
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === 'darwin') {
    for (const p of ['/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf']) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    for (const p of [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    ]) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

export function probeMedia(filePath) {
  if (!checkBinary('ffprobe')) {
    throw new Error('ffprobe is not installed or not found on PATH. Install ffmpeg to use video studio features.');
  }
  const stdout = execFileSync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

export function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { version: 1, name: 'universal-studio', assets: [], artifacts: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`Error: Corrupted studio manifest at ${manifestPath}: ${err.message}`);
    process.exit(1);
  }
}

export function saveManifestAtomic(manifestPath, manifest) {
  const dir = path.dirname(manifestPath);
  const tmpPath = path.join(dir, `.studio.json.tmp-${crypto.randomBytes(4).toString('hex')}`);
  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, manifestPath);
}

export function resolveAsset(workspaceDir, clip) {
  const candidate = clip.asset_id || clip.file || clip.path || clip.source;
  if (!candidate) {
    throw new Error('Clip is missing asset reference (expected asset_id, file, or path)');
  }
  if (fs.existsSync(candidate)) return path.resolve(candidate);
  const fromWs = path.join(workspaceDir, candidate);
  if (fs.existsSync(fromWs)) return fromWs;
  const inAssets = path.join(workspaceDir, 'assets', candidate);
  if (fs.existsSync(inAssets)) return inAssets;

  const manifestPath = path.join(workspaceDir, 'studio.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = loadManifest(manifestPath);
    const found = manifest.assets?.find((a) => a.id === candidate || a.name === candidate);
    if (found?.path) {
      const p = path.resolve(workspaceDir, found.path);
      if (fs.existsSync(p)) return p;
    }
  }

  const assetsDir = path.join(workspaceDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const match = files.find((f) => f.startsWith(candidate));
    if (match) return path.join(assetsDir, match);
  }

  throw new Error(`Asset '${candidate}' not found in workspace assets`);
}

export function createDrawtextFilter(text, fontOpt, startSec, endSec, yExpr, tempFiles) {
  const tmpFile = path.join(os.tmpdir(), `usk-cap-${crypto.randomBytes(6).toString('hex')}.txt`);
  fs.writeFileSync(tmpFile, text, 'utf8');
  tempFiles.push(tmpFile);
  const escapedPath = tmpFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  return `drawtext=textfile='${escapedPath}':expansion=none${fontOpt}:fontcolor=white:fontsize=48:x=(w-text_w)/2:y=${yExpr}:enable='between(t\\,${startSec}\\,${endSec})'`;
}

export function buildDarkTextFilters(clips, tempFiles) {
  const font = findSystemFont();
  const fontOpt = font ? `:fontfile='${font.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
  return clips.map((c) => {
    const start = ((c.timeline_start_ms || 0) / 1000).toFixed(3);
    const end = (((c.timeline_start_ms || 0) + c.duration_ms) / 1000).toFixed(3);
    return createDrawtextFilter(c.text, fontOpt, start, end, '(h-text_h)/2', tempFiles);
  }).join(',');
}

export function buildCaptionFilters(captions, baseV, tempFiles) {
  if (!captions || captions.length === 0) {
    return `${baseV}null[outv]`;
  }
  const font = findSystemFont();
  const fontOpt = font ? `:fontfile='${font.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
  const textFilters = captions.map((c) => {
    const start = ((c.timeline_start_ms || 0) / 1000).toFixed(3);
    const end = (((c.timeline_start_ms || 0) + (c.duration_ms || 1000)) / 1000).toFixed(3);
    return createDrawtextFilter(c.text, fontOpt, start, end, 'h-200', tempFiles);
  }).join(',');
  return `${baseV}${textFilters}[outv]`;
}

export function buildClipFilters(inputIndex, clip, clipPath, wsDir, width, height, gainDb = 0) {
  const inSec = ((clip.in_ms || 0) / 1000).toFixed(3);
  const outSec = ((clip.out_ms || (clip.in_ms || 0) + 1000) / 1000).toFixed(3);
  const durSec = Math.max(0.001, ((clip.out_ms || (clip.in_ms || 0) + 1000) - (clip.in_ms || 0)) / 1000).toFixed(3);

  const vFilter = `[${inputIndex}:v]trim=start=${inSec}:end=${outSec},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${inputIndex}]`;
  const aFilter = hasAudio(wsDir, clipPath, clip)
    ? `[${inputIndex}:a]atrim=start=${inSec}:end=${outSec},asetpts=PTS-STARTPTS,volume=${gainDb}dB[a${inputIndex}]`
    : `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${durSec}[a${inputIndex}]`;

  return { vFilter, aFilter };
}

function hasAudio(wsDir, clipPath, clip) {
  const candidate = clip?.asset_id || clip?.source_asset || clip?.name;
  const manifestPath = path.join(wsDir, 'studio.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = loadManifest(manifestPath);
    const found = manifest.assets?.find((a) =>
      (candidate && (a.id === candidate || a.name === candidate)) ||
      (a.path && path.resolve(wsDir, a.path) === path.resolve(clipPath))
    );
    if (found?.metadata && 'audio_codec' in found.metadata) {
      return Boolean(found.metadata.audio_codec);
    }
  }
  try {
    const probe = probeMedia(clipPath);
    return Boolean(probe.streams?.some((s) => s.codec_type === 'audio'));
  } catch {
    return false;
  }
}

function getAssetDuration(wsDir, clipPath, clip) {
  const candidate = clip?.asset_id || clip?.source_asset || clip?.name;
  const manifestPath = path.join(wsDir, 'studio.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = loadManifest(manifestPath);
    const found = manifest.assets?.find((a) =>
      (candidate && (a.id === candidate || a.name === candidate)) ||
      (a.path && path.resolve(wsDir, a.path) === path.resolve(clipPath))
    );
    if (found?.metadata?.duration_s !== undefined && found?.metadata?.duration_s !== null) {
      return { durationSec: Number(found.metadata.duration_s), assetId: found.id || candidate };
    }
  }
  try {
    const probe = probeMedia(clipPath);
    return { durationSec: parseFloat(probe.format?.duration || '0'), assetId: candidate || path.basename(clipPath) };
  } catch {
    return { durationSec: 0, assetId: candidate || path.basename(clipPath) };
  }
}

export function computeExpectedDuration(plan) {
  if (plan.mode === 'dark') {
    return Math.max(
      ...plan.clips.map((c) => ((c.timeline_start_ms || 0) + c.duration_ms) / 1000),
      1
    );
  }
  if (plan.mode === 'edit_only') {
    const c0 = plan.clips?.[0] || {};
    const c1 = plan.clips?.[1] || {};
    return ((c0.out_ms - c0.in_ms) + (c1.out_ms - c1.in_ms)) / 1000;
  }
  if (plan.mode === 'podcast_clip') {
    const videoClips = (plan.clips || []).filter((c) => c.kind === 'video' || !c.kind);
    return videoClips.reduce((sum, c) => sum + ((c.out_ms || 0) - (c.in_ms || 0)) / 1000, 0);
  }
  return 0;
}

export function verifyArtifact(artifactPath, planPath = null) {
  const probe = probeMedia(artifactPath);
  const vStream = probe.streams?.find((s) => s.codec_type === 'video');
  const aStream = probe.streams?.find((s) => s.codec_type === 'audio');
  const duration = parseFloat(probe.format?.duration || '0');

  const errors = [];
  if (!vStream) errors.push('Missing video stream');
  if (!aStream) errors.push('Missing audio stream');
  if (duration <= 0) errors.push('Invalid duration (<= 0s)');

  let planDetails = null;
  if (planPath) {
    const resolvedPlan = path.resolve(planPath);
    if (!fs.existsSync(resolvedPlan)) {
      throw new Error(`Plan file not found: ${planPath}`);
    }
    const plan = JSON.parse(fs.readFileSync(resolvedPlan, 'utf8'));

    if (plan.output?.width && vStream && vStream.width !== plan.output.width) {
      errors.push(`Width mismatch: expected ${plan.output.width}, got ${vStream.width}`);
    }
    if (plan.output?.height && vStream && vStream.height !== plan.output.height) {
      errors.push(`Height mismatch: expected ${plan.output.height}, got ${vStream.height}`);
    }

    if (plan.output?.fps_num && vStream) {
      const expectedFps = plan.output.fps_num / (plan.output.fps_den || 1);
      const [num, den] = (vStream.r_frame_rate || '0/1').split('/').map(Number);
      const actualFps = den ? num / den : num;
      if (Math.abs(actualFps - expectedFps) > 0.5) {
        errors.push(`FPS mismatch: expected ~${expectedFps}, got ${actualFps.toFixed(2)} (${vStream.r_frame_rate})`);
      }
    }

    const expectedDuration = computeExpectedDuration(plan);
    if (expectedDuration > 0) {
      const tolerance = 0.35;
      if (Math.abs(duration - expectedDuration) > tolerance) {
        errors.push(`Duration mismatch: expected ${expectedDuration.toFixed(2)}s (±${tolerance}s), got ${duration.toFixed(2)}s`);
      }
    }

    planDetails = {
      plan_file: path.basename(resolvedPlan),
      expected_duration_s: expectedDuration,
      expected_width: plan.output?.width,
      expected_height: plan.output?.height,
      expected_fps: plan.output?.fps_num ? plan.output.fps_num / (plan.output.fps_den || 1) : null,
    };
  }

  return {
    artifact: path.basename(artifactPath),
    path: artifactPath,
    passed: errors.length === 0,
    duration_s: duration,
    streams: {
      video: vStream ? {
        codec: vStream.codec_name,
        width: vStream.width,
        height: vStream.height,
        fps: vStream.r_frame_rate,
      } : null,
      audio: aStream ? {
        codec: aStream.codec_name,
        channels: aStream.channels,
        sample_rate: aStream.sample_rate,
      } : null,
    },
    plan_comparison: planDetails,
    errors,
  };
}

export function runFfmpeg(args, { verbose = false, artifactPath = null } = {}) {
  return new Promise((resolve) => {
    const ffmpegArgs = ['-progress', 'pipe:1', ...args];
    const child = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    let stdout = '';
    let killed = false;

    const onSigint = () => {
      killed = true;
      if (process.platform === 'win32' && child.pid) {
        try {
          execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {
          try { child.kill('SIGKILL'); } catch {}
        }
      } else {
        try { child.kill('SIGINT'); } catch {}
        try { child.kill('SIGKILL'); } catch {}
      }
      for (let i = 0; i < 50; i++) {
        if (artifactPath && fs.existsSync(artifactPath)) {
          try {
            fs.unlinkSync(artifactPath);
            break;
          } catch {
            const start = Date.now();
            while (Date.now() - start < 25) {}
          }
        } else {
          break;
        }
      }
      process.removeListener('SIGINT', onSigint);
      process.exit(130);
    };

    process.on('SIGINT', onSigint);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('close', (code, signal) => {
      process.removeListener('SIGINT', onSigint);

      if (killed || signal === 'SIGINT') {
        if (artifactPath && fs.existsSync(artifactPath)) {
          try { fs.unlinkSync(artifactPath); } catch {}
        }
        process.exit(130);
      }

      if (code !== 0) {
        if (artifactPath && fs.existsSync(artifactPath)) {
          try { fs.unlinkSync(artifactPath); } catch {}
        }
        if (verbose) {
          console.error(`Error: ffmpeg execution failed (exit ${code}):\n${stderr}`);
        } else {
          const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const tail = lines.slice(-10).join('\n');
          console.error(`Error: ffmpeg rendering failed:\n${tail || stderr}`);
        }
        process.exit(1);
      }

      resolve({ code, stdout, stderr });
    });
  });
}

// ponytail: synchronous child_process calls; upgrade to worker pool when batch rendering >10 parallel plans
export async function run({ positionals = [], flags = {} } = {}) {
  const sub = positionals[0];

  if (!sub || flags.help || sub === 'help') {
    console.log(`Universal Skill Studio Command

Usage:
  universal-skill studio <subcommand> [arguments] [options]

Subcommands:
  init [--dest <path>]          Create studio workspace dirs (assets, artifacts, packages) and manifest
  import <file>                 Register source footage into assets/ with AST-xxxxxxxx id and ffprobe metadata
  render <editplan.json>        Validate EditPlan contract and execute cuts/captions via ffmpeg
  qa <artifact.mp4>             Run automated ffprobe QA verification on rendered video artifact

Options:
  --dest <path>                 Custom studio workspace destination directory
  --json                        Output results in JSON format
  -h, --help                    Show help message`);
    return;
  }

  if (sub === 'init') {
    const targetDir = findWorkspaceDir(flags.dest || positionals[1]);
    fs.mkdirSync(path.join(targetDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'packages'), { recursive: true });

    const manifestPath = path.join(targetDir, 'studio.json');
    let manifest;
    if (fs.existsSync(manifestPath)) {
      manifest = loadManifest(manifestPath);
    } else {
      manifest = {
        version: 1,
        name: 'universal-studio',
        created_at: new Date().toISOString(),
        assets: [],
        artifacts: [],
      };
      saveManifestAtomic(manifestPath, manifest);
    }

    if (flags.json) {
      console.log(JSON.stringify({ status: 'ok', destination: targetDir, manifest }, null, 2));
      return;
    }
    console.log(`Initialized studio workspace at ${targetDir}`);
    console.log(`- Created assets/, artifacts/, packages/`);
    console.log(`- Manifest: studio.json`);
    return;
  }

  if (sub === 'import') {
    const srcFile = positionals[1];
    if (!srcFile) {
      console.error('Error: Missing file to import. Usage: universal-skill studio import <file>');
      process.exit(1);
    }
    const resolvedSrc = path.resolve(srcFile);
    if (!fs.existsSync(resolvedSrc)) {
      console.error(`Error: Source file not found: ${srcFile}`);
      process.exit(1);
    }

    if (!checkBinary('ffprobe')) {
      console.error('Error: ffprobe is not installed or not found on PATH. Install ffmpeg to use video studio features.');
      process.exit(1);
    }

    const wsDir = findWorkspaceDir(flags.dest);
    fs.mkdirSync(path.join(wsDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(wsDir, 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(wsDir, 'packages'), { recursive: true });

    const assetId = `AST-${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(resolvedSrc) || '.mp4';
    const targetName = `${assetId}${ext}`;
    const targetPath = path.join(wsDir, 'assets', targetName);
    fs.copyFileSync(resolvedSrc, targetPath);

    const probe = probeMedia(targetPath);
    const vStream = probe.streams?.find((s) => s.codec_type === 'video');
    const aStream = probe.streams?.find((s) => s.codec_type === 'audio');
    const duration = parseFloat(probe.format?.duration || '0');

    const metadata = {
      duration_s: duration,
      width: vStream?.width || null,
      height: vStream?.height || null,
      fps: vStream?.r_frame_rate || null,
      video_codec: vStream?.codec_name || null,
      audio_codec: aStream?.codec_name || null,
      channels: aStream?.channels || null,
      sample_rate: aStream?.sample_rate || null,
      streams: probe.streams?.length || 0,
    };

    const assetRecord = {
      id: assetId,
      name: path.basename(resolvedSrc),
      path: path.relative(wsDir, targetPath).replace(/\\/g, '/'),
      imported_at: new Date().toISOString(),
      size_bytes: fs.statSync(targetPath).size,
      metadata,
    };

    const manifestPath = path.join(wsDir, 'studio.json');
    const manifest = loadManifest(manifestPath);
    manifest.assets = manifest.assets || [];
    manifest.assets.push(assetRecord);
    saveManifestAtomic(manifestPath, manifest);

    if (flags.json) {
      console.log(JSON.stringify(assetRecord, null, 2));
      return;
    }
    console.log(`Imported asset ${assetId}: ${assetRecord.name} (${metadata.width || '?'}x${metadata.height || '?'}, ${duration.toFixed(2)}s)`);
    return assetRecord;
  }

  if (sub === 'render') {
    const planFile = positionals[1];
    if (!planFile) {
      console.error('Error: Missing edit plan file. Usage: universal-skill studio render <editplan.json>');
      process.exit(1);
    }
    const resolvedPlanFile = path.resolve(planFile);
    if (!fs.existsSync(resolvedPlanFile)) {
      console.error(`Error: Edit plan file not found: ${planFile}`);
      process.exit(1);
    }

    let plan;
    try {
      plan = JSON.parse(fs.readFileSync(resolvedPlanFile, 'utf8'));
    } catch (err) {
      console.error(`Error: Malformed JSON in edit plan: ${err.message}`);
      process.exit(1);
    }

    try {
      validateEditPlan(plan);
    } catch (err) {
      console.error(`Error: EditPlan validation failed: ${err.message}`);
      process.exit(1);
    }

    if (!checkBinary('ffmpeg')) {
      console.error('Error: ffmpeg is not installed or not found on PATH. Install ffmpeg to use video studio features.');
      process.exit(1);
    }

    const wsDir = findWorkspaceDir(flags.dest);

    const videoClipsToCheck = (plan.mode === 'edit_only' || plan.mode === 'podcast_clip')
      ? (plan.clips || []).filter((c) => c.kind === 'video' || (!c.kind && c.asset_id))
      : [];

    for (let i = 0; i < videoClipsToCheck.length; i++) {
      const c = videoClipsToCheck[i];
      const clipPath = resolveAsset(wsDir, c);
      const { durationSec, assetId } = getAssetDuration(wsDir, clipPath, c);
      const assetDurMs = Math.round(durationSec * 1000);
      const clipName = c.clip_id || `clip #${i}`;
      if (c.out_ms > assetDurMs) {
        console.error(`Error: Clip '${clipName}' out_ms (${c.out_ms}ms) exceeds asset '${assetId}' duration (${assetDurMs}ms / ${durationSec.toFixed(3)}s)`);
        process.exit(1);
      }
      if (c.in_ms > assetDurMs) {
        console.error(`Error: Clip '${clipName}' in_ms (${c.in_ms}ms) exceeds asset '${assetId}' duration (${assetDurMs}ms / ${durationSec.toFixed(3)}s)`);
        process.exit(1);
      }
    }

    fs.mkdirSync(path.join(wsDir, 'artifacts'), { recursive: true });
    const artifactId = `ART-${crypto.randomBytes(4).toString('hex')}`;
    const artifactPath = path.join(wsDir, 'artifacts', `${artifactId}.mp4`);
    const { width, height } = plan.output;

    const tempFiles = [];
    try {
      if (plan.mode === 'dark') {
        const totalDuration = computeExpectedDuration(plan);
        const vf = buildDarkTextFilters(plan.clips, tempFiles);
        const args = [
          '-y',
          '-f', 'lavfi',
          '-i', `color=c=black:s=${width}x${height}:r=30:d=${totalDuration}`,
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', `${totalDuration}`,
          '-vf', vf,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-pix_fmt', 'yuv420p',
          artifactPath,
        ];
        await runFfmpeg(args, { verbose: flags.verbose, artifactPath });
      } else if (plan.mode === 'edit_only') {
        const clip0Path = resolveAsset(wsDir, plan.clips[0]);
        const clip1Path = resolveAsset(wsDir, plan.clips[1]);
        const f0 = buildClipFilters(0, plan.clips[0], clip0Path, wsDir, width, height, plan.audio_tracks?.[0]?.gain_db || 0);
        const f1 = buildClipFilters(1, plan.clips[1], clip1Path, wsDir, width, height, plan.audio_tracks?.[1]?.gain_db || 0);

        const filterParts = [
          f0.vFilter,
          f0.aFilter,
          f1.vFilter,
          f1.aFilter,
          `[v0][a0][v1][a1]concat=n=2:v=1:a=1[basev][outa]`,
          buildCaptionFilters(plan.captions || [], '[basev]', tempFiles),
        ];

        const args = [
          '-y',
          '-i', clip0Path,
          '-i', clip1Path,
          '-filter_complex', filterParts.join(';'),
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-pix_fmt', 'yuv420p',
          artifactPath,
        ];
        await runFfmpeg(args, { verbose: flags.verbose, artifactPath });
      } else if (plan.mode === 'podcast_clip') {
        const videoClips = (plan.clips || []).filter((c) => c.kind === 'video' || !c.kind);
        const captions = plan.captions || (plan.clips || []).filter((c) => c.kind === 'text');
        const inputArgs = [];
        const filterParts = [];
        const concatInputs = [];

        for (let i = 0; i < videoClips.length; i++) {
          const c = videoClips[i];
          const clipPath = resolveAsset(wsDir, c);
          inputArgs.push('-i', clipPath);
          const gain = plan.audio_tracks?.[i]?.gain_db || 0;
          const { vFilter, aFilter } = buildClipFilters(i, c, clipPath, wsDir, width, height, gain);
          filterParts.push(vFilter, aFilter);
          concatInputs.push(`[v${i}][a${i}]`);
        }

        let baseV = '[concatv]';
        if (videoClips.length === 1) {
          baseV = '[v0]';
          filterParts.push(`[a0]anull[outa]`);
        } else {
          filterParts.push(`${concatInputs.join('')}concat=n=${videoClips.length}:v=1:a=1[concatv][outa]`);
        }

        filterParts.push(buildCaptionFilters(captions, baseV, tempFiles));

        const args = [
          '-y',
          ...inputArgs,
          '-filter_complex', filterParts.join(';'),
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-pix_fmt', 'yuv420p',
          artifactPath,
        ];
        await runFfmpeg(args, { verbose: flags.verbose, artifactPath });
      }
    } finally {
      for (const f of tempFiles) {
        try { fs.unlinkSync(f); } catch {}
      }
    }

    const artifactRecord = {
      id: artifactId,
      path: path.relative(wsDir, artifactPath).replace(/\\/g, '/'),
      plan_file: path.basename(resolvedPlanFile),
      mode: plan.mode,
      rendered_at: new Date().toISOString(),
      size_bytes: fs.existsSync(artifactPath) ? fs.statSync(artifactPath).size : 0,
    };

    const manifestPath = path.join(wsDir, 'studio.json');
    const manifest = loadManifest(manifestPath);
    manifest.artifacts = manifest.artifacts || [];
    manifest.artifacts.push(artifactRecord);
    saveManifestAtomic(manifestPath, manifest);

    const qaReport = verifyArtifact(artifactPath, resolvedPlanFile);
    if (!qaReport.passed) {
      console.error(`Error: Post-render QA validation failed:\n${qaReport.errors.map((e) => `  - ${e}`).join('\n')}`);
      process.exit(1);
    }

    if (flags.json) {
      console.log(JSON.stringify(artifactRecord, null, 2));
      return;
    }
    console.log(`Rendered artifact ${artifactId}: ${artifactRecord.path} (${artifactRecord.size_bytes} bytes)`);
    return artifactRecord;
  }

  if (sub === 'qa') {
    const artFile = positionals[1];
    if (!artFile) {
      console.error('Error: Missing artifact file. Usage: universal-skill studio qa <artifact.mp4> [--plan <editplan.json>]');
      process.exit(1);
    }
    const resolvedArt = path.resolve(artFile);
    if (!fs.existsSync(resolvedArt)) {
      console.error(`Error: Artifact file not found: ${artFile}`);
      process.exit(1);
    }

    if (!checkBinary('ffprobe')) {
      console.error('Error: ffprobe is not installed or not found on PATH. Install ffmpeg to use video studio features.');
      process.exit(1);
    }

    let report;
    try {
      report = verifyArtifact(resolvedArt, flags.plan);
    } catch (err) {
      console.error(`Error: QA verification failed: ${err.message}`);
      process.exit(1);
    }

    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Artifact QA: ${report.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`- File: ${report.artifact}`);
      console.log(`- Duration: ${report.duration_s.toFixed(2)}s`);
      if (report.streams?.video) console.log(`- Video: ${report.streams.video.codec} (${report.streams.video.width}x${report.streams.video.height} @ ${report.streams.video.fps})`);
      if (report.streams?.audio) console.log(`- Audio: ${report.streams.audio.codec} (${report.streams.audio.channels}ch @ ${report.streams.audio.sample_rate}Hz)`);
      if (report.plan_comparison) {
        console.log(`- Plan Comparison: ${report.plan_comparison.plan_file} (expected ${report.plan_comparison.expected_duration_s.toFixed(2)}s, ${report.plan_comparison.expected_width}x${report.plan_comparison.expected_height} @ ${report.plan_comparison.expected_fps}fps)`);
      }
      if (!report.passed) {
        console.error(`QA Failures:\n${report.errors.map((e) => `  - ${e}`).join('\n')}`);
      }
    }

    if (!report.passed) {
      process.exit(1);
    }
    return report;
  }

  console.error(`Error: Unknown studio subcommand '${sub}'. Run 'universal-skill studio --help' for available subcommands.`);
  process.exit(1);
}

export default run;

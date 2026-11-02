// Video Studio Execution Slice
// Minimal self-contained local video pipeline with zero npm dependencies.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
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
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const found = manifest.assets?.find((a) => a.id === candidate || a.name === candidate);
      if (found?.path) {
        const p = path.resolve(workspaceDir, found.path);
        if (fs.existsSync(p)) return p;
      }
    } catch {}
  }

  const assetsDir = path.join(workspaceDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const match = files.find((f) => f.startsWith(candidate));
    if (match) return path.join(assetsDir, match);
  }

  throw new Error(`Asset '${candidate}' not found in workspace assets`);
}

function createDrawtextFilter(text, fontOpt, startSec, endSec, yExpr, tempFiles) {
  const tmpFile = path.join(os.tmpdir(), `usk-cap-${crypto.randomBytes(6).toString('hex')}.txt`);
  fs.writeFileSync(tmpFile, text, 'utf8');
  tempFiles.push(tmpFile);
  const escapedPath = tmpFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  return `drawtext=textfile='${escapedPath}':expansion=none${fontOpt}:fontcolor=white:fontsize=48:x=(w-text_w)/2:y=${yExpr}:enable='between(t\\,${startSec}\\,${endSec})'`;
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
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } else {
      manifest = {
        version: 1,
        name: 'universal-studio',
        created_at: new Date().toISOString(),
        assets: [],
        artifacts: [],
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
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
    let manifest = { version: 1, name: 'universal-studio', assets: [], artifacts: [] };
    if (fs.existsSync(manifestPath)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
    }
    manifest.assets = manifest.assets || [];
    manifest.assets.push(assetRecord);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

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
    fs.mkdirSync(path.join(wsDir, 'artifacts'), { recursive: true });
    const artifactId = `ART-${crypto.randomBytes(4).toString('hex')}`;
    const artifactPath = path.join(wsDir, 'artifacts', `${artifactId}.mp4`);
    const { width, height } = plan.output;

    const tempFiles = [];
    try {
      if (plan.mode === 'dark') {
        const totalDuration = Math.max(
          ...plan.clips.map((c) => ((c.timeline_start_ms || 0) + c.duration_ms) / 1000),
          1
        );
        const font = findSystemFont();
        const fontOpt = font ? `:fontfile='${font.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
        const textFilters = plan.clips.map((c) => {
          const start = ((c.timeline_start_ms || 0) / 1000).toFixed(3);
          const end = (((c.timeline_start_ms || 0) + c.duration_ms) / 1000).toFixed(3);
          return createDrawtextFilter(c.text, fontOpt, start, end, '(h-text_h)/2', tempFiles);
        });
        const vf = textFilters.join(',');
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
        execFileSync('ffmpeg', args, { stdio: 'pipe' });
      } else if (plan.mode === 'edit_only') {
        const clip0Path = resolveAsset(wsDir, plan.clips[0]);
        const clip1Path = resolveAsset(wsDir, plan.clips[1]);
        const c0 = plan.clips[0];
        const c1 = plan.clips[1];
        const a0 = plan.audio_tracks[0] || { gain_db: 0 };
        const a1 = plan.audio_tracks[1] || { gain_db: 0 };
        const in0 = (c0.in_ms / 1000).toFixed(3);
        const out0 = (c0.out_ms / 1000).toFixed(3);
        const in1 = (c1.in_ms / 1000).toFixed(3);
        const out1 = (c1.out_ms / 1000).toFixed(3);

        const filterParts = [
          `[0:v]trim=start=${in0}:end=${out0},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0]`,
          `[0:a]atrim=start=${in0}:end=${out0},asetpts=PTS-STARTPTS,volume=${a0.gain_db}dB[a0]`,
          `[1:v]trim=start=${in1}:end=${out1},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1]`,
          `[1:a]atrim=start=${in1}:end=${out1},asetpts=PTS-STARTPTS,volume=${a1.gain_db}dB[a1]`,
          `[v0][a0][v1][a1]concat=n=2:v=1:a=1[basev][outa]`,
        ];

        const captions = plan.captions || [];
        if (captions.length > 0) {
          const font = findSystemFont();
          const fontOpt = font ? `:fontfile='${font.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
          const capFilters = captions.map((c) => {
            const start = ((c.timeline_start_ms || 0) / 1000).toFixed(3);
            const end = (((c.timeline_start_ms || 0) + (c.duration_ms || 1000)) / 1000).toFixed(3);
            return createDrawtextFilter(c.text, fontOpt, start, end, 'h-200', tempFiles);
          }).join(',');
          filterParts.push(`[basev]${capFilters}[outv]`);
        } else {
          filterParts.push(`[basev]null[outv]`);
        }

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
        execFileSync('ffmpeg', args, { stdio: 'pipe' });
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
          const inSec = ((c.in_ms || 0) / 1000).toFixed(3);
          const outSec = ((c.out_ms || (c.in_ms || 0) + 1000) / 1000).toFixed(3);
          const gain = plan.audio_tracks?.[i]?.gain_db || 0;
          filterParts.push(`[${i}:v]trim=start=${inSec}:end=${outSec},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
          filterParts.push(`[${i}:a]atrim=start=${inSec}:end=${outSec},asetpts=PTS-STARTPTS,volume=${gain}dB[a${i}]`);
          concatInputs.push(`[v${i}][a${i}]`);
        }

        let baseV = '[concatv]';
        if (videoClips.length === 1) {
          baseV = '[v0]';
          filterParts.push(`[a0]anull[outa]`);
        } else {
          filterParts.push(`${concatInputs.join('')}concat=n=${videoClips.length}:v=1:a=1[concatv][outa]`);
        }

        if (captions.length > 0) {
          const font = findSystemFont();
          const fontOpt = font ? `:fontfile='${font.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
          const textFilters = captions.map((c) => {
            const start = ((c.timeline_start_ms || 0) / 1000).toFixed(3);
            const end = (((c.timeline_start_ms || 0) + (c.duration_ms || 1000)) / 1000).toFixed(3);
            return createDrawtextFilter(c.text, fontOpt, start, end, 'h-200', tempFiles);
          }).join(',');
          filterParts.push(`${baseV}${textFilters}[outv]`);
        } else {
          filterParts.push(`${baseV}null[outv]`);
        }

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
        execFileSync('ffmpeg', args, { stdio: 'pipe' });
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
    let manifest = { version: 1, name: 'universal-studio', assets: [], artifacts: [] };
    if (fs.existsSync(manifestPath)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
    }
    manifest.artifacts = manifest.artifacts || [];
    manifest.artifacts.push(artifactRecord);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

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
      console.error('Error: Missing artifact file. Usage: universal-skill studio qa <artifact.mp4>');
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

    const probe = probeMedia(resolvedArt);
    const vStream = probe.streams?.find((s) => s.codec_type === 'video');
    const aStream = probe.streams?.find((s) => s.codec_type === 'audio');
    const duration = parseFloat(probe.format?.duration || '0');

    const errors = [];
    if (!vStream) errors.push('Missing video stream');
    if (!aStream) errors.push('Missing audio stream');
    if (duration <= 0) errors.push('Invalid duration (<= 0s)');

    const passed = errors.length === 0;

    const report = {
      artifact: path.basename(resolvedArt),
      path: resolvedArt,
      passed,
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
      errors,
    };

    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Artifact QA: ${passed ? 'PASSED' : 'FAILED'}`);
      console.log(`- File: ${report.artifact}`);
      console.log(`- Duration: ${duration.toFixed(2)}s`);
      if (vStream) console.log(`- Video: ${vStream.codec_name} (${vStream.width}x${vStream.height} @ ${vStream.r_frame_rate})`);
      if (aStream) console.log(`- Audio: ${aStream.codec_name} (${aStream.channels}ch @ ${aStream.sample_rate}Hz)`);
      if (!passed) {
        console.error(`QA Failures:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
      }
    }

    if (!passed) {
      process.exit(1);
    }
    return report;
  }

  console.error(`Error: Unknown studio subcommand '${sub}'. Run 'universal-skill studio --help' for available subcommands.`);
  process.exit(1);
}

export default run;

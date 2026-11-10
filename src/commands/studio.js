// Video Studio Execution Slice
// Minimal self-contained local video pipeline with zero npm dependencies.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import process from 'node:process';
import readline from 'node:readline';
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

export function createDrawtextFilter(text, fontOpt, startSec, endSec, yExpr, tempFiles, captionStyle = 'default') {
  const tmpFile = path.join(os.tmpdir(), `usk-cap-${crypto.randomBytes(6).toString('hex')}.txt`);
  fs.writeFileSync(tmpFile, text, 'utf8');
  tempFiles.push(tmpFile);
  const escapedPath = tmpFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  if (captionStyle === 'impact') {
    return `drawtext=textfile='${escapedPath}':expansion=none${fontOpt}:fontcolor=yellow@1:fontsize=56:box=1:boxcolor=black@0.7:boxborderw=12:x=(w-text_w)/2:y=${yExpr}:enable='between(t\\,${startSec}\\,${endSec})'`;
  }
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

export function buildCaptionFilters(captions, baseV, tempFiles, captionStyle = 'default') {
  if (!captions || captions.length === 0) {
    return `${baseV}null[outv]`;
  }
  const font = findSystemFont();
  const fontOpt = font ? `:fontfile='${font.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
  const textFilters = captions.map((c) => {
    const start = ((c.timeline_start_ms || 0) / 1000).toFixed(3);
    const end = (((c.timeline_start_ms || 0) + (c.duration_ms || 1000)) / 1000).toFixed(3);
    const style = c.style || captionStyle;
    const yPos = style === 'impact' ? '(h-text_h)/2' : 'h-200';
    return createDrawtextFilter(c.text, fontOpt, start, end, yPos, tempFiles, style);
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

export function detectSilence(filePath, { noiseThreshold = '-30dB', minDurationSec = 0.8 } = {}) {
  if (!checkBinary('ffmpeg')) {
    throw new Error('ffmpeg is not installed or not found on PATH. Install ffmpeg to use video studio features.');
  }
  const args = [
    '-i', filePath,
    '-af', `silencedetect=noise=${noiseThreshold}:d=${minDurationSec}`,
    '-f', 'null',
    '-'
  ];
  const res = spawnSync('ffmpeg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const stderr = res.stderr || '';

  const silences = [];
  const lines = stderr.split(/\r?\n/);
  let currentStart = null;
  for (const line of lines) {
    const sMatch = line.match(/silence_start:\s*([0-9.]+)/);
    if (sMatch) {
      currentStart = parseFloat(sMatch[1]);
    }
    const eMatch = line.match(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/);
    if (eMatch && currentStart !== null) {
      const end = parseFloat(eMatch[1]);
      const duration = parseFloat(eMatch[2]);
      silences.push({ start: currentStart, end, duration });
      currentStart = null;
    }
  }
  return silences;
}

export function computeSpeechIntervals(totalDurationSec, silences = [], { minSpeechSec = 0.3 } = {}) {
  const speechIntervals = [];
  let cursor = 0.0;

  for (const silence of silences) {
    if (silence.start > cursor) {
      const segDuration = silence.start - cursor;
      if (segDuration >= minSpeechSec) {
        speechIntervals.push({
          startSec: parseFloat(cursor.toFixed(3)),
          endSec: parseFloat(silence.start.toFixed(3)),
          durationSec: parseFloat(segDuration.toFixed(3)),
        });
      }
    }
    cursor = Math.max(cursor, silence.end);
  }

  if (cursor < totalDurationSec) {
    const remaining = totalDurationSec - cursor;
    if (remaining >= minSpeechSec) {
      speechIntervals.push({
        startSec: parseFloat(cursor.toFixed(3)),
        endSec: parseFloat(totalDurationSec.toFixed(3)),
        durationSec: parseFloat(remaining.toFixed(3)),
      });
    }
  }

  if (speechIntervals.length === 0 && totalDurationSec >= minSpeechSec) {
    speechIntervals.push({
      startSec: 0,
      endSec: parseFloat(totalDurationSec.toFixed(3)),
      durationSec: parseFloat(totalDurationSec.toFixed(3)),
    });
  }

  return speechIntervals;
}

export function parseSrt(srtContent) {
  const items = [];
  const blocks = srtContent.trim().split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const parseTime = (t) => {
      const parts = t.replace(',', '.').split(':');
      if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      }
      return 0;
    };
    const startSec = parseTime(startStr);
    const endSec = parseTime(endStr);
    const textIdx = lines.indexOf(timeLine);
    const text = lines.slice(textIdx + 1).join(' ').trim();
    if (text) {
      const words = text.split(/\s+/);
      const durPerWord = (endSec - startSec) / words.length;
      words.forEach((w, idx) => {
        items.push({
          word: w,
          start: parseFloat((startSec + idx * durPerWord).toFixed(3)),
          end: parseFloat((startSec + (idx + 1) * durPerWord).toFixed(3)),
        });
      });
    }
  }
  return items;
}

export function groupWordsIntoCaptions(words = [], { maxWords = 3, captionStyle = 'impact' } = {}) {
  if (!words || words.length === 0) return [];

  if (captionStyle === 'word') {
    return words.map((w) => ({
      text: (w.word || w.text || '').trim().toUpperCase(),
      startSec: w.start,
      endSec: w.end,
      durationMs: Math.max(150, Math.round((w.end - w.start) * 1000)),
      style: captionStyle,
    }));
  }

  if (captionStyle === 'full') {
    const captions = [];
    let currentWords = [];
    let startSec = null;
    let endSec = null;
    for (const w of words) {
      const text = (w.word || w.text || '').trim();
      if (!text) continue;
      if (startSec === null) startSec = w.start;
      if (endSec !== null && w.start - endSec > 0.5) {
        captions.push({
          text: currentWords.join(' '),
          startSec,
          endSec,
          durationMs: Math.max(200, Math.round((endSec - startSec) * 1000)),
          style: captionStyle,
        });
        currentWords = [];
        startSec = w.start;
      }
      currentWords.push(text);
      endSec = w.end;
    }
    if (currentWords.length > 0 && startSec !== null) {
      captions.push({
        text: currentWords.join(' '),
        startSec,
        endSec,
        durationMs: Math.max(200, Math.round((endSec - startSec) * 1000)),
        style: captionStyle,
      });
    }
    return captions;
  }

  // Default: Style A ('impact') - 2 to 4 words per chunk in uppercase
  const captions = [];
  let currentWords = [];
  let startSec = null;
  let endSec = null;

  for (const w of words) {
    const text = (w.word || w.text || '').trim();
    if (!text) continue;
    if (startSec === null) startSec = w.start;
    currentWords.push(text);
    endSec = w.end;

    if (currentWords.length >= maxWords) {
      captions.push({
        text: currentWords.join(' ').toUpperCase(),
        startSec,
        endSec,
        durationMs: Math.max(200, Math.round((endSec - startSec) * 1000)),
        style: 'impact',
      });
      currentWords = [];
      startSec = null;
      endSec = null;
    }
  }

  if (currentWords.length > 0 && startSec !== null) {
    captions.push({
      text: currentWords.join(' ').toUpperCase(),
      startSec,
      endSec,
      durationMs: Math.max(200, Math.round((endSec - startSec) * 1000)),
      style: 'impact',
    });
  }

  return captions;
}

export function remapCaptionsToSpeechTimeline(rawCaptions = [], speechIntervals = []) {
  const remapped = [];
  let timelineOffset = 0.0;

  for (const seg of speechIntervals) {
    const segStart = seg.startSec;
    const segEnd = seg.endSec;
    const segDur = seg.durationSec;

    for (const cap of rawCaptions) {
      if (cap.endSec <= segStart || cap.startSec >= segEnd) {
        continue;
      }
      const clampedStart = Math.max(cap.startSec, segStart);
      const clampedEnd = Math.min(cap.endSec, segEnd);
      const startInSeg = clampedStart - segStart;
      const capDur = clampedEnd - clampedStart;

      if (capDur > 0.05) {
        remapped.push({
          text: cap.text,
          timeline_start_ms: Math.round((timelineOffset + startInSeg) * 1000),
          duration_ms: Math.round(capDur * 1000),
          style: cap.style || 'impact',
        });
      }
    }
    timelineOffset += segDur;
  }

  return remapped;
}

export async function transcribeAudio(audioPath, { apiKey, useOpenai, srtPath } = {}) {
  if (srtPath && fs.existsSync(srtPath)) {
    const content = fs.readFileSync(srtPath, 'utf8');
    return parseSrt(content);
  }

  if (useOpenai && apiKey) {
    const fileBuf = fs.readFileSync(audioPath);
    const blob = new Blob([fileBuf], { type: 'audio/mp3' });
    const formData = new FormData();
    formData.append('file', blob, path.basename(audioPath));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Whisper API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (data.words && Array.isArray(data.words)) {
      return data.words.map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      }));
    }
    if (data.text) {
      return [{ word: data.text, start: 0, end: data.duration || 1 }];
    }
  }

  try {
    const mod = await import('@xenova/transformers');
    const pipeline = mod.pipeline;
    const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
    const result = await transcriber(audioPath, { return_timestamps: 'word' });
    if (result.chunks && Array.isArray(result.chunks)) {
      return result.chunks.map((c) => ({
        word: c.text,
        start: c.timestamp[0],
        end: c.timestamp[1] || c.timestamp[0] + 0.5,
      }));
    }
  } catch {
    // Optional local transformers not installed or failed
  }

  return [];
}

export const HOOK_PATTERNS = [
  /\b(o (?:maior )?(?:erro|segredo|problema)|a verdade|ninguem te conta|pouca gente sabe)\b/i,
  /\b(por que|porque|como voce|se voce quer|quando voce|nunca faca|pare de|cuidado com)\b/i,
  /\b(voce sabia|presta atencao|olha isso|o que acontece|o resultado)\b/i,
  /\b(primeiro|segundo|passo|dica|estrategia|metodo)\b/i,
];

export function scoreHookSentence(text = '') {
  let score = 0.0;
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const pat of HOOK_PATTERNS) {
    if (pat.test(normalized)) score += 2.5;
  }
  if (text.includes('?')) score += 1.5;
  if (text.includes('!')) score += 1.0;
  return score;
}

export function findCandidateClips(segments = [], { minDurationSec = 30, maxDurationSec = 60 } = {}) {
  const candidates = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const hookScore = scoreHookSentence(seg.text);
    if (hookScore < 1.0 && i > 0 && segments.length > 10) continue;

    const currText = [seg.text];
    const startSec = seg.start_s !== undefined ? seg.start_s : seg.start;
    for (let j = i + 1; j < segments.length; j++) {
      currText.push(segments[j].text);
      const endSec = segments[j].end_s !== undefined ? segments[j].end_s : segments[j].end;
      const dur = endSec - startSec;
      if (dur >= minDurationSec && dur <= maxDurationSec) {
        candidates.push({
          hook_id: seg.id || i + 1,
          start_s: parseFloat(startSec.toFixed(2)),
          end_s: parseFloat(endSec.toFixed(2)),
          duration_s: parseFloat(dur.toFixed(2)),
          hook_score: hookScore,
          hook_text: seg.text,
          punchline_text: segments[j].text,
          full_text: currText.join(' '),
        });
      } else if (dur > maxDurationSec) {
        break;
      }
    }
  }

  candidates.sort((a, b) => {
    if (b.hook_score !== a.hook_score) return b.hook_score - a.hook_score;
    return Math.abs(a.duration_s - 45.0) - Math.abs(b.duration_s - 45.0);
  });

  return candidates;
}

export function buildAutoClipPlan({ asset, speechIntervals, captions = [], format = '9:16', overlays = [], musicTracks = [] }) {
  const isWidescreen = format === '16:9';
  const width = isWidescreen ? 1920 : 1080;
  const height = isWidescreen ? 1080 : 1920;

  const clips = [];
  const audioTracks = [];
  let timelineCursorMs = 0;

  for (let i = 0; i < speechIntervals.length; i++) {
    const seg = speechIntervals[i];
    const clipId = `speech-${String(i + 1).padStart(2, '0')}`;
    const inMs = Math.round(seg.startSec * 1000);
    const outMs = Math.round(seg.endSec * 1000);
    const clipDurMs = outMs - inMs;

    clips.push({
      kind: 'video',
      clip_id: clipId,
      asset_id: asset.id,
      in_ms: inMs,
      out_ms: outMs,
      timeline_start_ms: timelineCursorMs,
      speed: 1,
    });

    audioTracks.push({
      kind: 'source',
      clip_id: clipId,
      gain_db: 0,
    });

    timelineCursorMs += clipDurMs;
  }

  return {
    schema_version: 1,
    mode: 'podcast_clip',
    clips,
    audio_tracks: audioTracks,
    captions,
    output: {
      width,
      height,
      fps_num: 30,
      fps_den: 1,
      video_codec: 'h264',
      audio_codec: 'aac',
    },
  };
  if (overlays && overlays.length > 0) {
    plan.overlays = overlays;
  }
  if (musicTracks && musicTracks.length > 0) {
    plan.music_tracks = musicTracks;
  }
  return plan;
}

export async function run({ positionals = [], flags = {} } = {}) {
  const sub = positionals[0];

  if (!sub || flags.help || sub === 'help') {
    console.log(`Esquadrão Studio (Universal Skill Studio)

Usage:
  esquadrao studio <subcommand> [arguments] [options]
  universal-skill studio <subcommand> [arguments] [options]

Subcommands:
  init [--dest <path>]          Create studio workspace dirs (assets, artifacts, packages) and manifest
  import <file>                 Register source footage into assets/ with AST-xxxxxxxx id and ffprobe metadata
  detect-silence <video>        Detect silent intervals and compute active speech segments
  auto-clip <video>             Full pipeline: detect silence, cut pauses, transcribe, and render
  transcribe <video>            Extract audio and export structured transcript.json with timestamps
  find-hooks <file>             Find top viral hook segments (30-60s) from transcript or video
  render <editplan.json>        Validate EditPlan contract and execute cuts/captions via ffmpeg
  qa <artifact.mp4>             Run automated ffprobe QA verification on rendered video artifact

Options:
  --dest <path>                 Custom studio workspace destination directory
  --silence-thresh <dB>         Sensibilidade de silêncio (padrão: -30dB)
  --silence-duration <sec>      Pausa mínima para corte de silêncio (padrão: 0.8s)
  --format <9:16|16:9>          Aspect ratio do corte final (padrão: 9:16)
  --caption-style <style>       Estilo de legendas: impact (padrão), word, full
  --openai                      Forçar uso da API OpenAI Whisper
  --local                       Forçar transcrição Whisper local
  --captions <file.srt>         Arquivo de legendas externo
  --json                        Output results in JSON format
  -h, --help                    Show help message`);
    return;
  }

  if (sub === 'detect-silence') {
    const srcFile = positionals[1];
    if (!srcFile) {
      console.error('Error: Missing file. Usage: esquadrao studio detect-silence <video>');
      process.exit(1);
    }
    const resolvedSrc = path.resolve(srcFile);
    if (!fs.existsSync(resolvedSrc)) {
      console.error(`Error: File not found: ${srcFile}`);
      process.exit(1);
    }
    const thresh = flags['silence-thresh'] || '-30dB';
    const dur = parseFloat(flags['silence-duration'] || '0.8');
    const silences = detectSilence(resolvedSrc, { noiseThreshold: thresh, minDurationSec: dur });
    const probe = probeMedia(resolvedSrc);
    const totalSec = parseFloat(probe.format?.duration || '0');
    const speech = computeSpeechIntervals(totalSec, silences);
    const totalSilence = silences.reduce((acc, s) => acc + s.duration, 0);

    const report = {
      file: path.basename(resolvedSrc),
      total_duration_s: totalSec,
      silences_count: silences.length,
      total_silence_s: parseFloat(totalSilence.toFixed(3)),
      speech_segments_count: speech.length,
      speech_duration_s: parseFloat((totalSec - totalSilence).toFixed(3)),
      silences,
      speech_segments: speech,
    };

    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
      return report;
    }
    console.log(`Silence detection report for ${report.file}:`);
    console.log(`- Total Duration: ${report.total_duration_s.toFixed(2)}s`);
    console.log(`- Silences Detected: ${report.silences_count} (${report.total_silence_s.toFixed(2)}s removed)`);
    console.log(`- Speech Segments: ${report.speech_segments_count} (${report.speech_duration_s.toFixed(2)}s active)`);
    return report;
  }

  if (sub === 'transcribe') {
    const srcFile = positionals[1];
    if (!srcFile) {
      console.error('Error: Missing video file. Usage: esquadrao studio transcribe <video.mp4> [options]');
      process.exit(1);
    }
    const resolvedSrc = path.resolve(srcFile);
    if (!fs.existsSync(resolvedSrc)) {
      console.error(`Error: Source file not found: ${srcFile}`);
      process.exit(1);
    }
    if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
      console.error('Error: ffmpeg/ffprobe not found. Install ffmpeg to use video studio features.');
      process.exit(1);
    }

    const wsDir = findWorkspaceDir(flags.dest);
    fs.mkdirSync(path.join(wsDir, 'packages'), { recursive: true });

    const probe = probeMedia(resolvedSrc);
    const duration = parseFloat(probe.format?.duration || '0');

    const openAiKey = process.env.OPENAI_API_KEY;
    let useOpenAi = Boolean(flags.openai);
    if (openAiKey && !flags.local && !flags.openai && process.stdin.isTTY && !flags.json) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question(`Chave OPENAI_API_KEY detectada no ambiente. Deseja usar OpenAI Whisper para transcrição rápida? [S/n]: `, resolve);
      });
      rl.close();
      useOpenAi = !answer.trim() || answer.trim().toLowerCase().startsWith('s');
    } else if (openAiKey && !flags.local && !flags.openai) {
      useOpenAi = true;
    }

    const tmpAudio = path.join(os.tmpdir(), `usk-transcribe-${crypto.randomBytes(4).toString('hex')}.mp3`);
    let words = [];
    try {
      execFileSync('ffmpeg', ['-y', '-i', resolvedSrc, '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k', tmpAudio], { stdio: 'ignore' });
      words = await transcribeAudio(tmpAudio, {
        apiKey: openAiKey,
        useOpenai: useOpenAi,
        srtPath: flags.captions,
      });
    } finally {
      if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio);
    }

    const segments = [];
    let segId = 1;
    let currentWords = [];
    let segStart = null;
    let segEnd = null;

    for (const w of words) {
      const text = (w.word || w.text || '').trim();
      if (!text) continue;
      if (segStart === null) segStart = w.start;
      if (segEnd !== null && (w.start - segEnd > 1.0 || segEnd - segStart > 7.0)) {
        segments.push({
          id: segId++,
          start_s: parseFloat(segStart.toFixed(2)),
          end_s: parseFloat(segEnd.toFixed(2)),
          duration_s: parseFloat((segEnd - segStart).toFixed(2)),
          text: currentWords.join(' '),
        });
        currentWords = [];
        segStart = w.start;
      }
      currentWords.push(text);
      segEnd = w.end;
    }

    if (currentWords.length > 0 && segStart !== null) {
      segments.push({
        id: segId++,
        start_s: parseFloat(segStart.toFixed(2)),
        end_s: parseFloat(segEnd.toFixed(2)),
        duration_s: parseFloat((segEnd - segStart).toFixed(2)),
        text: currentWords.join(' '),
      });
    }

    const fullText = segments.map((s) => s.text).join(' ');
    const transcriptReport = {
      file: path.basename(resolvedSrc),
      duration_s: duration,
      words_count: words.length,
      segments_count: segments.length,
      full_text: fullText,
      segments,
      words,
    };

    const outJsonPath = path.join(wsDir, 'packages', 'transcript.json');
    fs.writeFileSync(outJsonPath, JSON.stringify(transcriptReport, null, 2) + '\n');

    const outSrtPath = path.join(wsDir, 'packages', 'transcript.srt');
    const srtLines = segments.map((s) => {
      const fmtTime = (sec) => {
        const h = String(Math.floor(sec / 3600)).padStart(2, '0');
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const sRem = sec % 60;
        const sInt = String(Math.floor(sRem)).padStart(2, '0');
        const ms = String(Math.round((sRem - Math.floor(sRem)) * 1000)).padStart(3, '0');
        return `${h}:${m}:${sInt},${ms}`;
      };
      return `${s.id}\n${fmtTime(s.start_s)} --> ${fmtTime(s.end_s)}\n${s.text}\n`;
    }).join('\n');
    fs.writeFileSync(outSrtPath, srtLines);

    if (flags.json) {
      console.log(JSON.stringify(transcriptReport, null, 2));
      return transcriptReport;
    }
    console.log(`Transcrição concluída para ${transcriptReport.file}:`);
    console.log(`- Duração Total: ${duration.toFixed(2)}s`);
    console.log(`- Palavras Reconhecidas: ${words.length}`);
    console.log(`- Segmentos para Análise de Copy: ${segments.length}`);
    console.log(`- Salvo em: packages/transcript.json e packages/transcript.srt`);
    return transcriptReport;
  }

  if (sub === 'find-hooks') {
    const inputPath = positionals[1];
    if (!inputPath) {
      console.error('Error: Missing file. Usage: esquadrao studio find-hooks <video.mp4 | transcript.json> [options]');
      process.exit(1);
    }
    const resolvedInput = path.resolve(inputPath);
    if (!fs.existsSync(resolvedInput)) {
      console.error(`Error: File not found: ${inputPath}`);
      process.exit(1);
    }

    const wsDir = findWorkspaceDir(flags.dest);
    let segments = [];
    if (resolvedInput.endsWith('.json')) {
      const parsed = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
      segments = parsed.segments || (Array.isArray(parsed) ? parsed : []);
    } else {
      const transRes = await run({ positionals: ['transcribe', resolvedInput], flags: { dest: wsDir, json: true } });
      segments = transRes.segments || [];
    }

    const minDur = parseFloat(flags['min-dur'] || '30');
    const maxDur = parseFloat(flags['max-dur'] || '60');
    const candidates = findCandidateClips(segments, { minDurationSec: minDur, maxDurationSec: maxDur });

    const report = {
      file: path.basename(resolvedInput),
      total_segments: segments.length,
      candidates_count: candidates.length,
      top_clips: candidates.slice(0, 5),
    };

    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
      return report;
    }
    console.log(`Detecção de Ganchos de Copy para ${report.file}:`);
    console.log(`- Segmentos analisados: ${report.total_segments}`);
    console.log(`- Cortes virais identificados (${minDur}s - ${maxDur}s): ${report.candidates_count}`);
    candidates.slice(0, 3).forEach((c, idx) => {
      console.log(`\n[Opção ${idx + 1}] Duração: ${c.duration_s}s (De ${c.start_s}s a ${c.end_s}s) | Score: ${c.hook_score}`);
      console.log(`  Gancho: "${c.hook_text}"`);
      console.log(`  Punchline: "${c.punchline_text}"`);
    });
    return report;
  }

  if (sub === 'auto-clip') {
    const srcFile = positionals[1];
    if (!srcFile) {
      console.error('Error: Missing video file. Usage: esquadrao studio auto-clip <video.mp4> [options]');
      process.exit(1);
    }
    const resolvedSrc = path.resolve(srcFile);
    if (!fs.existsSync(resolvedSrc)) {
      console.error(`Error: Source video file not found: ${srcFile}`);
      process.exit(1);
    }

    if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
      console.error('Error: ffmpeg/ffprobe not found. Install ffmpeg to use video studio features.');
      process.exit(1);
    }

    const wsDir = findWorkspaceDir(flags.dest);
    const silentIfJson = async (fn) => {
      if (!flags.json) return await fn();
      const orig = console.log;
      console.log = () => {};
      try { return await fn(); } finally { console.log = orig; }
    };

    // 1. Ingest asset
    const assetRecord = await silentIfJson(() => run({ positionals: ['import', resolvedSrc], flags: { dest: wsDir, json: false } }));
    if (!assetRecord || !assetRecord.id) {
      console.error('Error: Failed to import source video into workspace.');
      process.exit(1);
    }
    const assetPath = path.join(wsDir, assetRecord.path);
    const totalDurationSec = assetRecord.metadata?.duration_s || 0;

    // 2. Silence detection
    const silenceThresh = flags['silence-thresh'] || '-30dB';
    const silenceDuration = parseFloat(flags['silence-duration'] || '0.8');
    const silences = detectSilence(assetPath, { noiseThreshold: silenceThresh, minDurationSec: silenceDuration });
    const speechIntervals = computeSpeechIntervals(totalDurationSec, silences);

    // 3. Audio transcription decision (OpenAI vs Local vs SRT)
    let words = [];
    const openAiKey = process.env.OPENAI_API_KEY;
    let useOpenAi = Boolean(flags.openai);

    if (openAiKey && !flags.local && !flags.openai && process.stdin.isTTY && !flags.json) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question(`Chave OPENAI_API_KEY detectada no ambiente. Deseja usar OpenAI Whisper para transcrição rápida? [S/n]: `, resolve);
      });
      rl.close();
      useOpenAi = !answer.trim() || answer.trim().toLowerCase().startsWith('s');
    } else if (openAiKey && !flags.local && !flags.openai) {
      useOpenAi = true;
    }

    const tmpAudio = path.join(os.tmpdir(), `usk-audio-${crypto.randomBytes(4).toString('hex')}.mp3`);
    try {
      execFileSync('ffmpeg', ['-y', '-i', assetPath, '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k', tmpAudio], { stdio: 'ignore' });
      words = await transcribeAudio(tmpAudio, {
        apiKey: openAiKey,
        useOpenai: useOpenAi,
        srtPath: flags.captions,
      });
    } catch (err) {
      if (!flags.json) console.warn(`[Warning] Transcription skipped or failed: ${err.message}`);
    } finally {
      if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio);
    }

    // 4. Captions grouping and remapping
    const captionStyle = flags['caption-style'] || 'impact'; // Option A: impact default
    const rawCaptions = groupWordsIntoCaptions(words, { maxWords: 3, captionStyle });
    const remappedCaptions = remapCaptionsToSpeechTimeline(rawCaptions, speechIntervals);

    // Handle broll overlays if flags.broll provided
    const overlays = [];
    if (flags.broll) {
      const brollFiles = Array.isArray(flags.broll) ? flags.broll : [flags.broll];
      let brollIdx = 0;
      let overlayCursorSec = 4.0;
      const totalTimelineSec = speechIntervals.reduce((acc, s) => acc + s.durationSec, 0);

      while (overlayCursorSec < totalTimelineSec - 3.0 && brollIdx < brollFiles.length * 3) {
        const fileToUse = brollFiles[brollIdx % brollFiles.length];
        const brollAsset = await silentIfJson(() => run({ positionals: ['import', path.resolve(fileToUse)], flags: { dest: wsDir, json: false } }));
        if (brollAsset && brollAsset.id) {
          const ovDurSec = Math.min(3.0, (brollAsset.metadata?.duration_s || 3.0));
          overlays.push({
            asset_id: brollAsset.id,
            layout: 'fullscreen',
            in_ms: 0,
            out_ms: Math.round(ovDurSec * 1000),
            timeline_start_ms: Math.round(overlayCursorSec * 1000),
            duration_ms: Math.round(ovDurSec * 1000),
          });
        }
        overlayCursorSec += 7.0;
        brollIdx++;
      }
    }

    // Handle background music if flags.music provided
    const musicTracks = [];
    if (flags.music) {
      const musicAsset = await silentIfJson(() => run({ positionals: ['import', path.resolve(flags.music)], flags: { dest: wsDir, json: false } }));
      if (musicAsset && musicAsset.id) {
        musicTracks.push({
          asset_id: musicAsset.id,
          gain_db: -22,
          ducking: true,
        });
      }
    }

    // 5. Build and validate EditPlan
    const format = flags.format || '9:16';
    const plan = buildAutoClipPlan({
      asset: assetRecord,
      speechIntervals,
      captions: remappedCaptions,
      format,
      overlays,
      musicTracks,
    });
    validateEditPlan(plan);

    const packagesDir = path.join(wsDir, 'packages');
    fs.mkdirSync(packagesDir, { recursive: true });
    const planPath = path.join(packagesDir, 'autoclip-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');

    // 6. Render
    const artifact = await silentIfJson(() => run({ positionals: ['render', planPath], flags: { dest: wsDir, json: false, verbose: flags.verbose } }));
    if (!artifact || !artifact.path) {
      throw new Error('Failed to render auto-clip video artifact');
    }

    // 7. QA
    const fullArtifactPath = path.resolve(wsDir, artifact.path);
    const qaReport = await silentIfJson(() => run({ positionals: ['qa', fullArtifactPath], flags: { dest: wsDir, plan: planPath, json: false, verbose: flags.verbose } }));

    const totalSilenceSec = silences.reduce((acc, s) => acc + s.duration, 0);
    const result = {
      status: 'ok',
      asset_id: assetRecord.id,
      original_duration_s: totalDurationSec,
      silences_detected: silences.length,
      silence_cut_s: parseFloat(totalSilenceSec.toFixed(3)),
      speech_clips_count: speechIntervals.length,
      captions_count: remappedCaptions.length,
      artifact,
      qa: qaReport,
    };

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    console.log(`Auto-clip concluído com sucesso!`);
    console.log(`- Duração Original: ${totalDurationSec.toFixed(2)}s`);
    console.log(`- Silêncios Removidos: ${silences.length} (${totalSilenceSec.toFixed(2)}s cortados)`);
    console.log(`- Cortes Contíguos: ${speechIntervals.length}`);
    console.log(`- Legendas Sincronizadas: ${remappedCaptions.length} (${captionStyle})`);
    console.log(`- Artefato: ${artifact.path}`);
    console.log(`- QA: ${qaReport?.passed ? 'Aprovado ✓' : 'Falha ✗'}`);
    return result;
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
        let speechA = '[outa]';
        if (videoClips.length === 1) {
          baseV = '[v0]';
          filterParts.push(`[a0]anull[outa_speech]`);
          speechA = '[outa_speech]';
        } else {
          filterParts.push(`${concatInputs.join('')}concat=n=${videoClips.length}:v=1:a=1[concatv][outa_speech]`);
          speechA = '[outa_speech]';
        }

        // B-Roll Overlays
        let currentV = baseV;
        let nextInputIdx = videoClips.length;
        if (plan.overlays && Array.isArray(plan.overlays) && plan.overlays.length > 0) {
          for (let k = 0; k < plan.overlays.length; k++) {
            const ov = plan.overlays[k];
            const ovPath = resolveAsset(wsDir, ov);
            inputArgs.push('-i', ovPath);
            const inSec = ((ov.in_ms || 0) / 1000).toFixed(3);
            const outSec = ((ov.out_ms || (ov.in_ms || 0) + 3000) / 1000).toFixed(3);
            const startSec = ((ov.timeline_start_ms || 0) / 1000).toFixed(3);
            const durMs = ov.duration_ms || (ov.out_ms - ov.in_ms);
            const endSec = (((ov.timeline_start_ms || 0) + durMs) / 1000).toFixed(3);
            const layout = ov.layout || 'fullscreen';

            if (layout === 'pip') {
              const pipW = Math.round(width * 0.7);
              const pipH = Math.round(height * 0.35);
              filterParts.push(`[${nextInputIdx}:v]trim=start=${inSec}:end=${outSec},setpts=PTS-STARTPTS,scale=${pipW}:${pipH}:force_original_aspect_ratio=decrease,pad=${pipW}:${pipH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[ov_${k}]`);
              filterParts.push(`${currentV}[ov_${k}]overlay=(W-w)/2:(H-h)/2:enable='between(t\\,${startSec}\\,${endSec})'[v_ov_${k}]`);
            } else if (layout === 'split_bottom') {
              const splitH = Math.round(height / 2);
              filterParts.push(`[${nextInputIdx}:v]trim=start=${inSec}:end=${outSec},setpts=PTS-STARTPTS,scale=${width}:${splitH}:force_original_aspect_ratio=decrease,pad=${width}:${splitH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[ov_${k}]`);
              filterParts.push(`${currentV}[ov_${k}]overlay=0:${splitH}:enable='between(t\\,${startSec}\\,${endSec})'[v_ov_${k}]`);
            } else {
              // Fullscreen default
              filterParts.push(`[${nextInputIdx}:v]trim=start=${inSec}:end=${outSec},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[ov_${k}]`);
              filterParts.push(`${currentV}[ov_${k}]overlay=0:0:enable='between(t\\,${startSec}\\,${endSec})'[v_ov_${k}]`);
            }
            currentV = `[v_ov_${k}]`;
            nextInputIdx++;
          }
        }

        filterParts.push(buildCaptionFilters(captions, currentV, tempFiles));

        // Background Music Tracks with Ducking
        let finalA = speechA;
        if (plan.music_tracks && Array.isArray(plan.music_tracks) && plan.music_tracks.length > 0) {
          for (let m = 0; m < plan.music_tracks.length; m++) {
            const track = plan.music_tracks[m];
            const trackPath = resolveAsset(wsDir, track);
            inputArgs.push('-i', trackPath);
            const mGain = track.gain_db !== undefined ? track.gain_db : -22;
            filterParts.push(`[${nextInputIdx}:a]volume=${mGain}dB,aloop=loop=-1:size=2e+09[mus_${m}]`);
            filterParts.push(`${finalA}[mus_${m}]amix=inputs=2:duration=first:dropout_transition=2[outa_mix_${m}]`);
            finalA = `[outa_mix_${m}]`;
            nextInputIdx++;
          }
        }
        filterParts.push(`${finalA}anull[outa]`);

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

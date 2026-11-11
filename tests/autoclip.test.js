import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  detectSilence,
  computeSpeechIntervals,
  groupWordsIntoCaptions,
  remapCaptionsToSpeechTimeline,
  parseSrt,
  buildAutoClipPlan,
  checkBinary,
} from '../src/commands/studio.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');

function createSyntheticAudioVideo(destPath, { tone1 = 1.5, silence = 1.0, tone2 = 1.5 } = {}) {
  // Uses lavfi to generate: tone (1.5s) + silence (1.0s) + tone (1.5s) = 4.0s
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `color=c=blue:s=1080x1920:r=30:d=${tone1 + silence + tone2}`,
    '-f', 'lavfi', '-i', `sine=frequency=1000:duration=${tone1}`,
    '-f', 'lavfi', '-i', `anullsrc=duration=${silence}`,
    '-f', 'lavfi', '-i', `sine=frequency=1000:duration=${tone2}`,
    '-filter_complex', '[1:a][2:a][3:a]concat=n=3:v=0:a=1[outa]',
    '-map', '0:v',
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    destPath,
  ], { stdio: 'ignore' });
}

test('Auto-Clip: computeSpeechIntervals cuts silence gaps accurately', () => {
  const silences = [
    { start: 1.5, end: 2.5, duration: 1.0 },
    { start: 4.0, end: 5.0, duration: 1.0 },
  ];
  const speech = computeSpeechIntervals(6.0, silences, { minSpeechSec: 0.3 });
  assert.equal(speech.length, 3);
  assert.deepEqual(speech[0], { startSec: 0, endSec: 1.5, durationSec: 1.5 });
  assert.deepEqual(speech[1], { startSec: 2.5, endSec: 4.0, durationSec: 1.5 });
  assert.deepEqual(speech[2], { startSec: 5.0, endSec: 6.0, durationSec: 1.0 });
});

test('Auto-Clip: groupWordsIntoCaptions formats Style A (impact) 2-4 words in uppercase', () => {
  const words = [
    { word: 'vídeo', start: 0.1, end: 0.4 },
    { word: 'longo', start: 0.4, end: 0.7 },
    { word: 'parado', start: 0.7, end: 1.1 },
    { word: 'não', start: 1.2, end: 1.4 },
    { word: 'dá', start: 1.4, end: 1.6 },
    { word: 'view', start: 1.6, end: 2.0 },
  ];

  const impactCaptions = groupWordsIntoCaptions(words, { maxWords: 3, captionStyle: 'impact' });
  assert.equal(impactCaptions.length, 2);
  assert.equal(impactCaptions[0].text, 'VÍDEO LONGO PARADO');
  assert.equal(impactCaptions[0].startSec, 0.1);
  assert.equal(impactCaptions[0].style, 'impact');
  assert.equal(impactCaptions[1].text, 'NÃO DÁ VIEW');
  assert.equal(impactCaptions[1].startSec, 1.2);
});

test('Auto-Clip: groupWordsIntoCaptions formats Style B (word) single word per card', () => {
  const words = [
    { word: 'corte', start: 0.1, end: 0.5 },
    { word: 'rápido', start: 0.5, end: 0.9 },
  ];
  const wordCaptions = groupWordsIntoCaptions(words, { captionStyle: 'word' });
  assert.equal(wordCaptions.length, 2);
  assert.equal(wordCaptions[0].text, 'CORTE');
  assert.equal(wordCaptions[1].text, 'RÁPIDO');
});

test('Auto-Clip: remapCaptionsToSpeechTimeline accurately syncs captions after silence purge', () => {
  const speechIntervals = [
    { startSec: 0.0, endSec: 2.0, durationSec: 2.0 },
    // 1.5s silence excised between 2.0 and 3.5
    { startSec: 3.5, endSec: 6.0, durationSec: 2.5 },
  ];

  const rawCaptions = [
    { text: 'COMEÇO DO VÍDEO', startSec: 0.2, endSec: 1.8, style: 'impact' },
    { text: 'DURANTE PAUSA', startSec: 2.2, endSec: 3.2, style: 'impact' }, // falls inside silence, must drop
    { text: 'SEGUNDO BLOCO', startSec: 4.0, endSec: 5.5, style: 'impact' }, // 0.5s into second seg -> should start at 2500ms
  ];

  const remapped = remapCaptionsToSpeechTimeline(rawCaptions, speechIntervals);
  assert.equal(remapped.length, 2);
  assert.equal(remapped[0].text, 'COMEÇO DO VÍDEO');
  assert.equal(remapped[0].timeline_start_ms, 200);

  assert.equal(remapped[1].text, 'SEGUNDO BLOCO');
  assert.equal(remapped[1].timeline_start_ms, 2500); // 2000 + (4000 - 3500) = 2500ms
});

test('Auto-Clip: parseSrt parses standard SubRip format into word timestamps', () => {
  const srt = `1\n00:00:01,000 --> 00:00:03,000\nOlá criador de conteúdo\n\n2\n00:00:03,500 --> 00:00:05,000\nCorte de silêncios\n`;
  const items = parseSrt(srt);
  assert.ok(items.length >= 7);
  assert.equal(items[0].word, 'Olá');
  assert.equal(items[0].start, 1.0);
});

test('Auto-Clip: buildAutoClipPlan creates compliant podcast_clip schema v1', () => {
  const asset = { id: 'AST-TEST01' };
  const speechIntervals = [
    { startSec: 0, endSec: 2, durationSec: 2 },
    { startSec: 3, endSec: 5, durationSec: 2 },
  ];
  const captions = [
    { text: 'TAKE 1', timeline_start_ms: 0, duration_ms: 1500 },
    { text: 'TAKE 2', timeline_start_ms: 2000, duration_ms: 1500 },
  ];

  const plan = buildAutoClipPlan({ asset, speechIntervals, captions, format: '9:16' });
  assert.equal(plan.schema_version, 1);
  assert.equal(plan.mode, 'podcast_clip');
  assert.equal(plan.output.width, 1080);
  assert.equal(plan.output.height, 1920);
  assert.equal(plan.clips.length, 2);
  assert.equal(plan.clips[0].in_ms, 0);
  assert.equal(plan.clips[0].out_ms, 2000);
  assert.equal(plan.clips[1].in_ms, 3000);
  assert.equal(plan.clips[1].out_ms, 5000);
  assert.equal(plan.clips[1].timeline_start_ms, 2000);
});

test('Auto-Clip: detectSilence finds pauses in synthetic audio/video', (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclip-detect-'));
  const testVid = path.join(tmpDir, 'silence_test.mp4');

  try {
    createSyntheticAudioVideo(testVid, { tone1: 1.2, silence: 1.0, tone2: 1.2 });
    const silences = detectSilence(testVid, { noiseThreshold: '-30dB', minDurationSec: 0.8 });
    assert.ok(silences.length >= 1, 'Should detect at least 1 silence period');
    assert.ok(silences[0].start >= 0.9 && silences[0].start <= 1.5, `Silence start was ${silences[0].start}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Auto-Clip: studio auto-clip end-to-end renders video and passes QA', (t) => {
  if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
    t.skip('ffmpeg/ffprobe not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclip-e2e-'));
  const testVid = path.join(tmpDir, 'source.mp4');
  const srtFile = path.join(tmpDir, 'captions.srt');

  try {
    createSyntheticAudioVideo(testVid, { tone1: 1.5, silence: 1.0, tone2: 1.5 });
    // Write an SRT file matching speech intervals
    fs.writeFileSync(srtFile, `1\n00:00:00,100 --> 00:00:01,400\nVídeo longo parado\n\n2\n00:00:02,600 --> 00:00:03,900\nEsteira automática corta\n`, 'utf8');

    // Run studio auto-clip via CLI
    const res = spawnSync(process.execPath, [
      binPath,
      'studio',
      'auto-clip',
      testVid,
      '--dest', tmpDir,
      '--captions', srtFile,
      '--silence-thresh', '-30dB',
      '--silence-duration', '0.8',
      '--json',
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0, `CLI auto-clip failed: ${res.stderr || res.stdout}`);
    const report = JSON.parse(res.stdout);
    assert.equal(report.status, 'ok');
    assert.ok(report.silences_detected >= 1, 'Silences should be detected');
    assert.ok(report.speech_clips_count >= 2, 'Speech clips should be split');
    assert.ok(report.captions_count >= 1, 'Captions should be remapped');
    assert.equal(report.qa.passed, true, 'Rendered video must pass QA');
    assert.ok(fs.existsSync(path.join(tmpDir, report.artifact.path)));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Auto-Clip: studio detect-silence CLI command returns JSON report', (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclip-cli-'));
  const testVid = path.join(tmpDir, 'source.mp4');

  try {
    createSyntheticAudioVideo(testVid, { tone1: 1.0, silence: 1.0, tone2: 1.0 });
    const res = spawnSync(process.execPath, [
      binPath,
      'studio',
      'detect-silence',
      testVid,
      '--silence-thresh', '-30dB',
      '--silence-duration', '0.8',
      '--json',
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0, `CLI detect-silence failed: ${res.stderr}`);
    const report = JSON.parse(res.stdout);
    assert.equal(report.file, 'source.mp4');
    assert.ok(report.silences_count >= 1);
    assert.ok(report.speech_segments_count >= 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Auto-Clip: fails fast without any caption source and suggests explicit options', (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclip-strict-'));
  const testVid = path.join(tmpDir, 'source.mp4');
  try {
    createSyntheticAudioVideo(testVid);
    const res = spawnSync(process.execPath, [binPath, 'studio', 'auto-clip', testVid, '--dest', path.join(tmpDir, 'ws')], {
      encoding: 'utf8',
      env: { ...process.env, OPENAI_API_KEY: '' },
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /--captions|--no-captions/);
    assert.equal(fs.existsSync(path.join(tmpDir, 'ws', 'assets')), false, 'must fail before importing');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Auto-Clip: --no-captions renders a real cut with zero captions', (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclip-nocap-'));
  const testVid = path.join(tmpDir, 'source.mp4');
  try {
    createSyntheticAudioVideo(testVid);
    const res = spawnSync(process.execPath, [binPath, 'studio', 'auto-clip', testVid, '--dest', path.join(tmpDir, 'ws'), '--no-captions', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, OPENAI_API_KEY: '' },
    });
    assert.equal(res.status, 0, res.stderr);
    const report = JSON.parse(res.stdout);
    assert.equal(report.status, 'ok');
    assert.equal(report.caption_mode, 'none');
    assert.equal(report.captions_count, 0);
    assert.equal(report.pipeline, 'auto-clip');
    assert.ok(fs.existsSync(path.join(tmpDir, 'ws', report.artifact.path)));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Auto-Clip: --local fails with actionable error when engine is absent', async (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const { hasLocalTranscriber } = await import('../src/commands/studio.js');
  if (await hasLocalTranscriber()) {
    t.skip('@xenova/transformers is installed');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclip-local-'));
  const testVid = path.join(tmpDir, 'source.mp4');
  try {
    createSyntheticAudioVideo(testVid);
    const res = spawnSync(process.execPath, [binPath, 'studio', 'auto-clip', testVid, '--dest', path.join(tmpDir, 'ws'), '--local'], {
      encoding: 'utf8',
      env: { ...process.env, OPENAI_API_KEY: '' },
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /@xenova\/transformers/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Transcribe: fails with actionable error without a caption source', (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-strict-'));
  const testVid = path.join(tmpDir, 'source.mp4');
  try {
    createSyntheticAudioVideo(testVid);
    const res = spawnSync(process.execPath, [binPath, 'studio', 'transcribe', testVid, '--dest', path.join(tmpDir, 'ws')], {
      encoding: 'utf8',
      env: { ...process.env, OPENAI_API_KEY: '' },
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Transcrição requer/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Onboard: podcast_clip uses the real auto-clip pipeline', (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onboard-auto-'));
  const testVid = path.join(tmpDir, 'source.mp4');
  try {
    createSyntheticAudioVideo(testVid);
    const res = spawnSync(process.execPath, [binPath, 'onboard', '--mode', 'podcast_clip', '--file', testVid, '--dest', path.join(tmpDir, 'ws'), '--no-captions', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, OPENAI_API_KEY: '' },
    });
    assert.equal(res.status, 0, res.stderr);
    const report = JSON.parse(res.stdout);
    assert.equal(report.status, 'ok');
    assert.equal(report.pipeline, 'auto-clip');
    assert.equal(report.caption_mode, 'none');
    assert.equal(report.qa.passed, true);
    assert.ok(fs.existsSync(path.join(tmpDir, 'ws', report.artifact.path)));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

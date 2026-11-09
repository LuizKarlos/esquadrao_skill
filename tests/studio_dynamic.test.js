import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { checkBinary } from '../src/commands/studio.js';
import { validateEditPlan } from '../src/roles/mediaProducer.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');

function createTestMedia(dir) {
  // 1. Base video (3s, red with sine audio 400Hz)
  const baseVid = path.join(dir, 'speaker.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=red:s=1080x1920:r=30:d=3',
    '-f', 'lavfi', '-i', 'sine=frequency=400:duration=3',
    '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p',
    baseVid,
  ], { stdio: 'ignore' });

  // 2. B-roll video (2s, green)
  const brollVid = path.join(dir, 'broll.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=green:s=1080x1920:r=30:d=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    brollVid,
  ], { stdio: 'ignore' });

  // 3. Music track (3s, soft tone 800Hz)
  const musicFile = path.join(dir, 'trilha.mp3');
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=800:duration=3',
    '-c:a', 'libmp3lame',
    musicFile,
  ], { stdio: 'ignore' });

  return { baseVid, brollVid, musicFile };
}

test('Dynamic Studio: validateEditPlan accepts overlays and music_tracks', () => {
  const plan = {
    schema_version: 1,
    mode: 'podcast_clip',
    output: {
      width: 1080,
      height: 1920,
      fps_num: 30,
      fps_den: 1,
      video_codec: 'h264',
      audio_codec: 'aac',
    },
    clips: [
      {
        kind: 'video',
        clip_id: 'c1',
        asset_id: 'AST-SPEAKER',
        in_ms: 0,
        out_ms: 3000,
        timeline_start_ms: 0,
        speed: 1,
      },
    ],
    audio_tracks: [
      { kind: 'source', clip_id: 'c1', gain_db: 0 },
    ],
    overlays: [
      {
        asset_id: 'AST-BROLL',
        layout: 'fullscreen',
        in_ms: 0,
        out_ms: 1500,
        timeline_start_ms: 1000,
        duration_ms: 1500,
      },
    ],
    music_tracks: [
      {
        asset_id: 'AST-MUSIC',
        gain_db: -22,
        ducking: true,
      },
    ],
    captions: [
      { text: 'TESTE DINÂMICO', timeline_start_ms: 0, duration_ms: 2000, style: 'impact' },
    ],
  };

  assert.equal(validateEditPlan(plan), true);
});

test('Dynamic Studio: studio transcribe extracts structured transcript and SRT', (t) => {
  if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
    t.skip('ffmpeg/ffprobe not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-test-'));
  const testVid = path.join(tmpDir, 'speech.mp4');
  const captionsSrt = path.join(tmpDir, 'input.srt');

  try {
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:r=30:d=4',
      '-f', 'lavfi', '-i', 'sine=frequency=500:duration=4',
      '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p',
      testVid,
    ], { stdio: 'ignore' });

    fs.writeFileSync(captionsSrt, `1\n00:00:00,500 --> 00:00:02,000\nO maior erro de todos\n\n2\n00:00:02,200 --> 00:00:03,800\nPara ter resultado consistente\n`, 'utf8');

    const res = spawnSync(process.execPath, [
      binPath,
      'studio',
      'transcribe',
      testVid,
      '--dest', tmpDir,
      '--captions', captionsSrt,
      '--json',
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0, `CLI transcribe failed: ${res.stderr || res.stdout}`);
    const report = JSON.parse(res.stdout);
    assert.equal(report.file, 'speech.mp4');
    assert.ok(report.words_count >= 6, 'Words must be parsed');
    assert.ok(report.segments_count >= 1, 'Segments must be created');
    assert.ok(fs.existsSync(path.join(tmpDir, 'packages', 'transcript.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'packages', 'transcript.srt')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Dynamic Studio: renders podcast_clip with B-roll overlay, music ducking and captions', (t) => {
  if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
    t.skip('ffmpeg/ffprobe not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dynamic-render-'));

  try {
    const { baseVid, brollVid, musicFile } = createTestMedia(tmpDir);

    // Initialize workspace
    spawnSync(process.execPath, [binPath, 'studio', 'init', '--dest', tmpDir, '--json']);

    // Import assets
    const resA = spawnSync(process.execPath, [binPath, 'studio', 'import', baseVid, '--dest', tmpDir, '--json'], { encoding: 'utf8' });
    const resB = spawnSync(process.execPath, [binPath, 'studio', 'import', brollVid, '--dest', tmpDir, '--json'], { encoding: 'utf8' });
    const resM = spawnSync(process.execPath, [binPath, 'studio', 'import', musicFile, '--dest', tmpDir, '--json'], { encoding: 'utf8' });

    const astBase = JSON.parse(resA.stdout);
    const astBroll = JSON.parse(resB.stdout);
    const astMusic = JSON.parse(resM.stdout);

    const plan = {
      schema_version: 1,
      mode: 'podcast_clip',
      output: {
        width: 1080,
        height: 1920,
        fps_num: 30,
        fps_den: 1,
        video_codec: 'h264',
        audio_codec: 'aac',
      },
      clips: [
        {
          kind: 'video',
          clip_id: 'speaker-01',
          asset_id: astBase.id,
          in_ms: 0,
          out_ms: 3000,
          timeline_start_ms: 0,
          speed: 1,
        },
      ],
      audio_tracks: [
        { kind: 'source', clip_id: 'speaker-01', gain_db: 0 },
      ],
      overlays: [
        {
          asset_id: astBroll.id,
          layout: 'fullscreen',
          in_ms: 0,
          out_ms: 1500,
          timeline_start_ms: 1000,
          duration_ms: 1500,
        },
      ],
      music_tracks: [
        {
          asset_id: astMusic.id,
          gain_db: -22,
          ducking: true,
        },
      ],
      captions: [
        {
          text: 'GANCHO VIRAL',
          timeline_start_ms: 200,
          duration_ms: 1200,
          style: 'impact',
        },
        {
          text: 'CENA DE APOIO',
          timeline_start_ms: 1400,
          duration_ms: 1400,
          style: 'impact',
        },
      ],
    };

    const planPath = path.join(tmpDir, 'packages', 'dynamic-plan.json');
    fs.mkdirSync(path.join(tmpDir, 'packages'), { recursive: true });
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

    const renderRes = spawnSync(process.execPath, [
      binPath,
      'studio',
      'render',
      planPath,
      '--dest', tmpDir,
      '--json',
    ], { encoding: 'utf8' });

    assert.equal(renderRes.status, 0, `Render failed: ${renderRes.stderr || renderRes.stdout}`);
    const artifact = JSON.parse(renderRes.stdout);
    assert.ok(artifact.path, 'Artifact must have path');

    // Run QA
    const qaRes = spawnSync(process.execPath, [
      binPath,
      'studio',
      'qa',
      path.join(tmpDir, artifact.path),
      '--plan', planPath,
      '--dest', tmpDir,
      '--json',
    ], { encoding: 'utf8' });

    assert.equal(qaRes.status, 0, `QA failed: ${qaRes.stderr}`);
    const qaReport = JSON.parse(qaRes.stdout);
    assert.equal(qaReport.passed, true, 'Dynamic video must pass all QA checks');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

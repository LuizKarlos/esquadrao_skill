import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { buildMusicFilters, checkBinary } from '../src/commands/studio.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');

function runCli(args) {
  return spawnSync(process.execPath, [binPath, ...args], { encoding: 'utf8' });
}

function makeVideo(dest, { color = 'red', duration = 2, frequency = 440 } = {}) {
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `color=c=${color}:s=1080x1920:r=30:d=${duration}`,
    '-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${duration}`,
    '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p',
    dest,
  ], { stdio: 'ignore' });
}

function initAndImport(dir, files) {
  const init = runCli(['studio', 'init', '--dest', dir, '--json']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  return files.map((file) => {
    const res = runCli(['studio', 'import', file, '--dest', dir, '--json']);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    return JSON.parse(res.stdout);
  });
}

test('Music: ducking uses sidechaincompress, fixed gain does not', () => {
  const ducked = buildMusicFilters({
    speechLabel: '[outa_speech]',
    tracks: [{ asset_id: 'AST-MUSIC', gain_db: -22, ducking: true }],
    startInputIndex: 2,
    durationSec: 4,
  });
  const duckedGraph = ducked.parts.join(';');
  assert.match(duckedGraph, /sidechaincompress=/);
  assert.match(duckedGraph, /atrim=duration=4\.000/);
  assert.equal(ducked.finalA, '[outa_mix_0]');

  const fixed = buildMusicFilters({
    speechLabel: '[outa_speech]',
    tracks: [{ asset_id: 'AST-MUSIC', gain_db: -22, ducking: false }],
    startInputIndex: 2,
    durationSec: 4,
  });
  assert.equal(fixed.parts.join(';').includes('sidechaincompress'), false);
});

test('Split top: renders speaker at bottom and B-roll at top with QA', (t) => {
  if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
    t.skip('ffmpeg/ffprobe not found');
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-top-'));
  try {
    const base = path.join(dir, 'speaker.mp4');
    const broll = path.join(dir, 'broll.mp4');
    makeVideo(base, { color: 'red', duration: 2, frequency: 440 });
    makeVideo(broll, { color: 'blue', duration: 1, frequency: 880 });
    const [astBase, astBroll] = initAndImport(dir, [base, broll]);

    const plan = {
      schema_version: 1,
      mode: 'podcast_clip',
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
      clips: [{ kind: 'video', clip_id: 'speaker-01', asset_id: astBase.id, in_ms: 0, out_ms: 2000, timeline_start_ms: 0, speed: 1 }],
      audio_tracks: [{ kind: 'source', clip_id: 'speaker-01', gain_db: 0 }],
      overlays: [{ asset_id: astBroll.id, layout: 'split_top', in_ms: 0, out_ms: 2000, timeline_start_ms: 0, duration_ms: 2000, loop: true }],
    };
    const planPath = path.join(dir, 'packages', 'split-top.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

    const res = runCli(['studio', 'render', planPath, '--dest', dir, '--json']);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const report = JSON.parse(res.stdout);
    assert.ok(fs.existsSync(path.join(dir, report.path)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Batch: renders every plan in a directory and aggregates the report', (t) => {
  if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
    t.skip('ffmpeg/ffprobe not found');
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-batch-'));
  try {
    const base = path.join(dir, 'speaker.mp4');
    const broll = path.join(dir, 'broll.mp4');
    makeVideo(base, { color: 'green', duration: 1, frequency: 440 });
    makeVideo(broll, { color: 'yellow', duration: 1, frequency: 880 });
    const [astBase, astBroll] = initAndImport(dir, [base, broll]);

    const output = { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' };
    const basePlan = {
      schema_version: 1,
      mode: 'podcast_clip',
      output,
      clips: [{ kind: 'video', clip_id: 'c1', asset_id: astBase.id, in_ms: 0, out_ms: 1000, timeline_start_ms: 0, speed: 1 }],
      audio_tracks: [{ kind: 'source', clip_id: 'c1', gain_db: 0 }],
    };
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, 'a-fullscreen.json'), JSON.stringify({
      ...basePlan,
      overlays: [{ asset_id: astBroll.id, layout: 'fullscreen', in_ms: 0, out_ms: 500, timeline_start_ms: 0, duration_ms: 500 }],
    }, null, 2));
    fs.writeFileSync(path.join(plansDir, 'b-split-top.json'), JSON.stringify({
      ...basePlan,
      overlays: [{ asset_id: astBroll.id, layout: 'split_top', in_ms: 0, out_ms: 1000, timeline_start_ms: 0, duration_ms: 1000, loop: true }],
    }, null, 2));

    const res = runCli(['studio', 'batch', plansDir, '--dest', dir, '--json']);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const report = JSON.parse(res.stdout);
    assert.equal(report.plans, 2);
    assert.equal(report.rendered, 2);
    assert.equal(report.failed, 0);
    for (const result of report.results) {
      assert.ok(fs.existsSync(path.join(dir, result.path)), `missing ${result.path}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

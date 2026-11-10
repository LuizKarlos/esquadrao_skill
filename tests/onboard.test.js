import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  detectEnvironment,
  getFfmpegInstallInstructions,
  buildOnboardPlan,
  loadProfile,
  saveProfile,
} from '../src/commands/onboard.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');

function hasTool(cmd) {
  try {
    execFileSync(cmd, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const canRunFfmpeg = hasTool('ffmpeg') && hasTool('ffprobe');

function skipOrDieInCI(t, reason = 'ffmpeg/ffprobe not found on PATH') {
  if (process.env.CI) {
    assert.fail(`${reason} (failing because process.env.CI is set)`);
  }
  t.skip(reason);
}

function runCliAsync(args, envOverrides = {}, cwd = repoRoot) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...envOverrides };
    const child = spawn(process.execPath, [binPath, ...args], { env, cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      resolve({ status: code, stdout, stderr });
    });
  });
}

function runCliInteractiveAsync(args, inputData, envOverrides = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ESQUADRAO_INTERACTIVE: '1', ...envOverrides };
    const child = spawn(process.execPath, [binPath, ...args], { env, cwd: repoRoot });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.stdin.write(inputData);
    child.stdin.end();
    child.on('close', (code) => {
      resolve({ status: code, stdout, stderr });
    });
  });
}

function generateSampleVideo(filePath, durationSec = 2) {
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `testsrc=duration=${durationSec}:size=640x360:rate=30`,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', `${durationSec}`,
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    filePath,
  ], { stdio: 'pipe' });
}

test('Onboard: missing ffmpeg aborts early with actionable per-OS message', async () => {
  const tmp = path.join(os.tmpdir(), `onboard-no-ffmpeg-${Date.now()}`);
  const nodeDir = path.dirname(process.execPath);
  try {
    const res = await runCliAsync(['onboard', '--mode', 'dark', '--dest', tmp], {
      PATH: nodeDir,
      Path: nodeDir,
    });
    assert.equal(res.status, 1, 'Process should exit with code 1 when ffmpeg is missing');
    assert.match(res.stderr, /ffmpeg/i);
    assert.match(res.stderr, /install/i);

    // Verify actionable per-OS install instruction appears in stderr
    const currentOsInstr = getFfmpegInstallInstructions(process.platform);
    assert.ok(
      res.stderr.includes(currentOsInstr),
      `stderr must contain per-OS message for ${process.platform}: expected "${currentOsInstr}"`
    );

    // Verify actionable per-OS install instruction helper for all supported platforms
    const winInstr = getFfmpegInstallInstructions('win32');
    const macInstr = getFfmpegInstallInstructions('darwin');
    const linuxInstr = getFfmpegInstallInstructions('linux');
    assert.match(winInstr, /winget/);
    assert.match(macInstr, /brew/);
    assert.match(linuxInstr, /apt/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Onboard: happy path dark mode (non-interactive, zero footage)', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `onboard-dark-${Date.now()}`);
  try {
    const res = await runCliAsync(['onboard', '--mode', 'dark', '--dest', tmp, '--json']);
    assert.equal(res.status, 0);

    const data = JSON.parse(res.stdout);
    assert.equal(data.status, 'ok');
    assert.equal(data.mode, 'dark');
    assert.match(data.artifact.id, /^ART-[0-9a-f]{8}$/);
    assert.equal(data.qa.passed, true);
    assert.equal(data.qa.streams.video.codec, 'h264');
    assert.equal(data.qa.streams.video.width, 1080);
    assert.equal(data.qa.streams.video.height, 1920);
    assert.equal(data.qa.streams.audio.codec, 'aac');
    assert.ok(data.qa.duration_s >= 1.9);

    // Verify artifact file exists on disk
    const artifactPath = path.join(tmp, data.artifact.path);
    assert.equal(fs.existsSync(artifactPath), true);
    assert.ok(fs.statSync(artifactPath).size > 0);

    // Verify profile persisted in studio.json
    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'studio.json'), 'utf8'));
    assert.equal(manifest.profile.preferred_mode, 'dark');
    assert.equal(manifest.profile.default_dir, path.resolve(tmp));

    // Verify profile persisted in .esquadrao/profile.json
    const profileFile = path.join(tmp, '.esquadrao', 'profile.json');
    assert.equal(fs.existsSync(profileFile), true);
    const profileJson = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    assert.equal(profileJson.preferred_mode, 'dark');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Onboard: happy path edit_only mode cuts two contiguous clips', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `onboard-edit-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const sampleVideo = path.join(tmp, 'raw_footage.mp4');

  try {
    generateSampleVideo(sampleVideo, 2);

    const res = await runCliAsync([
      'onboard',
      '--mode', 'edit_only',
      '--dest', tmp,
      '--file', sampleVideo,
      '--json',
    ]);
    assert.equal(res.status, 0);

    const data = JSON.parse(res.stdout);
    assert.equal(data.status, 'ok');
    assert.equal(data.mode, 'edit_only');
    assert.equal(data.qa.passed, true);
    assert.equal(data.qa.streams.video.width, 1080);
    assert.equal(data.qa.streams.video.height, 1920);
    assert.equal(data.qa.streams.audio.codec, 'aac');

    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'studio.json'), 'utf8'));
    assert.equal(manifest.assets.length, 1);
    assert.equal(manifest.artifacts.length, 1);
    assert.equal(manifest.profile.preferred_mode, 'edit_only');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Onboard: happy path podcast_clip mode renders video with captions', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `onboard-podcast-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const sampleVideo = path.join(tmp, 'podcast_raw.mp4');

  try {
    generateSampleVideo(sampleVideo, 1);

    const res = await runCliAsync([
      'onboard',
      '--mode', 'podcast_clip',
      '--dest', tmp,
      '--file', sampleVideo,
      '--json',
    ]);
    assert.equal(res.status, 0);

    const data = JSON.parse(res.stdout);
    assert.equal(data.status, 'ok');
    assert.equal(data.mode, 'podcast_clip');
    assert.equal(data.qa.passed, true);
    assert.equal(data.qa.streams.video.width, 1080);
    assert.equal(data.qa.streams.video.height, 1920);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Onboard: existing workspace reuses saved profile without --mode', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `onboard-reuse-${Date.now()}`);
  try {
    // Run 1: sets up profile with dark mode
    const res1 = await runCliAsync(['onboard', '--mode', 'dark', '--dest', tmp, '--json']);
    assert.equal(res1.status, 0);

    // Run 2: omit --mode flag; must reuse dark mode from profile
    const res2 = await runCliAsync(['onboard', '--dest', tmp, '--json']);
    assert.equal(res2.status, 0);

    const data = JSON.parse(res2.stdout);
    assert.equal(data.mode, 'dark');
    assert.equal(data.qa.passed, true);

    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'studio.json'), 'utf8'));
    assert.equal(manifest.artifacts.length, 2);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Onboard: buildOnboardPlan validates modes and asset requirements', () => {
  const darkPlan = buildOnboardPlan({ mode: 'dark' });
  assert.equal(darkPlan.mode, 'dark');
  assert.equal(darkPlan.clips.length, 2);

  assert.throws(() => buildOnboardPlan({ mode: 'edit_only', assets: [] }), /requires at least one imported asset/);
  assert.throws(() => buildOnboardPlan({ mode: 'podcast_clip', assets: [] }), /requires at least one imported asset/);
  assert.throws(() => buildOnboardPlan({ mode: 'invalid_mode' }), /Unsupported mode/);
});

test('Onboard: non-interactive flags validation and error handling', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `onboard-validation-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });

  try {
    // Missing --mode in clean non-interactive run
    const r1 = await runCliAsync(['onboard', '--dest', tmp]);
    assert.equal(r1.status, 1);
    assert.match(r1.stderr, /--mode flag/i);

    // Invalid mode
    const r2 = await runCliAsync(['onboard', '--mode', 'unsupported_mode', '--dest', tmp]);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /Invalid mode/i);

    // edit_only mode without media files in empty workspace
    const r3 = await runCliAsync(['onboard', '--mode', 'edit_only', '--dest', tmp]);
    assert.equal(r3.status, 1);
    assert.match(r3.stderr, /requires at least one media file/i);

    // Media file does not exist
    const r4 = await runCliAsync([
      'onboard',
      '--mode', 'edit_only',
      '--file', 'non_existent_footage_12345.mp4',
      '--dest', tmp,
    ]);
    assert.equal(r4.status, 1);
    assert.match(r4.stderr, /Media file not found/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Onboard: interactive flow prompts user and reads from stdin', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `onboard-interactive-${Date.now()}`);
  try {
    const res = await runCliInteractiveAsync(
      ['onboard', '--dest', tmp, '--json'],
      'dark\n'
    );
    assert.equal(res.status, 0);
    const data = JSON.parse(res.stdout);
    assert.equal(data.status, 'ok');
    assert.equal(data.mode, 'dark');
    assert.equal(data.qa.passed, true);
    assert.equal(fs.existsSync(path.join(tmp, 'studio.json')), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Onboard: help flag outputs usage and options', async () => {
  const res1 = await runCliAsync(['onboard', '--help']);
  assert.equal(res1.status, 0);
  assert.match(res1.stdout, /Usage:/);
  assert.match(res1.stdout, /--mode/);
  assert.match(res1.stdout, /--dest/);
  assert.match(res1.stdout, /--file/);

  const res2 = await runCliAsync(['onboard', '-h']);
  assert.equal(res2.status, 0);
  assert.match(res2.stdout, /Usage:/);
});

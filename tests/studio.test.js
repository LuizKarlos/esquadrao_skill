import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

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

test('Studio: init creates workspace directories and manifest', async () => {
  const tmp = path.join(os.tmpdir(), `studio-init-${Date.now()}`);
  try {
    const res = await runCliAsync(['studio', 'init', '--dest', tmp, '--json']);
    assert.equal(res.status, 0);

    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(fs.existsSync(path.join(tmp, 'assets')), true);
    assert.equal(fs.existsSync(path.join(tmp, 'artifacts')), true);
    assert.equal(fs.existsSync(path.join(tmp, 'packages')), true);

    const manifestPath = path.join(tmp, 'studio.json');
    assert.equal(fs.existsSync(manifestPath), true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.version, 1);
    assert.equal(manifest.name, 'universal-studio');
    assert.deepEqual(manifest.assets, []);
    assert.deepEqual(manifest.artifacts, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: render rejects invalid EditPlan schema before ffmpeg invocation', async () => {
  const tmp = path.join(os.tmpdir(), `studio-invalid-plan-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const badPlanPath = path.join(tmp, 'bad-plan.json');
  fs.writeFileSync(badPlanPath, JSON.stringify({ schema_version: 99, mode: 'unknown' }));

  try {
    const res = await runCliAsync(['studio', 'render', badPlanPath, '--dest', tmp]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /EditPlan validation failed/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: import registers media asset with ffprobe metadata', async (t) => {
  if (!canRunFfmpeg) {
    t.skip('ffmpeg/ffprobe not found on PATH');
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-import-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const sampleVideo = path.join(tmp, 'source.mp4');

  try {
    // Generate 1-second sample video with audio
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=30',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', '1',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      sampleVideo,
    ], { stdio: 'pipe' });

    // Initialize workspace
    await runCliAsync(['studio', 'init', '--dest', tmp]);

    // Import footage
    const res = await runCliAsync(['studio', 'import', sampleVideo, '--dest', tmp, '--json']);
    assert.equal(res.status, 0);

    const record = JSON.parse(res.stdout);
    assert.match(record.id, /^AST-[0-9a-f]{8}$/);
    assert.equal(record.name, 'source.mp4');
    assert.equal(record.metadata.width, 320);
    assert.equal(record.metadata.height, 240);
    assert.ok(record.metadata.duration_s >= 0.9);
    assert.equal(record.metadata.video_codec, 'h264');
    assert.equal(record.metadata.audio_codec, 'aac');

    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'studio.json'), 'utf8'));
    assert.equal(manifest.assets.length, 1);
    assert.equal(manifest.assets[0].id, record.id);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: render dark mode creates valid MP4 artifact', async (t) => {
  if (!canRunFfmpeg) {
    t.skip('ffmpeg/ffprobe not found on PATH');
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-render-dark-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });

  const darkPlan = {
    schema_version: 1,
    mode: 'dark',
    clips: [
      {
        kind: 'text',
        text: 'Universal Studio Autonomous Render',
        duration_ms: 1000,
        timeline_start_ms: 0,
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

  const planPath = path.join(tmp, 'dark-plan.json');
  fs.writeFileSync(planPath, JSON.stringify(darkPlan, null, 2));

  try {
    await runCliAsync(['studio', 'init', '--dest', tmp]);
    const res = await runCliAsync(['studio', 'render', planPath, '--dest', tmp, '--json']);
    assert.equal(res.status, 0);

    const record = JSON.parse(res.stdout);
    assert.match(record.id, /^ART-[0-9a-f]{8}$/);
    assert.equal(record.mode, 'dark');
    assert.ok(record.size_bytes > 0);

    const artifactFile = path.join(tmp, record.path);
    assert.equal(fs.existsSync(artifactFile), true);

    // QA verify the rendered artifact
    const qaRes = await runCliAsync(['studio', 'qa', artifactFile, '--json']);
    assert.equal(qaRes.status, 0);
    const qaReport = JSON.parse(qaRes.stdout);
    assert.equal(qaReport.passed, true);
    assert.equal(qaReport.streams.video.codec, 'h264');
    assert.equal(qaReport.streams.video.width, 1080);
    assert.equal(qaReport.streams.video.height, 1920);
    assert.equal(qaReport.streams.audio.codec, 'aac');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: render edit_only mode cuts and concatenates video clips', async (t) => {
  if (!canRunFfmpeg) {
    t.skip('ffmpeg/ffprobe not found on PATH');
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-render-edit-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const sampleVideo = path.join(tmp, 'footage.mp4');

  try {
    // Generate 2-second source footage
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=30',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', '2',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      sampleVideo,
    ], { stdio: 'pipe' });

    await runCliAsync(['studio', 'init', '--dest', tmp]);
    const importRes = await runCliAsync(['studio', 'import', sampleVideo, '--dest', tmp, '--json']);
    const asset = JSON.parse(importRes.stdout);

    const editPlan = {
      schema_version: 1,
      mode: 'edit_only',
      clips: [
        {
          kind: 'video',
          asset_id: asset.id,
          clip_id: 'c1',
          in_ms: 0,
          out_ms: 500,
          timeline_start_ms: 0,
          speed: 1,
        },
        {
          kind: 'video',
          asset_id: asset.id,
          clip_id: 'c2',
          in_ms: 500,
          out_ms: 1000,
          timeline_start_ms: 500,
          speed: 1,
        },
      ],
      audio_tracks: [
        { kind: 'source', clip_id: 'c1', gain_db: 0 },
        { kind: 'source', clip_id: 'c2', gain_db: -2 },
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

    const planPath = path.join(tmp, 'edit-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(editPlan, null, 2));

    const renderRes = await runCliAsync(['studio', 'render', planPath, '--dest', tmp, '--json']);
    assert.equal(renderRes.status, 0);
    const artifact = JSON.parse(renderRes.stdout);
    assert.match(artifact.id, /^ART-[0-9a-f]{8}$/);

    const artFile = path.join(tmp, artifact.path);
    assert.equal(fs.existsSync(artFile), true);

    const qaRes = await runCliAsync(['studio', 'qa', artFile, '--json']);
    assert.equal(qaRes.status, 0);
    const qa = JSON.parse(qaRes.stdout);
    assert.equal(qa.passed, true);
    assert.equal(qa.streams.video.width, 1080);
    assert.equal(qa.streams.video.height, 1920);
    assert.equal(qa.streams.audio.codec, 'aac');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: qa fails with exit code 1 on missing audio stream', async (t) => {
  if (!canRunFfmpeg) {
    t.skip('ffmpeg/ffprobe not found on PATH');
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-qa-fail-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const noAudioVideo = path.join(tmp, 'no_audio.mp4');

  try {
    // Generate video without audio
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=0.5:size=320x240:rate=30',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      noAudioVideo,
    ], { stdio: 'pipe' });

    const qaRes = await runCliAsync(['studio', 'qa', noAudioVideo, '--json']);
    assert.equal(qaRes.status, 1, 'QA must exit 1 when stream is missing');
    const report = JSON.parse(qaRes.stdout);
    assert.equal(report.passed, false);
    assert.ok(report.errors.includes('Missing audio stream'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

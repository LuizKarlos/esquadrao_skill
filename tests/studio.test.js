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
    skipOrDieInCI(t);
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
    skipOrDieInCI(t);
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
    skipOrDieInCI(t);
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
    skipOrDieInCI(t);
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

test('Studio: render handles special caption characters in dark, edit_only, and podcast_clip modes', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-caption-escape-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const sampleVideo = path.join(tmp, 'footage.mp4');
  const specialText = "100% d'ouro %{pts} : \\ , ; [ ]";

  try {
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

    await runCliAsync(['studio', 'init', '--dest', tmp]);
    const importRes = await runCliAsync(['studio', 'import', sampleVideo, '--dest', tmp, '--json']);
    const asset = JSON.parse(importRes.stdout);

    // 1. dark mode
    const darkPlan = {
      schema_version: 1,
      mode: 'dark',
      clips: [{ kind: 'text', text: specialText, duration_ms: 1000, timeline_start_ms: 0 }],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const darkPlanPath = path.join(tmp, 'dark-plan.json');
    fs.writeFileSync(darkPlanPath, JSON.stringify(darkPlan));
    const darkRes = await runCliAsync(['studio', 'render', darkPlanPath, '--dest', tmp, '--json']);
    assert.equal(darkRes.status, 0, `Dark mode render failed: ${darkRes.stderr}`);

    // 2. edit_only mode
    const editPlan = {
      schema_version: 1,
      mode: 'edit_only',
      clips: [
        { kind: 'video', asset_id: asset.id, clip_id: 'c1', in_ms: 0, out_ms: 500, timeline_start_ms: 0, speed: 1 },
        { kind: 'video', asset_id: asset.id, clip_id: 'c2', in_ms: 500, out_ms: 1000, timeline_start_ms: 500, speed: 1 },
      ],
      audio_tracks: [{ kind: 'source', clip_id: 'c1', gain_db: 0 }, { kind: 'source', clip_id: 'c2', gain_db: 0 }],
      captions: [{ text: specialText, timeline_start_ms: 0, duration_ms: 1000 }],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const editPlanPath = path.join(tmp, 'edit-plan.json');
    fs.writeFileSync(editPlanPath, JSON.stringify(editPlan));
    const editRes = await runCliAsync(['studio', 'render', editPlanPath, '--dest', tmp, '--json']);
    assert.equal(editRes.status, 0, `Edit_only mode render failed: ${editRes.stderr}`);

    // 3. podcast_clip mode
    const podcastPlan = {
      schema_version: 1,
      mode: 'podcast_clip',
      clips: [
        { kind: 'video', asset_id: asset.id, clip_id: 'c1', in_ms: 0, out_ms: 1000, timeline_start_ms: 0, speed: 1 },
      ],
      audio_tracks: [{ kind: 'source', clip_id: 'c1', gain_db: 0 }],
      captions: [{ text: specialText, timeline_start_ms: 0, duration_ms: 1000 }],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const podcastPlanPath = path.join(tmp, 'podcast-plan.json');
    fs.writeFileSync(podcastPlanPath, JSON.stringify(podcastPlan));
    const podcastRes = await runCliAsync(['studio', 'render', podcastPlanPath, '--dest', tmp, '--json']);
    assert.equal(podcastRes.status, 0, `Podcast_clip mode render failed: ${podcastRes.stderr}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: render succeeds when source footage has no audio track', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-no-audio-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const noAudioVideo = path.join(tmp, 'silent.mp4');

  try {
    // Generate 1-second video with no audio track
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=30',
      '-c:v', 'libx264',
      '-an',
      '-pix_fmt', 'yuv420p',
      noAudioVideo,
    ], { stdio: 'pipe' });

    await runCliAsync(['studio', 'init', '--dest', tmp]);
    const importRes = await runCliAsync(['studio', 'import', noAudioVideo, '--dest', tmp, '--json']);
    assert.equal(importRes.status, 0);
    const asset = JSON.parse(importRes.stdout);
    assert.equal(asset.metadata.audio_codec, null, 'audio_codec must be null when stream is absent');

    // Test edit_only with silent asset
    const editPlan = {
      schema_version: 1,
      mode: 'edit_only',
      clips: [
        { kind: 'video', asset_id: asset.id, clip_id: 'c1', in_ms: 0, out_ms: 500, timeline_start_ms: 0, speed: 1 },
        { kind: 'video', asset_id: asset.id, clip_id: 'c2', in_ms: 500, out_ms: 1000, timeline_start_ms: 500, speed: 1 },
      ],
      audio_tracks: [
        { kind: 'source', clip_id: 'c1', gain_db: 0 },
        { kind: 'source', clip_id: 'c2', gain_db: 0 },
      ],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const editPlanPath = path.join(tmp, 'edit-plan.json');
    fs.writeFileSync(editPlanPath, JSON.stringify(editPlan));
    const editRes = await runCliAsync(['studio', 'render', editPlanPath, '--dest', tmp, '--json']);
    assert.equal(editRes.status, 0, `edit_only render failed with no-audio source: ${editRes.stderr}`);
    const editArt = JSON.parse(editRes.stdout);
    const editArtFile = path.join(tmp, editArt.path);
    const qaEdit = await runCliAsync(['studio', 'qa', editArtFile, '--json']);
    assert.equal(qaEdit.status, 0);
    assert.equal(JSON.parse(qaEdit.stdout).passed, true);

    // Test podcast_clip with silent asset
    const podcastPlan = {
      schema_version: 1,
      mode: 'podcast_clip',
      clips: [
        { kind: 'video', asset_id: asset.id, clip_id: 'c1', in_ms: 0, out_ms: 1000, timeline_start_ms: 0, speed: 1 },
      ],
      audio_tracks: [{ kind: 'source', clip_id: 'c1', gain_db: 0 }],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const podcastPlanPath = path.join(tmp, 'podcast-plan.json');
    fs.writeFileSync(podcastPlanPath, JSON.stringify(podcastPlan));
    const podRes = await runCliAsync(['studio', 'render', podcastPlanPath, '--dest', tmp, '--json']);
    assert.equal(podRes.status, 0, `podcast_clip render failed with no-audio source: ${podRes.stderr}`);
    const podArt = JSON.parse(podRes.stdout);
    const podArtFile = path.join(tmp, podArt.path);
    const qaPod = await runCliAsync(['studio', 'qa', podArtFile, '--json']);
    assert.equal(qaPod.status, 0);
    assert.equal(JSON.parse(qaPod.stdout).passed, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: render rejects plan when out_ms exceeds asset duration', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-duration-val-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const sampleVideo = path.join(tmp, 'short.mp4');

  try {
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

    await runCliAsync(['studio', 'init', '--dest', tmp]);
    const importRes = await runCliAsync(['studio', 'import', sampleVideo, '--dest', tmp, '--json']);
    const asset = JSON.parse(importRes.stdout);

    const editPlan = {
      schema_version: 1,
      mode: 'edit_only',
      clips: [
        { kind: 'video', asset_id: asset.id, clip_id: 'clip_invalid_cut', in_ms: 0, out_ms: 2500, timeline_start_ms: 0, speed: 1 },
        { kind: 'video', asset_id: asset.id, clip_id: 'clip_2', in_ms: 500, out_ms: 1000, timeline_start_ms: 2500, speed: 1 },
      ],
      audio_tracks: [
        { kind: 'source', clip_id: 'clip_invalid_cut', gain_db: 0 },
        { kind: 'source', clip_id: 'clip_2', gain_db: 0 },
      ],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const planPath = path.join(tmp, 'invalid-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(editPlan));

    const renderRes = await runCliAsync(['studio', 'render', planPath, '--dest', tmp, '--json']);
    assert.equal(renderRes.status, 1, 'Render must exit 1 when out_ms exceeds asset duration');
    assert.match(renderRes.stderr, /clip_invalid_cut/, 'Error must name the clip');
    assert.match(renderRes.stderr, new RegExp(asset.id), 'Error must name the asset');
    assert.match(renderRes.stderr, /1000ms/, 'Error must name the real duration');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio & Onboard: ffmpeg errors capture concise stderr and verbose flag reveals full log', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-ffmpeg-stderr-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const sampleVideo = path.join(tmp, 'footage.mp4');

  try {
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

    await runCliAsync(['studio', 'init', '--dest', tmp]);
    const importRes = await runCliAsync(['studio', 'import', sampleVideo, '--dest', tmp, '--json']);
    const asset = JSON.parse(importRes.stdout);

    // Corrupt asset file after import so ffmpeg fails during render
    const assetFile = path.join(tmp, asset.path);
    fs.writeFileSync(assetFile, 'not-a-valid-mp4-content-header-corruption');

    const editPlan = {
      schema_version: 1,
      mode: 'edit_only',
      clips: [
        { kind: 'video', asset_id: asset.id, clip_id: 'c1', in_ms: 0, out_ms: 500, timeline_start_ms: 0, speed: 1 },
        { kind: 'video', asset_id: asset.id, clip_id: 'c2', in_ms: 500, out_ms: 1000, timeline_start_ms: 500, speed: 1 },
      ],
      audio_tracks: [
        { kind: 'source', clip_id: 'c1', gain_db: 0 },
        { kind: 'source', clip_id: 'c2', gain_db: 0 },
      ],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const planPath = path.join(tmp, 'corrupt-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(editPlan));

    // 1. Without --verbose: concise error without full config banner
    const normalRes = await runCliAsync(['studio', 'render', planPath, '--dest', tmp]);
    assert.equal(normalRes.status, 1);
    assert.match(normalRes.stderr, /ffmpeg rendering failed/);
    assert.doesNotMatch(normalRes.stderr, /configuration:/);

    // 2. With --verbose: shows full ffmpeg log
    const verboseRes = await runCliAsync(['studio', 'render', planPath, '--dest', tmp, '--verbose']);
    assert.equal(verboseRes.status, 1);
    assert.match(verboseRes.stderr, /ffmpeg execution failed/);
    assert.match(verboseRes.stderr, /configuration:/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: corrupted studio.json causes commands to fail without overwriting manifest', async () => {
  const tmp = path.join(os.tmpdir(), `studio-corrupt-manifest-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const manifestPath = path.join(tmp, 'studio.json');
  const corruptContent = '{"version": 1, "assets": [ INVALID_JSON ...';
  fs.writeFileSync(manifestPath, corruptContent, 'utf8');

  try {
    // 1. studio init on corrupt manifest must fail
    const initRes = await runCliAsync(['studio', 'init', '--dest', tmp]);
    assert.equal(initRes.status, 1, 'Init must fail on corrupted manifest');
    assert.match(initRes.stderr, /Corrupted studio manifest/);

    // 2. verify studio.json was NOT overwritten
    const contentAfter = fs.readFileSync(manifestPath, 'utf8');
    assert.equal(contentAfter, corruptContent, 'Manifest must not be overwritten when corrupted');

    // 3. if ffmpeg is available, studio import on corrupt manifest must also fail with manifest error
    if (canRunFfmpeg) {
      const sampleVideo = path.join(tmp, 'valid.mp4');
      execFileSync('ffmpeg', [
        '-y',
        '-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=30',
        '-c:v', 'libx264',
        '-an',
        sampleVideo,
      ], { stdio: 'pipe' });

      const importRes = await runCliAsync(['studio', 'import', sampleVideo, '--dest', tmp]);
      assert.equal(importRes.status, 1, 'Import must fail on corrupted manifest');
      assert.match(importRes.stderr, /Corrupted studio manifest/);

      const contentAfterImport = fs.readFileSync(manifestPath, 'utf8');
      assert.equal(contentAfterImport, corruptContent, 'Manifest must still not be overwritten');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Studio: qa with --plan detects truncated artifact and resolution/fps mismatches', async (t) => {
  if (!canRunFfmpeg) {
    skipOrDieInCI(t);
    return;
  }

  const tmp = path.join(os.tmpdir(), `studio-qa-plan-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });

  const plan = {
    schema_version: 1,
    mode: 'dark',
    clips: [
      { kind: 'text', text: 'Intro', duration_ms: 1000, timeline_start_ms: 0 },
      { kind: 'text', text: 'Outro', duration_ms: 1000, timeline_start_ms: 1000 },
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
  const planFile = path.join(tmp, 'target-plan.json');
  fs.writeFileSync(planFile, JSON.stringify(plan));

  // 1. Generate truncated artifact: 0.5s instead of 2.0s, resolution 320x240 instead of 1080x1920
  const truncatedVideo = path.join(tmp, 'truncated.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=0.5:size=320x240:rate=30',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', '0.5',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    truncatedVideo,
  ], { stdio: 'pipe' });

  try {
    const qaRes = await runCliAsync(['studio', 'qa', truncatedVideo, '--plan', planFile, '--json']);
    assert.equal(qaRes.status, 1, 'QA with --plan must fail for truncated artifact');
    const report = JSON.parse(qaRes.stdout);
    assert.equal(report.passed, false);
    assert.ok(report.errors.some((e) => e.includes('Duration mismatch')), 'Must report duration mismatch');
    assert.ok(report.errors.some((e) => e.includes('Width mismatch')), 'Must report width mismatch');
    assert.ok(report.errors.some((e) => e.includes('Height mismatch')), 'Must report height mismatch');

    // 2. Render actual plan via studio render (which internally validates with QA and matches plan)
    const renderRes = await runCliAsync(['studio', 'render', planFile, '--dest', tmp, '--json']);
    assert.equal(renderRes.status, 0);
    const artifact = JSON.parse(renderRes.stdout);
    const validArtFile = path.join(tmp, artifact.path);

    // 3. QA with --plan on valid rendered artifact passes
    const validQaRes = await runCliAsync(['studio', 'qa', validArtFile, '--plan', planFile, '--json']);
    assert.equal(validQaRes.status, 0);
    const validReport = JSON.parse(validQaRes.stdout);
    assert.equal(validReport.passed, true);
    assert.equal(validReport.errors.length, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

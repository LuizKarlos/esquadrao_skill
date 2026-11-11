import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  CAPTION_TEMPLATES,
  getCaptionTemplate,
  listCaptionTemplates,
  splitCaptionLines,
} from '../src/captionTemplates.js';
import { buildCaptionFilters } from '../src/commands/studio.js';
import { validateEditPlan } from '../src/roles/mediaProducer.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');

function makeVideo(dest) {
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=30:d=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest',
    dest,
  ], { stdio: 'ignore' });
}

function runCli(args, cwd) {
  const result = spawnSync(process.execPath, [binPath, ...args, '--json'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, OPENAI_API_KEY: '' },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Caption templates: catalog exposes nine unique, font-ready presets', () => {
  const templates = listCaptionTemplates();
  assert.equal(templates.length, 9);
  assert.equal(new Set(templates.map((t) => t.id)).size, 9);
  assert.equal(CAPTION_TEMPLATES.length, 9);
  for (const template of templates) {
    assert.equal(template.font_available, true, `${template.id} font`);
    assert.ok(template.font_size > 0);
  }
});

test('Caption templates: unknown id fails with the available list', () => {
  assert.throws(() => getCaptionTemplate('does-not-exist'), /Available: mrbeast-yellow/);
});

test('Caption templates: splitCaptionLines balances two lines', () => {
  assert.deepEqual(splitCaptionLines('LEGENDA DO SEU JEITO', 2), ['LEGENDA DO', 'SEU JEITO']);
  assert.deepEqual(splitCaptionLines('LEGENDA DO SEU JEITO', 1), ['LEGENDA DO SEU JEITO']);
});

test('Caption templates: generated filters use bundled font, two lines, no box', () => {
  const filter = buildCaptionFilters([
    { text: 'LEGENDA DO SEU JEITO', timeline_start_ms: 0, duration_ms: 2000, template: 'heavy-white' },
  ], '[v]', [], 'default', { width: 640, height: 360 });
  assert.equal((filter.match(/drawtext=/g) || []).length, 2);
  assert.match(filter, /Poppins-Bold\.ttf/);
  assert.match(filter, /borderw=8/);
  assert.doesNotMatch(filter, /box=1/);
});

test('Caption templates: vertical geometry keeps the two lines as one block', () => {
  const filter = buildCaptionFilters([
    { text: 'LEGENDA DO SEU JEITO', timeline_start_ms: 0, duration_ms: 2000, template: 'heavy-white' },
  ], '[v]', [], 'default', { width: 1080, height: 1920 });
  assert.match(filter, /y=560/);
  assert.match(filter, /y=683/);
});

test('Caption templates: validateEditPlan accepts known and rejects unknown template', () => {
  const base = {
    schema_version: 1,
    mode: 'podcast_clip',
    caption_template: 'heavy-white',
    clips: [{ kind: 'video', clip_id: 'c1', asset_id: 'A', in_ms: 0, out_ms: 1000, timeline_start_ms: 0, speed: 1 }],
    audio_tracks: [{ kind: 'source', clip_id: 'c1', gain_db: 0 }],
    output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
  };
  assert.equal(validateEditPlan(base), true);
  assert.throws(() => validateEditPlan({ ...base, caption_template: 'nope' }), /Unknown caption template/);
  assert.throws(() => validateEditPlan({
    ...base,
    caption_template: undefined,
    captions: [{ text: 'X', timeline_start_ms: 0, duration_ms: 1000, template: 'nope' }],
  }), /Unknown caption template/);
});

test('Caption templates: CLI lists the nine presets', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'caption-list-'));
  try {
    const report = runCli(['studio', 'caption-templates'], tmp);
    assert.equal(report.version, 1);
    assert.equal(report.templates.length, 9);
    assert.equal(report.templates[0].id, 'mrbeast-yellow');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Caption templates: render applies a template end to end', (t) => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
  } catch {
    if (process.env.CI) assert.fail('FFmpeg and ffprobe required in CI');
    t.skip('FFmpeg and ffprobe required for render');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'caption-render-'));
  const source = path.join(tmp, 'source.mp4');
  try {
    makeVideo(source);
    runCli(['studio', 'init', '--dest', tmp], tmp);
    const asset = runCli(['studio', 'import', source, '--dest', tmp], tmp);
    const plan = {
      schema_version: 1,
      mode: 'podcast_clip',
      clips: [{ kind: 'video', clip_id: 'c1', asset_id: asset.id, in_ms: 0, out_ms: 2000, timeline_start_ms: 0, speed: 1 }],
      audio_tracks: [{ kind: 'source', clip_id: 'c1', gain_db: 0 }],
      captions: [{ text: 'LEGENDA DO SEU JEITO', timeline_start_ms: 0, duration_ms: 2000 }],
      output: { width: 1080, height: 1920, fps_num: 30, fps_den: 1, video_codec: 'h264', audio_codec: 'aac' },
    };
    const planPath = path.join(tmp, 'packages', 'caption-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan));
    const render = runCli(['studio', 'render', planPath, '--caption-template', 'heavy-white', '--dest', tmp], tmp);
    assert.ok(fs.existsSync(path.join(tmp, render.path)));
    const qa = runCli(['studio', 'qa', path.join(tmp, render.path), '--plan', planPath], tmp);
    assert.equal(qa.passed, true, JSON.stringify(qa.errors));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

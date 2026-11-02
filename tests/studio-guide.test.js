import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateEditPlan } from '../src/roles/mediaProducer.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const guidePath = 'skill-media-producer/references/configuracao-inicial.md';

test('Studio guide: installed template renders both documented formats', (t) => {
  const guide = fs.readFileSync(path.join(root, guidePath), 'utf8');
  const plan = JSON.parse(guide.match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);
  assert.equal(validateEditPlan(plan), true);
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
  } catch {
    if (process.env.CI) assert.fail('FFmpeg and ffprobe required in CI');
    t.skip('FFmpeg and ffprobe required for render verification');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-guide-'));
  const cli = (...args) => JSON.parse(execFileSync(process.execPath,
    [path.join(root, 'bin/cli.js'), ...args, '--json'], { cwd: tmp, encoding: 'utf8' }));
  try {
    cli('setup', '--dest', path.join(tmp, 'skills'));
    assert.equal(fs.readFileSync(path.join(tmp, 'skills', guidePath), 'utf8'), guide);
    cli('studio', 'init', '--dest', tmp);
    const source = path.join(tmp, 'source.mp4');
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=30:d=8',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', '-c:v', 'libx264', '-c:a', 'aac',
      '-pix_fmt', 'yuv420p', '-shortest', source], { stdio: 'pipe' });
    const asset = cli('studio', 'import', source, '--dest', tmp);
    for (const clip of plan.clips) clip.asset_id = asset.id;
    const planFile = path.join(tmp, 'packages', 'editplan.json');
    for (const [width, height] of [[1080, 1920], [1920, 1080]]) {
      Object.assign(plan.output, { width, height });
      assert.equal(validateEditPlan(plan), true);
      fs.writeFileSync(planFile, JSON.stringify(plan));
      const artifact = cli('studio', 'render', planFile, '--dest', tmp);
      const report = cli('studio', 'qa', path.join(tmp, artifact.path), '--plan', planFile);
      assert.equal(report.passed, true, JSON.stringify(report.errors));
      assert.equal(report.streams.video.width, width);
      assert.equal(report.streams.video.height, height);
      assert.ok(Math.abs(report.duration_s - 8) < 0.35);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

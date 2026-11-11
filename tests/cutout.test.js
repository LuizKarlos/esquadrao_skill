import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');

test('Studio: cutout requires --background', () => {
  const res = spawnSync(process.execPath, [binPath, 'studio', 'cutout', 'x.mp4', '--json'], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--background/);
});

test('Studio: cutout rejects unsupported engines before invoking Python', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cutout-engine-'));
  const src = path.join(tmpDir, 'src.mp4');
  const bg = path.join(tmpDir, 'bg.mp4');
  fs.writeFileSync(src, '');
  fs.writeFileSync(bg, '');
  try {
    const res = spawnSync(process.execPath, [
      binPath, 'studio', 'cutout', src, '--background', bg, '--engine', 'other', '--json',
    ], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Engine de cutout não suportado/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Studio: help lists cutout', () => {
  const res = spawnSync(process.execPath, [binPath, 'studio', '--help'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /cutout <video>/);
});

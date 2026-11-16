import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const harnessPath = path.join(repoRoot, 'tests', 'fixtures', 'cutout_engine_harness.py');
const python = process.env.PYTHON || 'python3';
const pythonAvailable = !spawnSync(python, ['-c', 'pass'], { stdio: 'ignore' }).error;
const skip = pythonAvailable ? false : 'python3 indisponível';

function runHarness(name) {
  const res = spawnSync(python, [harnessPath, name], { encoding: 'utf8', timeout: 30000 });
  assert.equal(res.status, 0, `harness ${name} falhou:\n${res.stderr}`);
  return JSON.parse(res.stdout.trim().split('\n').pop());
}

test('cutout.py: sucesso só com rc 0 e mantém o artefato', { skip }, () => {
  const r = runHarness('ok');
  assert.equal(r.exit, 0);
  assert.equal(r.output_exists, true);
  assert.equal(r.writes, 15);
  assert.match(r.stdout, /"status": "ok"/);
});

test('cutout.py: ffmpeg morto (BrokenPipeError) encerra o processo e remove a saída parcial', { skip }, () => {
  const r = runHarness('broken_pipe');
  assert.equal(r.exit, 1);
  assert.equal(r.output_exists, false);
  assert.equal(r.ff_started, true);
  assert.equal(r.ff_terminated, true);
  assert.match(r.stderr, /ffmpeg encerrou antes do fim dos frames/);
});

test('cutout.py: exceção do motor remove a saída parcial e retorna != 0', { skip }, () => {
  const r = runHarness('engine_error');
  assert.equal(r.exit, 1);
  assert.equal(r.output_exists, false);
  assert.equal(r.ff_terminated, true);
  assert.match(r.stderr, /falha no cutout: u2net falhou/);
});

test('cutout.py: KeyboardInterrupt encerra o ffmpeg e remove a saída parcial', { skip }, () => {
  const r = runHarness('interrupt');
  assert.equal(r.exit, 130);
  assert.equal(r.output_exists, false);
  assert.equal(r.ff_terminated, true);
});

test('cutout.py: zero frames decodificados é falha, não status ok', { skip }, () => {
  const r = runHarness('no_frames');
  assert.equal(r.exit, 1);
  assert.equal(r.output_exists, false);
  assert.equal(r.ff_terminated, true);
  assert.match(r.stderr, /nenhum frame da entrada foi decodificado/);
});

test('cutout.py: decodificação prematura não passa como status ok', { skip }, () => {
  const r = runHarness('short_decode');
  assert.equal(r.exit, 1);
  assert.equal(r.output_exists, false);
  assert.match(r.stderr, /decodificação interrompida em 5\/15 frames/);
});

test('cutout.py: entrada vertical usa a altura da tela sem encolher as laterais', { skip }, () => {
  const r = runHarness('geometry_vertical');
  assert.equal(r.exit, 0);
  assert.deepEqual(r.resize_calls[1], [1080, 1920]);
});

test('cutout.py: entrada horizontal mantém o recorte de 1000 px', { skip }, () => {
  const r = runHarness('geometry_horizontal');
  assert.equal(r.exit, 0);
  assert.deepEqual(r.resize_calls[1], [1777, 1000]);
});

test('cutout.py: --fg-height explícito é respeitado', { skip }, () => {
  const r = runHarness('geometry_explicit');
  assert.equal(r.exit, 0);
  assert.deepEqual(r.resize_calls[1], [450, 800]);
});

test('cutout.py: erosão do GrabCut é proporcional (~49 px em 1080p)', { skip }, () => {
  const r = runHarness('kernel');
  assert.equal(r.exit, 0);
  assert.deepEqual(r.kernel_calls[0], [49, 49]);
  assert.equal(r.kernel_calls[0][0] % 2, 1);
  assert.ok(r.kernel_calls[0][0] >= 31);
});

test('cutout.py: amostra frames em leitura sequencial, sem seek na entrada', { skip }, () => {
  const r = runHarness('sequential');
  assert.equal(r.exit, 0);
  assert.equal(r.writes, 30);
  assert.equal(r.cap_set_calls, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDAG } from '../scripts/dag_validator.js';
import { computeBlockHash } from '../scripts/merkle_verify.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const script = (name) => path.join(repoRoot, 'scripts', name);
const shellQuote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
const ptyAvailable = process.platform === 'linux' && !spawnSync('script', ['--version']).error;

function runInTty(scriptPath) {
  const command = `${shellQuote(process.execPath)} ${shellQuote(scriptPath)}`;
  return spawnSync('script', ['-qec', command, '/dev/null'], { encoding: 'utf8', timeout: 5000 });
}

test('validateDAG: IDs duplicados falham de forma determinística', () => {
  const res = validateDAG([{ id: 'A' }, { id: 'A' }]);
  assert.equal(res.valid, false);
  assert.deepEqual(res.waves, []);
  assert.deepEqual(res.cycles, []);
  assert.ok(res.errors.some((e) => /duplicate id "A"/.test(e)));
});

test('validateDAG: tarefa sem id não lança e retorna inválido', () => {
  const res = validateDAG([{}]);
  assert.equal(res.valid, false);
  assert.deepEqual(res.waves, []);
  assert.ok(res.errors.some((e) => /id must be a non-empty string/.test(e)));
});

test('validateDAG: elemento null não lança e retorna inválido', () => {
  let res;
  assert.doesNotThrow(() => { res = validateDAG([null]); });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /must be an object/.test(e)));
});

test('validateDAG: auto-dependência vira ciclo', () => {
  const res = validateDAG([{ id: 'A', depends_on: ['A'] }]);
  assert.equal(res.valid, false);
  assert.deepEqual(res.cycles, ['A']);
  assert.deepEqual(res.waves, []);
});

test('validateDAG: aceita envelope { tasks: [...] }', () => {
  const res = validateDAG({ tasks: [{ id: 'A' }, { id: 'B', depends_on: ['A'] }] });
  assert.equal(res.valid, true);
  assert.deepEqual(res.waves, [['A'], ['B']]);
  assert.deepEqual(res.errors, []);
});

test('validateDAG: envelope ou depends_on malformados retornam erro explícito', () => {
  assert.ok(validateDAG({ tasks: 'nope' }).errors.length > 0);
  const res = validateDAG([{ id: 'A', depends_on: 'B' }]);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /depends_on must be an array/.test(e)));
});

test('computeBlockHash: arrays e valores não-objeto retornam string vazia', () => {
  assert.equal(computeBlockHash([]), '');
  assert.equal(computeBlockHash(null), '');
  assert.equal(computeBlockHash('block'), '');
  assert.equal(computeBlockHash([{ hash: 'x' }]), '');
});

test('CLI: dag_validator em TTY sem argumento sai com uso, sem travar', { skip: ptyAvailable ? false : 'pty indisponível' }, () => {
  const res = runInTty(script('dag_validator.js'));
  assert.equal(res.status, 1);
  assert.match(`${res.stdout}${res.stderr}`, /Usage: node scripts\/dag_validator\.js/);
});

test('CLI: merkle_verify em TTY sem argumento sai com uso, sem travar', { skip: ptyAvailable ? false : 'pty indisponível' }, () => {
  const res = runInTty(script('merkle_verify.js'));
  assert.equal(res.status, 1);
  assert.match(`${res.stdout}${res.stderr}`, /Usage: node scripts\/merkle_verify\.js/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDAG } from '../scripts/dag_validator.js';
import { computeBlockHash, verifyLedger } from '../scripts/merkle_verify.js';
import { sliceAst } from '../scripts/ast_slice.js';
import { getContrastRatio } from '../scripts/wcag_check.js';

// ponytail: synchronous recursive directory walk; upgrade to stream/worker pipeline for repos >100k files
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

test('CLI Execution & Version', () => {
  const binPath = join(repoRoot, 'bin', 'cli.js');
  const stdout = execFileSync(process.execPath, [binPath, '--version'], { encoding: 'utf8' }).trim();
  assert.equal(stdout, pkg.version);
});

test('DAG Validator Script', () => {
  const acyclic = [
    { id: '1', depends_on: [] },
    { id: '2', depends_on: ['1'] },
    { id: '3', depends_on: ['2'] },
  ];
  const resValid = validateDAG(acyclic);
  assert.equal(resValid.valid, true);
  assert.deepEqual(resValid.cycles, []);
  assert.equal(resValid.waves.length, 3);

  const cyclic = [
    { id: 'a', depends_on: ['b'] },
    { id: 'b', depends_on: ['a'] },
  ];
  const resCyclic = validateDAG(cyclic);
  assert.equal(resCyclic.valid, false);
  assert.ok(resCyclic.cycles.length > 0);
});

test('Merkle Ledger Script', () => {
  const b0 = { index: 0, previous_hash: '0', data: 'genesis' };
  b0.hash = computeBlockHash(b0);
  assert.equal(typeof b0.hash, 'string');
  assert.equal(b0.hash.length, 64);

  const b1 = { index: 1, previous_hash: b0.hash, data: 'payload' };
  b1.hash = computeBlockHash(b1);

  const validRes = verifyLedger([b0, b1]);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.blocks_verified, 2);
  assert.equal(validRes.errors.length, 0);

  const tamperedRes = verifyLedger([b0, { ...b1, hash: 'badhash' }]);
  assert.equal(tamperedRes.valid, false);
  assert.ok(tamperedRes.errors.length > 0);
});

test('AST Slicer Script', () => {
  const code = 'export function calculateTotal() {\n  return 100;\n}\nclass Invoice {\n}';
  const res = sliceAst(code, 'js');
  assert.equal(res.lang, 'js');
  assert.ok(res.declarations.some((d) => d.includes('calculateTotal')));
  assert.ok(res.declarations.some((d) => d.includes('Invoice')));
  assert.ok(res.outline.includes('calculateTotal'));
});

test('WCAG Checker Script', () => {
  assert.equal(getContrastRatio('#000000', '#ffffff'), 21);
  assert.equal(getContrastRatio('#ffffff', '#ffffff'), 1);
});

test('Semantic Skills Discovery Oracle', () => {
  const skills = [
    'skill-ui',
    'skill-context',
    'skill-audit',
    'skill-review',
    'skill-pipeline',
    'skill-orchestrate',
  ];

  for (const skill of skills) {
    const skillPath = join(repoRoot, skill, 'SKILL.md');
    assert.ok(existsSync(skillPath), `${skill}/SKILL.md exists`);
    const content = readFileSync(skillPath, 'utf8');

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fmMatch, `${skill} has YAML frontmatter`);
    const fm = fmMatch[1];
    assert.match(fm, /^name:\s*\S+/m, `${skill} has frontmatter name`);
    assert.match(fm, /^version:\s*\S+/m, `${skill} has frontmatter version`);
    assert.match(fm, /^description:\s*\S+/m, `${skill} has frontmatter description`);

    assert.match(content, /## When to Use/, `${skill} has 'When to Use'`);
    assert.match(content, /## NOT for/, `${skill} has 'NOT for'`);
  }
});

test('Privacy & Neutrality Scanner', () => {
  const forbidden = [
    'yorick',
    'zaun',
    'C:\\Users\\',
    '/home/',
  ];
  const selfPath = fileURLToPath(import.meta.url);

  function scan(dir) {
    const hits = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        hits.push(...scan(full));
      } else if (entry.isFile()) {
        if (full === selfPath) continue;
        const text = readFileSync(full, 'utf8');
        for (const term of forbidden) {
          if (text.toLowerCase().includes(term.toLowerCase())) {
            hits.push({ file: full, term });
          }
        }
      }
    }
    return hits;
  }

  const violations = scan(repoRoot);
  assert.deepEqual(violations, [], `Privacy or absolute path violations found: ${JSON.stringify(violations)}`);
});

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// ponytail: in-memory Kahn algorithm; upgrade to streaming DAG for 100k+ nodes
export function validateDAG(tasks = []) {
  if (!Array.isArray(tasks)) return { valid: false, cycles: [], missing_dependencies: [], waves: [] };

  const inDegree = new Map();
  const dependents = new Map();
  const knownIds = new Set(tasks.map((t) => t.id)), missing_dependencies = [];

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    dependents.set(t.id, []);
  }

  for (const t of tasks) {
    for (const dep of new Set(t.depends_on || [])) {
      if (!knownIds.has(dep)) { if (!missing_dependencies.includes(dep)) missing_dependencies.push(dep); }
      else { inDegree.set(t.id, inDegree.get(t.id) + 1); dependents.get(dep).push(t.id); }
    }
  }

  const waves = [];
  let currentWave = [];
  for (const t of tasks) {
    if (inDegree.get(t.id) === 0) currentWave.push(t.id);
  }

  let processed = 0;
  while (currentWave.length > 0) {
    waves.push(currentWave);
    processed += currentWave.length;
    const nextWave = [];
    for (const id of currentWave) {
      for (const nextId of dependents.get(id) || []) {
        const deg = inDegree.get(nextId) - 1;
        inDegree.set(nextId, deg);
        if (deg === 0) nextWave.push(nextId);
      }
    }
    currentWave = nextWave;
  }

  const valid = processed === tasks.length && missing_dependencies.length === 0;
  const cycles = valid ? [] : tasks.filter((t) => (inDegree.get(t.id) || 0) > 0).map((t) => t.id);

  return { valid, cycles, missing_dependencies, waves };
}

export default validateDAG;

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`DAG Validator

Usage:
  node scripts/dag_validator.js [tasks.json]
  cat tasks.json | node scripts/dag_validator.js

Validates DAG acyclicity and computes topological execution waves.`);
    process.exit(0);
  }

  try {
    const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    const result = validateDAG(JSON.parse(raw));
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

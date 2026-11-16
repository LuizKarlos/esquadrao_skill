#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const targetDirs = ['bin', 'src', 'scripts', 'tests'];

// ponytail: synchronous recursive walk; upgrade to stream/worker pipeline for repos >100k files
function collectFiles(dir, suffix) {
  const fullPath = path.join(repoRoot, dir);
  if (!fs.existsSync(fullPath)) return [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '__pycache__', '.git'].includes(entry.name)) continue;
      files.push(...collectFiles(path.relative(repoRoot, entryPath), suffix));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(entryPath);
    }
  }
  return files;
}

const jsFiles = targetDirs.flatMap((dir) => collectFiles(dir, '.js'));
const pyFiles = targetDirs.flatMap((dir) => collectFiles(dir, '.py'));

let failed = 0;
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  } catch {
    failed++;
  }
}

function findPython() {
  for (const cmd of ['python3', 'python']) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' });
      return cmd;
    } catch {}
  }
  return null;
}

const python = pyFiles.length > 0 ? findPython() : null;
if (python) {
  // py_compile grava bytecode; o prefixo mantém a árvore limpa.
  const pycache = path.join(os.tmpdir(), 'esquadrao-lint-pycache');
  for (const file of pyFiles) {
    try {
      execFileSync(python, ['-m', 'py_compile', file], {
        stdio: 'inherit',
        env: { ...process.env, PYTHONPYCACHEPREFIX: pycache },
      });
    } catch {
      failed++;
    }
  }
}

if (failed > 0) {
  console.error(`Lint check failed: ${failed} file(s) with syntax errors.`);
  process.exit(1);
}

if (pyFiles.length > 0 && !python && process.env.CI) {
  console.error(`Lint check failed: Python interpreter not found; cannot validate ${pyFiles.length} .py file(s).`);
  process.exit(1);
}

console.log(`Lint passed: verified ${jsFiles.length} files with node --check.`);
if (python) {
  console.log(`Lint passed: verified ${pyFiles.length} Python files with py_compile.`);
} else if (pyFiles.length > 0) {
  console.warn(`Lint skipped: Python interpreter not found; ${pyFiles.length} .py file(s) not checked.`);
}

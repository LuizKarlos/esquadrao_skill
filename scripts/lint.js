#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const targetDirs = ['bin', 'src', 'scripts', 'tests'];

function collectJsFiles(dir) {
  const fullPath = path.join(repoRoot, dir);
  if (!fs.existsSync(fullPath)) return [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(path.relative(repoRoot, entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  }
  return files;
}

const allJsFiles = targetDirs.flatMap(collectJsFiles);

let failed = 0;
for (const file of allJsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  } catch {
    failed++;
  }
}

if (failed > 0) {
  console.error(`Lint check failed: ${failed} file(s) with syntax errors.`);
  process.exit(1);
}

console.log(`Lint passed: verified ${allJsFiles.length} files with node --check.`);

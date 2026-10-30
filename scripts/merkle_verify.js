#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// ponytail: in-memory linear ledger verifier; upgrade to streaming Merkle tree for 10M+ blocks
export function canonicalStringify(val) {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map((v) => (v === undefined ? 'null' : canonicalStringify(v))).join(',')}]`;
  const keys = Object.keys(val).filter((k) => val[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(val[k])}`).join(',')}}`;
}

export function computeBlockHash(block) {
  if (!block || typeof block !== 'object') return '';
  const { hash: _, ...payload } = block;
  return createHash('sha256').update(canonicalStringify(payload)).digest('hex');
}

export function verifyLedger(blocks) {
  const list = Array.isArray(blocks) ? blocks : (Array.isArray(blocks?.blocks) ? blocks.blocks : null);
  if (!list) return { valid: false, blocks_verified: 0, errors: ['Ledger must be an array of blocks'] };
  if (list.length === 0) return { valid: true, blocks_verified: 0, errors: [] };

  const errors = [];
  const isGenesisPrevValid = (prev) =>
    prev === null || prev === undefined || prev === 0 || prev === '0' || prev === '' ||
    (typeof prev === 'string' && /^[0-9a-fA-F]{64}$/.test(prev));

  for (let i = 0; i < list.length; i++) {
    const block = list[i];
    if (!block || typeof block !== 'object') {
      errors.push(`Block ${i}: block must be an object`);
      continue;
    }

    if (i === 0) {
      if (!isGenesisPrevValid(block.previous_hash)) {
        errors.push(`Block 0: invalid previous_hash (${block.previous_hash})`);
      }
    } else {
      const prevHash = list[i - 1]?.hash;
      if (block.previous_hash !== prevHash) {
        errors.push(`Block ${i}: previous_hash mismatch (expected ${prevHash}, got ${block.previous_hash})`);
      }
    }

    const computed = computeBlockHash(block);
    if (!block.hash || block.hash !== computed) {
      errors.push(`Block ${i}: hash mismatch (declared ${block.hash}, computed ${computed})`);
    }
  }

  return { valid: errors.length === 0, blocks_verified: list.length, errors };
}

export default verifyLedger;

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`Merkle Ledger Integrity Verifier

Usage:
  node scripts/merkle_verify.js [ledger.json]
  cat ledger.json | node scripts/merkle_verify.js

Validates cryptographic hash continuity and payload integrity across blocks.`);
    process.exit(0);
  }

  try {
    const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    const result = verifyLedger(JSON.parse(raw));
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Resolve ffmpeg/ffprobe sem exigir instalação manual nem edição de PATH.
//
// Ordem: variável de ambiente -> cache do usuário -> binário embutido no pacote
// (optionalDependencies ffmpeg-static/ffprobe-static) -> PATH do sistema.
// O diretório encontrado é injetado no PATH do processo, então todo spawn
// existente continua funcionando sem mudanças.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EXE = process.platform === 'win32' ? '.exe' : '';
const TARGET = `${process.platform}-${process.arch}`;

export const BINARY_CACHE = path.join(os.homedir(), '.esquadrao', 'bin', TARGET);

const ENV_KEYS = { ffmpeg: 'ESQUADRAO_FFMPEG', ffprobe: 'ESQUADRAO_FFPROBE' };

function fromPackage(name) {
  try {
    if (name === 'ffmpeg') {
      const resolved = require('ffmpeg-static');
      return typeof resolved === 'string' && fs.existsSync(resolved) ? resolved : null;
    }
    const resolved = require('ffprobe-static');
    return resolved?.path && fs.existsSync(resolved.path) ? resolved.path : null;
  } catch {
    return null;
  }
}

/** Caminho utilizável para um binário, com a origem da resolução. */
export function resolveBinary(name) {
  if (!ENV_KEYS[name]) throw new Error(`Binário desconhecido: ${name}`);

  const override = process.env[ENV_KEYS[name]];
  if (override && fs.existsSync(override)) return { path: override, source: 'env' };

  const cached = path.join(BINARY_CACHE, `${name}${EXE}`);
  if (fs.existsSync(cached)) return { path: cached, source: 'cache' };

  const bundled = fromPackage(name);
  if (bundled) return { path: bundled, source: 'bundled' };

  return { path: name, source: 'path' };
}

/** Injeta os binários embutidos no PATH do processo. Silencioso e idempotente. */
export function ensureBundledPath() {
  const dirs = new Set();
  for (const name of ['ffmpeg', 'ffprobe']) {
    const { path: binary, source } = resolveBinary(name);
    if (source !== 'path') dirs.add(path.dirname(binary));
  }
  if (dirs.size === 0) return null;

  const prefix = [...dirs].join(path.delimiter);
  if (!process.env.PATH?.startsWith(prefix)) {
    process.env.PATH = `${prefix}${path.delimiter}${process.env.PATH || ''}`;
  }
  return prefix;
}

/** Relatório curto para `setup`/`doctor`, sem executar os binários. */
export function binaryReport() {
  return Object.fromEntries(
    ['ffmpeg', 'ffprobe'].map((name) => {
      const resolved = resolveBinary(name);
      return [name, resolved.source === 'path' ? { source: 'system', path: null } : resolved];
    })
  );
}

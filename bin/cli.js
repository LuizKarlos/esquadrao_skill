#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

if (typeof process.loadEnvFile === 'function' && existsSync('.env')) {
  try { process.loadEnvFile(); } catch {}
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const { values: flags, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    json: { type: 'boolean' },
    dest: { type: 'string' },
    mode: { type: 'string' },
    file: { type: 'string', multiple: true },
    plan: { type: 'string' },
    verbose: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
    format: { type: 'string' },
    'silence-thresh': { type: 'string' },
    'silence-duration': { type: 'string' },
    'caption-style': { type: 'string' },
    openai: { type: 'boolean' },
    local: { type: 'boolean' },
    captions: { type: 'string' },
  },
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

if (flags.version || command === 'version' || flags.v) {
  console.log(pkg.version);
  process.exit(0);
}

const SUBCOMMANDS = new Set(['setup', 'role', 'studio', 'onboard']);

if (!command || command === 'help' || (flags.help && !SUBCOMMANDS.has(command))) {
  console.log(`Esquadrão CLI / Universal Skill CLI v${pkg.version}

Usage:
  esquadrao <command> [options]
  universal-skill <command> [options]

Commands:
  setup       Instala os skills nos ambientes de agentes (.agents, .claude, .codex, .cursor)
  role        Lista, inspeciona e executa papéis canônicos da esteira
  studio      Estúdio local de vídeo: init, import, render, qa, auto-clip
  onboard     Guia interativo: da mídia bruta ao primeiro corte renderizado
  version     Exibe a versão do CLI
  help        Exibe mensagens de ajuda

Options:
  -h, --help                Show help
  -v, --version             Show version
  --json                    Output results in JSON format
  --dest <path>             Custom destination directory for skills or workspace
  --mode <mode>             Video mode for onboarding (edit_only, dark, podcast_clip)
  --file <path>             Source media file for onboarding (can be repeated)
  --format <9:16|16:9>      Aspect ratio (padrão: 9:16)
  --silence-thresh <dB>     Sensibilidade de silêncio (padrão: -30dB)
  --silence-duration <sec>  Pausa mínima para corte (padrão: 0.8s)
  --caption-style <style>   Estilo de legendas: impact (padrão), word, full
  --openai                  Usar API OpenAI Whisper para transcrição
  --local                   Usar Whisper local (offline)
  --captions <file.srt>     Arquivo de legendas externo`);
  process.exit(0);
}

if (!SUBCOMMANDS.has(command)) {
  console.error(`Unknown command: '${command}'. Run 'universal-skill --help' for available commands.`);
  process.exit(1);
}

// ponytail: direct file resolution for command modules; upgrade when complex routing needed.
const candidates = [
  new URL(`../src/commands/${command}.js`, import.meta.url),
  new URL(`../src/${command}.js`, import.meta.url),
];
const target = candidates.find((url) => existsSync(url));

if (!target) {
  console.error(`Command '${command}' is not yet implemented.`);
  process.exit(1);
}

try {
  const mod = await import(target.href);
  const handler = mod.run || mod.default || mod[command];
  if (typeof handler !== 'function') {
    throw new Error(`Command module '${command}' does not export a runnable function.`);
  }
  await handler({ positionals: positionals.slice(1), flags });
} catch (err) {
  console.error(`Error executing '${command}':`, err.message);
  process.exit(1);
}

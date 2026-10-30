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
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

if (flags.version || command === 'version' || flags.v) {
  console.log(pkg.version);
  process.exit(0);
}

if (flags.help || command === 'help' || !command) {
  console.log(`Universal Skill CLI v${pkg.version}

Usage:
  universal-skill <command> [options]

Commands:
  setup       Install skills into agent harnesses (.agents, .claude, .codex, .cursor)
  role        List, inspect, and generate prompts for industry roles
  version     Display CLI version
  help        Display help information

Options:
  -h, --help       Show help
  -v, --version    Show version
  --json           Output results in JSON format
  --dest <path>    Custom destination directory for skills`);
  process.exit(0);
}

const SUBCOMMANDS = new Set(['setup', 'role']);
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

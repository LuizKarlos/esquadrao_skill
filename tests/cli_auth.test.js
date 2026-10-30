import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

function runCliAsync(args, envOverrides = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...envOverrides };
    const child = spawn(process.execPath, [binPath, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      resolve({ status: code, stdout, stderr });
    });
  });
}

test('CLI Invocation: --version, -v, version, --help, -h, help', async () => {
  const v1 = await runCliAsync(['--version']);
  assert.equal(v1.status, 0);
  assert.equal(v1.stdout.trim(), pkg.version);

  const v2 = await runCliAsync(['-v']);
  assert.equal(v2.status, 0);
  assert.equal(v2.stdout.trim(), pkg.version);

  const v3 = await runCliAsync(['version']);
  assert.equal(v3.status, 0);
  assert.equal(v3.stdout.trim(), pkg.version);

  const h1 = await runCliAsync(['--help']);
  assert.equal(h1.status, 0);
  assert.match(h1.stdout, /Universal Skill CLI/);

  const h2 = await runCliAsync(['-h']);
  assert.equal(h2.status, 0);
  assert.match(h2.stdout, /Usage:/);

  const h3 = await runCliAsync(['help']);
  assert.equal(h3.status, 0);
  assert.match(h3.stdout, /Commands:/);

  const h4 = await runCliAsync([]);
  assert.equal(h4.status, 0);
  assert.match(h4.stdout, /Commands:/);
});

test('CLI Errors: Unknown commands exit with code 1', async () => {
  const r1 = await runCliAsync(['invalid_command_xyz']);
  assert.equal(r1.status, 1, 'Unknown command should exit with code 1');
  assert.match(r1.stderr, /Unknown command: 'invalid_command_xyz'/);

  const r2 = await runCliAsync(['call']);
  assert.equal(r2.status, 1, 'Removed call command should exit with code 1');

  const r3 = await runCliAsync(['status']);
  assert.equal(r3.status, 1, 'Removed status command should exit with code 1');

  const r4 = await runCliAsync(['login']);
  assert.equal(r4.status, 1, 'Removed login command should exit with code 1');
});

test('CLI Setup: installs skills locally without MCP config emission', async () => {
  const tmp = path.join(os.tmpdir(), `universal-setup-${Date.now()}`);
  try {
    const res = await runCliAsync(['setup', '--dest', tmp, '--json']);
    assert.equal(res.status, 0);
    const report = JSON.parse(res.stdout);
    assert.equal(report.status, 'ok');
    assert.ok(report.installation.installed.length >= 18);
    assert.equal(fs.existsSync(path.join(tmp, 'skill-orchestrate')), true);
    assert.equal(fs.existsSync(path.join(tmp, 'mcp.json')), false, 'mcp.json must not be emitted');
    assert.equal(report.mcpConfig, undefined, 'mcpConfig must not be in report');
    assert.equal(report.connectivity, undefined, 'connectivity must not be in report');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

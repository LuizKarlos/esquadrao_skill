import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Zero config: FFmpeg embutido e injetado no PATH do processo', () => {
  const pkg = JSON.parse(read('package.json'));
  // 5.2.0 é o último build estático com drawtext; 5.3+ quebra legendas.
  assert.equal(pkg.optionalDependencies['ffmpeg-static'], '5.2.0');
  assert.ok(pkg.optionalDependencies['ffprobe-static']);

  const binaries = read('src/binaries.js');
  assert.match(binaries, /export function ensureBundledPath/);
  assert.match(binaries, /process\.env\.PATH/);
  assert.match(binaries, /ffmpeg-static/);

  const cli = read('bin/cli.js');
  assert.match(cli, /ensureBundledPath\(\)/, 'CLI injeta os binários antes de executar');
});

test('Zero config: nenhuma instrução de instalação manual de FFmpeg', () => {
  const readme = read('README.md');
  assert.match(readme, /embutid/i);
  assert.doesNotMatch(readme, /brew install ffmpeg/i);
  assert.doesNotMatch(readme, /winget install/i);
  assert.doesNotMatch(readme, /apt install -y ffmpeg/i);

  const setup = read('src/commands/setup.js');
  assert.doesNotMatch(setup, /sudo apt-get|brew install|winget install/, 'setup não pode exigir admin');

  const onboard = read('src/commands/onboard.js');
  assert.match(onboard, /embutido/i);
  assert.doesNotMatch(onboard, /brew install|winget|apt install/i);
});

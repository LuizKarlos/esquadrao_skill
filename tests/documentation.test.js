import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '../..');
const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));
const help = execFileSync(process.execPath, [join(repoRoot, 'bin', 'cli.js'), '--help'], { encoding: 'utf8' });

test('Documentação Canônica: presença, integridade e referências cruzadas', () => {
  for (const doc of ['SPEC.md', 'ROADMAP.md', 'GLOSSARY.md', 'README.md']) {
    assert.ok(existsSync(join(repoRoot, doc)), `${doc} deve existir na raiz`);
  }

  const spec = read('SPEC.md');
  const roadmap = read('ROADMAP.md');
  const glossary = read('GLOSSARY.md');
  const readme = read('README.md');

  // Referências cruzadas obrigatórias
  for (const doc of [spec, roadmap, readme]) {
    assert.ok(doc.includes('GLOSSARY.md'), 'deve referenciar GLOSSARY.md');
    assert.ok(doc.includes('SPEC.md') || doc === spec, 'deve referenciar SPEC.md');
    assert.ok(doc.includes('ROADMAP.md') || doc === roadmap, 'deve referenciar ROADMAP.md');
  }

  // Nome comercial oficial e pacote npm
  assert.ok(spec.includes('Esquadrão de Conteúdo'), 'SPEC.md deve citar Esquadrão de Conteúdo');
  assert.ok(spec.includes('@esquadrao/cli'), 'SPEC.md deve citar @esquadrao/cli');
  assert.ok(readme.includes('Esquadrão de Conteúdo'), 'README.md deve citar Esquadrão de Conteúdo');
  assert.ok(readme.includes('@esquadrao/cli'), 'README.md deve citar @esquadrao/cli');

  // Modos de Onboard documentados
  for (const mode of ['dark', 'edit_only', 'podcast_clip']) {
    assert.ok(spec.includes(mode), `SPEC.md deve documentar modo ${mode}`);
    assert.ok(glossary.includes(mode), `GLOSSARY.md deve documentar modo ${mode}`);
  }

  // 12 papéis canônicos documentados na SPEC
  for (const role of [
    'product-manager',
    'system-analyst',
    'software-architect',
    'tech-lead',
    'security-engineer',
    'software-engineer',
    'code-reviewer',
    'sre-engineer',
    'qa-engineer',
    'technical-writer',
    'engineering-manager',
    'media-producer',
  ]) {
    assert.ok(spec.includes(role), `SPEC.md deve documentar papel ${role}`);
  }

  // Códigos de saída em GLOSSARY.md
  for (const code of ['`0`', '`1`', '`130`']) {
    assert.ok(glossary.includes(code), `GLOSSARY.md deve documentar código ${code}`);
  }

  // Contratos de versão, binário, perfil e flags (CLI-11)
  assert.ok(spec.includes(`**Versão:** ${pkg.version}`), `SPEC.md deve declarar a versão ${pkg.version}`);
  assert.deepEqual(Object.keys(pkg.bin), ['esquadrao'], 'package.json deve expor apenas o binário esquadrao');
  assert.ok(spec.includes('<workspace>/.esquadrao/profile.json'), 'SPEC.md deve documentar o perfil no workspace');
  for (const flag of ['--broll', '--music', '--layout', '--overlay-duration', '--background', '--engine', '--fps', '--python']) {
    assert.ok(help.includes(flag), `--help deve listar ${flag}`);
  }
  assert.ok(spec.includes('split_top'), 'SPEC.md deve documentar split_top');
  assert.ok(spec.includes('--layout <fullscreen|pip|split_bottom|split_top>'), 'SPEC.md deve documentar todos os layouts de auto-clip');
  assert.ok(spec.includes('studio batch') || spec.includes('`batch`'), 'SPEC.md deve documentar o batch');

  // Toda assinatura de --layout na SPEC deve listar os quatro layouts, incluindo split_top
  const layoutSignatures = [...spec.matchAll(/--layout <([^>]+)>/g)].map((m) => m[1].split('|'));
  assert.ok(layoutSignatures.length > 0, 'SPEC.md deve documentar a assinatura de --layout');
  for (const layouts of layoutSignatures) {
    assert.deepEqual(layouts, ['fullscreen', 'pip', 'split_bottom', 'split_top'], 'SPEC.md deve listar split_top em toda assinatura de --layout');
  }
  assert.ok(readme.includes('split_top') && readme.includes('split_bottom'), 'README.md deve listar split_top e split_bottom');
  assert.match(help, /fullscreen, pip, split_bottom ou split_top/, '--help deve listar os quatro layouts');

  // Caminho de perfil consistente entre documentação e implementação
  const profilePath = '<workspace>/.esquadrao/profile.json';
  const discoveryRule = 'Sem `--dest`, o CLI descobre o workspace subindo a partir do diretório atual até encontrar `studio.json`';
  for (const [docName, doc] of [['SPEC.md', spec], ['README.md', readme], ['GLOSSARY.md', glossary]]) {
    assert.ok(doc.includes(profilePath), `${docName} deve documentar ${profilePath}`);
    assert.equal(doc.includes('~/.esquadrao/profile.json'), false, `${docName} não deve citar perfil fora do workspace`);
  }
  assert.ok(spec.includes(discoveryRule), 'SPEC.md deve documentar a descoberta do workspace sem --dest');
  assert.ok(readme.includes(discoveryRule), 'README.md deve documentar a descoberta do workspace sem --dest');
  assert.ok(read('skill-media-producer/SKILL.md').includes(profilePath), 'SKILL.md deve documentar o perfil do workspace');
  const onboardSource = read('src/commands/onboard.js');
  assert.ok(onboardSource.includes("'.esquadrao', 'profile.json'"), 'onboard deve gravar o perfil no workspace');
  assert.ok(onboardSource.includes('manifest.profile = profileData'), 'onboard deve espelhar o perfil em studio.json');
  assert.equal(read('CHANGELOG.md').includes('~/.esquadrao/profile.json'), false, 'CHANGELOG.md não deve citar perfil de usuário inexistente');

  const initialConfig = read('skill-media-producer/references/configuracao-inicial.md');
  assert.ok(initialConfig.includes('caption_template'), 'guia inicial deve documentar caption_template');
  assert.equal(
    initialConfig.includes('Transcrição automática e importação SRT também ficam fora deste fluxo atual'),
    false,
    'guia inicial não deve negar recursos já implementados',
  );

  const specialCompositions = read('skill-media-producer/references/composicoes-especiais.md');
  assert.match(
    specialCompositions,
    /python3 -m pip install "rembg\[cpu\]" onnxruntime opencv-python-headless numpy pillow/,
    'guia de cutout deve listar pillow',
  );
  assert.ok(specialCompositions.includes('CLI 1.7.0'), 'guia de composições especiais deve referenciar CLI 1.7.0');
});

test('Documentação Anti-Delírio: ausência de termos enganosos ou promessas falsas', () => {
  const docs = [
    read('SPEC.md'),
    read('ROADMAP.md'),
    read('GLOSSARY.md'),
    read('README.md'),
  ].join('\n').toLowerCase();

  const FORBIDDEN_WORDS = [
    'serial number',
    'order bump',
    'upsell',
  ];

  for (const word of FORBIDDEN_WORDS) {
    assert.equal(docs.includes(word), false, `Termo proibido encontrado na documentação: ${word}`);
  }
});

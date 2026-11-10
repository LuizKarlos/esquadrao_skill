import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '../..');
const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

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

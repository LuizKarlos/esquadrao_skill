#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// ponytail: regex AST signature slicer; upgrade to tree-sitter for deep AST traversal
export function sliceAst(code = '', lang = 'auto') {
  if (typeof code !== 'string') return { lang, declarations: [], outline: '' };
  const detected = lang && lang !== 'auto'
    ? (lang.toLowerCase().includes('py') ? 'py' : lang.toLowerCase().includes('ts') ? 'ts' : 'js')
    : (/^[ \t]*(?:class\s+\w+|(?:async\s+)?def\s+\w+)/m.test(code) ? 'py' : (/\b(?:interface\s+\w+|type\s+\w+\s*=|:\s*(?:string|number|boolean|any|void|unknown|Promise)\b)/.test(code) ? 'ts' : 'js'));

  const decls = [];
  let curr = null;
  const isPy = detected === 'py';
  const startRe = isPy ? /^[ \t]*(?:class\s+\w+|(?:async\s+)?def\s+\w+)/ : /^[ \t]*(?:export\b|(?:async\s+)?function\*?\b|class\b|interface\b|type\b)/;
  const pyMatch = /^([ \t]*(?:class\s+\w+(?:\([^)]*\))?|(?:async\s+)?def\s+[\w$]+\s*\([^)]*\)\s*(?:->\s*[^:]+)?)\s*:)/;
  const cleanJs = (s) => (/^[ \t]*export\s*\{/.test(s) ? s.trim() : s.replace(/\s*\{.*\}\s*;?$/, '').replace(/\s*\{.*$/, '').trim());

  for (const line of code.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || (!isPy && (trimmed.startsWith('//') || trimmed.startsWith('/*')))) continue;
    if (curr) {
      curr += ' ' + trimmed;
      if (isPy) {
        const m = curr.match(pyMatch);
        if (m) { decls.push(m[1]); curr = null; }
      } else if (curr.includes('{') || curr.includes(';')) {
        decls.push(cleanJs(curr));
        curr = null;
      }
    } else if (startRe.test(line)) {
      if (isPy) {
        const m = line.match(pyMatch);
        if (m) decls.push(m[1]);
        else curr = line.trimEnd();
      } else if (/^[ \t]*export\s*\{/.test(line) || /^[ \t]*type\b/.test(line)) decls.push(trimmed);
      else if (line.includes('{')) decls.push(cleanJs(trimmed));
      else if (line.includes(';') || (!line.includes('(') && !line.includes('function') && !line.includes('class'))) decls.push(trimmed);
      else curr = trimmed;
    }
  }
  return { lang: detected, declarations: decls, outline: decls.join('\n') };
}

export default sliceAst;

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`AST Context Slicer\n\nUsage:\n  node scripts/ast_slice.js [file] [flags]\n  cat file | node scripts/ast_slice.js [flags]\n\nFlags:\n  --json           Output JSON object instead of raw outline\n  --lang=js|ts|py  Force language parser\n  --help, -h       Show help`);
    process.exit(0);
  }
  try {
    const isJson = args.includes('--json');
    const langFlag = args.find((a) => a.startsWith('--lang='));
    let lang = langFlag ? langFlag.split('=')[1] : 'auto';
    const file = args.find((a) => !a.startsWith('-'));
    if (lang === 'auto' && file) {
      if (/\.py$/i.test(file)) lang = 'py';
      else if (/\.tsx?$/i.test(file)) lang = 'ts';
      else if (/\.c?jsx?$/i.test(file)) lang = 'js';
    }
    const raw = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
    const res = sliceAst(raw, lang);
    console.log(isJson ? JSON.stringify(res, null, 2) : res.outline);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

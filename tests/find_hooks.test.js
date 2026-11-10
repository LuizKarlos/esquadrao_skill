import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  scoreHookSentence,
  findCandidateClips,
  checkBinary,
} from '../src/commands/studio.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = path.join(repoRoot, 'bin', 'cli.js');

test('Find-Hooks: scoreHookSentence awards higher scores to strong hooks and questions', () => {
  const boring = scoreHookSentence('Boa tarde pessoal, tudo bem por aí?');
  const strong = scoreHookSentence('O maior erro de quem tenta criar conteúdo todo dia!');
  const questionHook = scoreHookSentence('Por que você nunca deve postar vídeo sem legenda?');

  assert.ok(strong > 2.0, `Strong hook score was ${strong}`);
  assert.ok(questionHook > 2.0, `Question hook score was ${questionHook}`);
  assert.ok(strong > boring);
});

test('Find-Hooks: findCandidateClips isolates 30s-60s contiguous clips with punchline', () => {
  const sampleSegments = [
    { id: 1, start_s: 0.0, end_s: 5.0, text: 'Introdução qualquer do vídeo.' },
    { id: 2, start_s: 5.0, end_s: 15.0, text: 'O maior segredo para viralizar cortes em canais dark.' },
    { id: 3, start_s: 15.0, end_s: 30.0, text: 'Você precisa manter o espectador preso nos primeiros 3 segundos.' },
    { id: 4, start_s: 30.0, end_s: 48.0, text: 'Usando B-rolls dinâmicos e legendas sincronizadas palavra por palavra.' },
    { id: 5, start_s: 48.0, end_s: 60.0, text: 'Essa é a única forma de construir uma audiência sólida sem gastar com anúncio.' },
    { id: 6, start_s: 60.0, end_s: 70.0, text: 'E aí pessoal, curtiram a dica?' },
  ];

  const candidates = findCandidateClips(sampleSegments, { minDurationSec: 30, maxDurationSec: 60 });
  assert.ok(candidates.length >= 1, 'Should find at least 1 candidate');

  const top = candidates[0];
  assert.equal(top.hook_text, 'O maior segredo para viralizar cortes em canais dark.');
  assert.ok(top.duration_s >= 30 && top.duration_s <= 60);
  assert.equal(top.start_s, 5.0);
});

test('Find-Hooks: CLI find-hooks command parses transcript.json and returns rankings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-cli-'));
  const transcriptFile = path.join(tmpDir, 'transcript.json');

  try {
    const data = {
      file: 'podcast.mp4',
      segments: [
        { id: 1, start_s: 0.0, end_s: 10.0, text: 'Apresentação inicial.' },
        { id: 2, start_s: 10.0, end_s: 25.0, text: 'O maior problema de quem edita vídeo manualmente.' },
        { id: 3, start_s: 25.0, end_s: 45.0, text: 'Você passa 4 horas cortando pausas na linha de tempo.' },
        { id: 4, start_s: 45.0, end_s: 55.0, text: 'Com automação local em lote você resolve tudo em 3 minutos.' },
      ],
    };
    fs.writeFileSync(transcriptFile, JSON.stringify(data, null, 2));

    const res = spawnSync(process.execPath, [
      binPath,
      'studio',
      'find-hooks',
      transcriptFile,
      '--min-dur', '30',
      '--max-dur', '60',
      '--json',
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0, `CLI find-hooks failed: ${res.stderr}`);
    const report = JSON.parse(res.stdout);
    assert.equal(report.file, 'transcript.json');
    assert.ok(report.candidates_count >= 1);
    assert.equal(report.top_clips[0].start_s, 10.0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Auto-Clip: executes end-to-end with --broll and --music', (t) => {
  if (!checkBinary('ffmpeg') || !checkBinary('ffprobe')) {
    t.skip('ffmpeg/ffprobe not found');
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclip-dyn-'));
  const speakerVid = path.join(tmpDir, 'speaker.mp4');
  const brollVid = path.join(tmpDir, 'broll.mp4');
  const musicFile = path.join(tmpDir, 'music.mp3');
  const captionsSrt = path.join(tmpDir, 'captions.srt');

  try {
    // Generate speaker: 2s tone + 1s silence + 2s tone = 5.0s
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:r=30:d=5',
      '-f', 'lavfi', '-i', 'sine=frequency=400:duration=2',
      '-f', 'lavfi', '-i', 'anullsrc=duration=1',
      '-f', 'lavfi', '-i', 'sine=frequency=400:duration=2',
      '-filter_complex', '[1:a][2:a][3:a]concat=n=3:v=0:a=1[outa]',
      '-map', '0:v', '-map', '[outa]',
      '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p',
      speakerVid,
    ], { stdio: 'ignore' });

    // Generate broll (2s, blue)
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'color=c=blue:s=1080x1920:r=30:d=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      brollVid,
    ], { stdio: 'ignore' });

    // Generate music (5s)
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'sine=frequency=800:duration=5',
      '-c:a', 'libmp3lame',
      musicFile,
    ], { stdio: 'ignore' });

    // SRT
    fs.writeFileSync(captionsSrt, `1\n00:00:00,100 --> 00:00:01,800\nO maior segredo\n\n2\n00:00:03,100 --> 00:00:04,800\nDe canais dark\n`, 'utf8');

    // Run auto-clip with broll and music
    const res = spawnSync(process.execPath, [
      binPath,
      'studio',
      'auto-clip',
      speakerVid,
      '--dest', tmpDir,
      '--captions', captionsSrt,
      '--broll', brollVid,
      '--music', musicFile,
      '--json',
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0, `auto-clip with broll/music failed: ${res.stderr || res.stdout}`);
    const report = JSON.parse(res.stdout);
    assert.equal(report.status, 'ok');
    assert.equal(report.qa.passed, true, 'Composite video must pass QA');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

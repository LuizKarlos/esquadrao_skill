import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transcribeAudio, checkBinary } from '../src/commands/studio.js';

// Opt-in real-engine test. Run with:
//   ESQUADRAO_LOCAL_WHISPER=1 ESQUADRAO_WHISPER_SAMPLE=/path/to/speech.wav \
//     node --test tests/local_whisper.integration.test.js
const enabled = process.env.ESQUADRAO_LOCAL_WHISPER === '1';

test('Local Whisper: transcribes a real speech sample', { skip: !enabled }, async (t) => {
  if (!checkBinary('ffmpeg')) {
    t.skip('ffmpeg not found');
    return;
  }
  const sample = process.env.ESQUADRAO_WHISPER_SAMPLE;
  if (!sample || !fs.existsSync(sample)) {
    t.skip('ESQUADRAO_WHISPER_SAMPLE not set or missing');
    return;
  }
  const words = await transcribeAudio(sample, { requireLocal: true });
  assert.ok(words.length > 0, 'local Whisper must return words');
  const text = words.map((w) => w.word).join(' ').toLowerCase();
  assert.match(text, /country|americans|ask/, `unexpected transcript: ${text}`);
});

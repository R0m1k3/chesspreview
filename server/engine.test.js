import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOllamaUrl, parseInfo } from './engine.js';

test('parse une ligne MultiPV Stockfish', () => {
  assert.deepEqual(parseInfo('info depth 16 multipv 2 score cp -34 nodes 4 pv e2e4 e7e5'), {
    depth: 16, multipv: 2, score: { type: 'cp', value: -34 }, pv: ['e2e4', 'e7e5'],
  });
});

test('normalise URL Ollama', () => {
  assert.equal(normalizeOllamaUrl('http://192.168.1.3:11434/'), 'http://192.168.1.3:11434');
  assert.throws(() => normalizeOllamaUrl('file:///etc/passwd'));
});

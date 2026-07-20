import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFen } from './position.js';

test('construit FEN depuis position composée', () => {
  const position = { e1: { type: 'k', color: 'w' }, e8: { type: 'k', color: 'b' }, d4: { type: 'q', color: 'w' } };
  assert.equal(buildFen(position, 'b'), '4k3/8/8/8/3Q4/8/8/4K3 b - - 0 1');
});

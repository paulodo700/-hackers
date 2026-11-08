import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';

test('mesma semente gera a mesma sequência', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('estado salvo e recriado continua a sequência de onde parou', () => {
  const r = mulberry32(7);
  r(); r(); r();
  const saved = r.state();
  const next = [r(), r(), r()];
  const resumed = mulberry32(saved);
  assert.deepEqual([resumed(), resumed(), resumed()], next);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeClock } from '../../src/index.mjs';

test('FakeClock advances time deterministically', async () => {
  const clock = new FakeClock('2026-03-22T00:00:00.000Z');

  assert.equal(clock.now(), '2026-03-22T00:00:00.000Z');
  assert.equal(clock.nowMs(), Date.parse('2026-03-22T00:00:00.000Z'));

  await clock.advanceBy(1500);

  assert.equal(clock.now(), '2026-03-22T00:00:01.500Z');
});

test('FakeClock resolves sleep without wall time', async () => {
  const clock = new FakeClock('2026-03-22T00:00:00.000Z');
  let resolved = false;

  const sleeper = clock.sleep(250).then(() => {
    resolved = true;
  });

  await clock.advanceBy(249);
  assert.equal(resolved, false);

  await clock.advanceBy(1);
  await sleeper;

  assert.equal(resolved, true);
});

test('FakeClock drives interval callbacks in order', async () => {
  const clock = new FakeClock('2026-03-22T00:00:00.000Z');
  const ticks = [];

  const handle = clock.setInterval(() => {
    ticks.push(clock.now());
  }, 100);

  await clock.advanceBy(350);
  clock.clearInterval(handle);

  assert.deepEqual(ticks, [
    '2026-03-22T00:00:00.100Z',
    '2026-03-22T00:00:00.200Z',
    '2026-03-22T00:00:00.300Z'
  ]);
});

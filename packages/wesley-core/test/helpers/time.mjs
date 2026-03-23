import { FakeClock } from '../../src/index.mjs';

export const FIXED_TEST_CLOCK_ISO = '2026-03-22T00:00:00.000Z';

export function createTestClock(isoTimestamp = FIXED_TEST_CLOCK_ISO) {
  return new FakeClock(isoTimestamp);
}

export async function advanceTestClock(clock, ms) {
  if (typeof clock.advanceBy === 'function') {
    await clock.advanceBy(ms);
    return;
  }

  await clock.sleep(ms);
}

export function createSeededRandom(seed = 0x5eed1234) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

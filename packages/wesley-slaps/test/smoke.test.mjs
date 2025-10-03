import { describe, it, expect } from 'vitest';

describe('wesley-slaps smoke', () => {
  it('loads module', async () => {
    const mod = await import('../src/index.mjs');
    expect(mod).toBeTruthy();
  });
});


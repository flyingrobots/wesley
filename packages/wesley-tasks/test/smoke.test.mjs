import { describe, it, expect } from 'vitest';

describe('wesley-tasks smoke', () => {
  it('loads module', async () => {
    const mod = await import('../src/index.mjs');
    expect(mod).toBeTruthy();
  });
});


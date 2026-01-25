import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';

describe('wesley-generator-echo', () => {
  it('should export a generateEcho function', () => {
    expect(typeof generateEcho).toBe('function');
  });

  it('should reject when called without sdl', async () => {
    await expect(generateEcho()).rejects.toThrow('GraphQL SDL string is required');
  });
});

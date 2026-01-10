import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';

describe('wesley-generator-echo', () => {
  it('should export a generateEcho function', () => {
    expect(typeof generateEcho).toBe('function');
  });
});

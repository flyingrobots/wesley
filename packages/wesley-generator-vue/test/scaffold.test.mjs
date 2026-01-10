import { describe, it, expect } from 'vitest';
import { generateVue } from '../src/index.mjs';

describe('wesley-generator-vue', () => {
  it('should export a generateVue function', () => {
    expect(typeof generateVue).toBe('function');
  });
});

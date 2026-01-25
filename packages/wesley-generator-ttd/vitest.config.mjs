import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.mjs'],
    },
  },
  resolve: {
    alias: {
      '@wesley/core/ttd': new URL('../wesley-core/src/ttd/index.mjs', import.meta.url).pathname,
      '@wesley/core/ttd/invariants': new URL('../wesley-core/src/ttd/invariants/index.mjs', import.meta.url).pathname,
    },
  },
});

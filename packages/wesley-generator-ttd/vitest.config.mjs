import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.mjs']
    }
  },
  resolve: {
    alias: {
      // More specific aliases must come first
      '@wesley/core/ttd/invariants': fileURLToPath(new URL('../wesley-core/src/ttd/invariants/index.mjs', import.meta.url)),
      '@wesley/core/ttd': fileURLToPath(new URL('../wesley-core/src/ttd/index.mjs', import.meta.url))
    }
  }
});

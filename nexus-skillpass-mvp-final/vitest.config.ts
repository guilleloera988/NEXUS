import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
      // Server-only modules are imported directly by unit tests; the guard itself only matters to the Next bundler.
      'server-only': path.resolve(here, 'tests/stubs/server-only.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120000, hookTimeout: 180000, fileParallelism: false },
});

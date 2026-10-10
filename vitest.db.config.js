import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/db/**/*.test.js'], environment: 'node', testTimeout: 30000, hookTimeout: 30000, fileParallelism: false }
});

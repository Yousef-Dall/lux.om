import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.integration.test.ts'],
    setupFiles: ['./tests/integration/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    passWithNoTests: false
  }
});

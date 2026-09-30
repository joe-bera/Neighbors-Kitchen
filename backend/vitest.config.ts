import { defineConfig } from 'vitest/config';
import { testEnv } from './tests/testEnv.ts';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    // All test files share one database, so run them one at a time.
    fileParallelism: false,
    env: testEnv,
  },
});

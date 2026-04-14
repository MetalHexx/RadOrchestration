import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run all test files sequentially to avoid concurrent writes to the shared
    // test fixture directory (/tmp/test-project/PARITY-TEST/template.yml).
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

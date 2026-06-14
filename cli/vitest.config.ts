import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Build the shared cli/dist once before any test runs (see tests/global-setup.ts).
    globalSetup: ['./tests/global-setup.ts'],
    // Binary/bundle tests exec a shared cli/dist build. Running test files in
    // parallel let concurrent `tsc` invocations corrupt that directory mid-write,
    // surfacing as intermittent "missing export" SyntaxErrors in CI. Serialize
    // file execution so the shared dist stays consistent.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});

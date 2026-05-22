import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // P03-T02 added shape-locking + smoke files under `lib/__tests__/` using
    // the `node:test` runner. The scripts package's `test` script runs
    // `vitest run`, and vitest's default test discovery picks any
    // `*.test.{js,ts}` up, so those files would fail with "No test suite
    // found". The vitest-format coverage of the same behavior lives under
    // `tests/` (see context-enrichment-skills-block.test.ts), so we keep
    // vitest scoped to that folder and leave the node:test files for the
    // separate runner they were authored against.
    include: ['tests/**/*.test.{ts,js}'],
    exclude: ['node_modules/**', 'lib/__tests__/**'],
  },
});

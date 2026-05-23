import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..', '..');

const EXISTING_PIPELINE_TESTS = [
  'tests/commands/pipeline/signal-cli.test.ts',
  'tests/commands/pipeline/signal-core.test.ts',
  'tests/commands/pipeline/e2e-bundle.test.ts',
  'tests/commands/pipeline/parse-error.test.ts',
  'tests/commands/pipeline/skill-call-form-guard.test.ts',
  'tests/lib/pipeline-engine/context-enrichment.test.ts',
  'tests/lib/pipeline-engine/path-context.test.ts',
  'tests/lib/pipeline-engine/result-shape.test.ts',
  'tests/lib/pipeline-engine/structural-import.test.ts',
];

const KNOWN_DEV_DEPS = new Set([
  'esbuild', '@types/js-yaml', '@types/node', '@vitest/coverage-v8',
  'eslint', 'prettier', 'typescript', 'typescript-eslint', 'vitest',
]);

describe('behavioral tier guards', () => {
  it('every existing pipeline test file is still present (FR-13 additive-only)', () => {
    for (const rel of EXISTING_PIPELINE_TESTS) {
      expect(fs.existsSync(path.join(CLI_ROOT, rel)), `${rel} missing — FR-13 forbids deletion`).toBe(true);
    }
  });

  it('cli/package.json devDependencies set has not grown beyond the planning-time set (AD-12)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(CLI_ROOT, 'package.json'), 'utf8'));
    const current = new Set(Object.keys(pkg.devDependencies ?? {}));
    const extras = [...current].filter(d => !KNOWN_DEV_DEPS.has(d));
    expect(extras, `unexpected new devDependencies (AD-12): ${extras.join(', ')}`).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const engineSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../src/lib/pipeline-engine/engine.ts'),
  'utf8',
);

describe('post-cutover invariant: optimisticallyMarkStepInProgress is gone', () => {
  it('engine.ts no longer declares or calls the helper', () => {
    expect(engineSrc).not.toMatch(/optimisticallyMarkStepInProgress/);
  });

  it('the engine.ts file does not write step-node status to in_progress anywhere', () => {
    // Any post-walk write of node.status = 'in_progress' would defeat the
    // single-source-of-truth contract (NFR-1). The walker owns this seam.
    expect(engineSrc).not.toMatch(/\.status\s*=\s*['"]in_progress['"]/);
  });

  it('the unit test for the deleted helper is gone from the tree', () => {
    const optTestPath = path.resolve(__dirname, 'engine-optimistic.test.ts');
    expect(fs.existsSync(optTestPath)).toBe(false);
  });
});

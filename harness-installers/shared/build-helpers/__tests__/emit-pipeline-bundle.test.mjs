import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { emitPipelineBundle, RUNTIME_ENTRIES } from '../emit-pipeline-bundle.js';

test('RUNTIME_ENTRIES is exactly [pipeline, explode-master-plan] — v5 entries retired', () => {
  assert.deepStrictEqual(RUNTIME_ENTRIES, ['pipeline', 'explode-master-plan']);
});

test('emitPipelineBundle bundles each entry to <target>/<name>.js', async () => {
  const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'emit-pipe-'));
  try {
    const src = join(tmpRoot, 'scripts');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(join(src, 'pipeline.ts'), 'export const main = () => 1;\n');
    fs.writeFileSync(join(src, 'explode-master-plan.ts'), 'export const main = () => 2;\n');
    const target = join(tmpRoot, 'out');
    await emitPipelineBundle({ source: src, target });
    assert.ok(fs.existsSync(join(target, 'pipeline.js')), 'pipeline.js emitted');
    assert.ok(fs.existsSync(join(target, 'explode-master-plan.js')), 'explode-master-plan.js emitted');
    assert.ok(!fs.existsSync(join(target, 'migrate-to-v5.js')), 'migrate-to-v5 retired');
    assert.ok(!fs.existsSync(join(target, 'fix-ghost-v5.js')), 'fix-ghost-v5 retired');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('legacy bundle.mjs is gone from harness-files scripts', () => {
  assert.ok(!fs.existsSync('harness-files/skills/rad-orchestration/scripts/bundle.mjs'),
    'in-source dev tool retired; logic centralized in emit-pipeline-bundle.js');
});

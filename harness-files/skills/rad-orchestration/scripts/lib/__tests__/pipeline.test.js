import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.resolve(__dirname, '../..');

test('pipeline bundle artifact', async (t) => {
  await t.test('pipeline.js exists in the scripts directory', () => {
    const pipelineJs = path.join(scriptsDir, 'pipeline.js');
    assert.ok(fs.existsSync(pipelineJs), 'pipeline.js exists');
  });
});

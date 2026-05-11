import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

test('docker-generator and env-generator are gone', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, 'docker-generator.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'env-generator.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'docker-generator.test.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'env-generator.test.js')));
});

test('path-utils.js exports no toDockerPath', async () => {
  const m = await import('./path-utils.js');
  assert.equal(m.toDockerPath, undefined);
});

test('ui-builder.js has no docker-compose branch', () => {
  const src = fs.readFileSync(path.join(__dirname, 'ui-builder.js'), 'utf8');
  assert.ok(!/docker[- ]compose/i.test(src));
  assert.ok(!/PROJECTS_DIR/.test(src));
  assert.ok(!/WORKSPACE_ROOT/.test(src));
});

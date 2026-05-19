import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('_template/adapter.js exports exactly name, filenames, bodyTokens with obvious placeholders', async () => {
  const mod = await import(pathToFileURL(resolve('greenfield/harness-adapters/adapters/_template/adapter.js')).href);
  assert.ok(mod.adapter, 'expected a named export `adapter`');
  const keys = Object.keys(mod.adapter).sort();
  assert.deepStrictEqual(keys, ['bodyTokens', 'filenames', 'name'], 'adapter must expose exactly name, filenames, bodyTokens');
  assert.strictEqual(mod.adapter.name, '_template', 'template name should be the literal "_template" placeholder');
  assert.ok(/<.*>/.test(mod.adapter.filenames.agent), 'template filenames.agent must contain a `<placeholder>` segment');
  assert.ok(/<.*>/.test(mod.adapter.filenames.skill), 'template filenames.skill must contain a `<placeholder>` segment');
  assert.deepStrictEqual(mod.adapter.bodyTokens, {}, 'template bodyTokens must be the empty object');
});

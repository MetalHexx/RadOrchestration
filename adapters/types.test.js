// adapters/types.test.js — Compile-time contract checks for the adapter interface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { discoverAdapters } from './discover.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const decl = fs.readFileSync(path.join(here, 'types.d.ts'), 'utf8');

test('adapter interface exports five capability-surface type names', () => {
  for (const name of [
    'FilenameRule',
    'AgentFrontmatterProjector',
    'SkillFrontmatterProjector',
    'ToolDictionary',
    'ModelAliasMap',
    'MetadataStreamEntry',
    'Adapter',
  ]) {
    assert.match(
      decl,
      new RegExp(`export\\s+(type|interface)\\s+${name}\\b`),
      `types.d.ts must export ${name}`,
    );
  }
});

test('every discovered adapter declares pluginRootSubstitution as a non-empty string', async () => {
  const adapters = await discoverAdapters(here);
  assert.ok(adapters.length > 0, 'no adapters discovered');
  for (const a of adapters) {
    assert.equal(
      typeof a.pluginRootSubstitution,
      'string',
      `adapter '${a.name}' is missing pluginRootSubstitution`,
    );
    assert.ok(
      a.pluginRootSubstitution.length > 0,
      `adapter '${a.name}' has an empty pluginRootSubstitution`,
    );
  }
});

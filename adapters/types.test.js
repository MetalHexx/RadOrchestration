// adapters/types.test.js — Compile-time contract checks for the adapter interface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

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

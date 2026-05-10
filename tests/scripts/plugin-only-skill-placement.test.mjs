// tests/scripts/plugin-only-skill-placement.test.mjs
//
// Asserts the symmetric placement invariant for plugin-only skills:
//   • Each plugin-only skill IS present in the staged Claude plugin tree.
//   • Each plugin-only skill is ABSENT from every legacy installer bundle.
//
// The skill list is read from `adapters/run.js` (PLUGIN_ONLY_SKILLS) so this
// test never goes stale on a rename. Plugin-only skills depend on the bundled
// CLI binary at ${PLUGIN_ROOT}/bin/radorch.mjs which only ships in the plugin
// tree; if they leak into a legacy bundle they fail at runtime with an empty
// substitution and a missing binary.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGIN_ONLY_SKILLS } from '../../adapters/run.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const LEGACY_HARNESSES = ['claude', 'copilot-cli', 'copilot-vscode'];

const pluginSkillsRoot = path.join(
  repoRoot, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration', 'skills',
);

test('every plugin-only skill is present in the staged plugin tree', (t) => {
  if (!fs.existsSync(pluginSkillsRoot)) {
    t.skip('staged plugin tree absent — run npm run build:plugin first');
    return;
  }
  for (const name of PLUGIN_ONLY_SKILLS) {
    const skillFile = path.join(pluginSkillsRoot, name, 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      `plugin-only skill missing from plugin tree: ${path.relative(repoRoot, skillFile)}`,
    );
  }
});

for (const harness of LEGACY_HARNESSES) {
  test(`no plugin-only skill leaks into installer/src/${harness}/skills/`, () => {
    const harnessSkillsRoot = path.join(repoRoot, 'installer', 'src', harness, 'skills');
    if (!fs.existsSync(harnessSkillsRoot)) return;
    for (const name of PLUGIN_ONLY_SKILLS) {
      const skillDir = path.join(harnessSkillsRoot, name);
      assert.ok(
        !fs.existsSync(skillDir),
        `plugin-only skill leaked into legacy bundle: ${path.relative(repoRoot, skillDir)}`,
      );
    }
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

for (const name of ['rad-ui-start', 'rad-ui-stop', 'rad-ui-status']) {
  test(`canonical skill ${name} exists with PLUGIN_ROOT placeholder pointing at in-skill CLI`, () => {
    const skillFile = path.join(repoRoot, 'skills', name, 'SKILL.md');
    assert.ok(fs.existsSync(skillFile), `missing ${skillFile}`);
    const text = fs.readFileSync(skillFile, 'utf8');
    // The CLI now ships inside the rad-orchestration skill folder, not at
    // ${PLUGIN_ROOT}/bin/. ${PLUGIN_ROOT} substitutes to the harness install
    // root (~/.claude or ~/.copilot for legacy, ${CLAUDE_PLUGIN_ROOT} for plugin).
    assert.match(
      text,
      /\$\{PLUGIN_ROOT\}\/skills\/rad-orchestration\/scripts\/radorch\.mjs/,
      `${name} missing PLUGIN_ROOT placeholder pointing at in-skill CLI`,
    );
    assert.doesNotMatch(
      text,
      /\$\{PLUGIN_ROOT\}\/bin\/radorch\.mjs/,
      `${name} still references retired \${PLUGIN_ROOT}/bin/radorch.mjs path`,
    );
    assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT/, `${name} hardcodes CLAUDE_PLUGIN_ROOT — must use ${'$'}{PLUGIN_ROOT}`);
  });
}

test('legacy marketplace ui-* skills no longer exist', () => {
  for (const legacy of ['ui-start', 'ui-stop', 'ui-status']) {
    const f = path.join(repoRoot, 'marketplace', 'plugins', 'rad-orchestration', 'skills', legacy, 'SKILL.md');
    assert.ok(!fs.existsSync(f), `legacy ${f} still present`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '..', '..', 'marketplace', 'plugins', 'rad-orchestration', 'skills');

for (const verb of ['start', 'stop', 'status']) {
  test(`ui-${verb} skill exists, has frontmatter, invokes bundled CLI`, () => {
    const f = path.join(skillsDir, `ui-${verb}`, 'SKILL.md');
    assert.ok(fs.existsSync(f), `${f} must exist`);
    const text = fs.readFileSync(f, 'utf8');
    // frontmatter present
    assert.match(text, /^---\r?\n[\s\S]*?\r?\n---\r?\n/, 'SKILL.md must start with YAML frontmatter');
    // name field is unprefixed (DD-3)
    assert.match(text, new RegExp(`name:\\s*ui-${verb}\\b`));
    // body invokes CLAUDE_PLUGIN_ROOT bundle (AD-12, DD-8)
    assert.match(text, /\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/radorch\.mjs/);
    assert.match(text, new RegExp(`\\bui\\s+${verb}\\b`));
  });
}

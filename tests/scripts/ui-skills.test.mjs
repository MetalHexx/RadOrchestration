import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '..', '..', 'skills');

for (const verb of ['start', 'stop', 'status']) {
  test(`rad-ui-${verb} skill exists, has frontmatter, invokes bundled CLI`, () => {
    const f = path.join(skillsDir, `rad-ui-${verb}`, 'SKILL.md');
    assert.ok(fs.existsSync(f), `${f} must exist`);
    const text = fs.readFileSync(f, 'utf8');
    // frontmatter present
    assert.match(text, /^---\r?\n[\s\S]*?\r?\n---\r?\n/, 'SKILL.md must start with YAML frontmatter');
    // name field with rad- prefix
    assert.match(text, new RegExp(`name:\\s*rad-ui-${verb}\\b`));
    // body invokes PLUGIN_ROOT bundle
    assert.match(text, /\$\{PLUGIN_ROOT\}\/bin\/radorch\.mjs/);
    assert.match(text, new RegExp(`\\bui\\s+${verb}\\b`));
  });
}

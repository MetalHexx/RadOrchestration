import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const md = readFileSync(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
assert.match(md, /^## Reserved Namespace: rad-\*\s*$/m, 'CLAUDE.md must carry an H2 `## Reserved Namespace: rad-*` section (FR-13)');
assert.match(md, /rad-create-skill/, 'CLAUDE.md reserved-namespace section must link to rad-create-skill (DD-7)');
console.log('CLAUDE.md reserved-namespace assertions passed');

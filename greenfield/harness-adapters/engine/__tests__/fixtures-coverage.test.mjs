// FR-24 inventory coverage. The seven FIXTURE: tests below map one-to-one to
// FR-24's nine concerns. Build-all vs --harness= filter is covered in
// build-cli.test.mjs (P04-T02); dev-artifact skip-list is covered in
// skill-translation.test.mjs (P04-T01).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, translateAgent, translateSkill } from '../index.js';

const ALPHA = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: {} };

// FR-24 fixture 1: agent with body + yml (covered end-to-end here for the explicit fixture inventory).
test('FIXTURE: agent body + per-harness yml produces a translated agent file (FR-24)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fx-agent-'));
  try {
    mkdirSync(join(root, 'agents'), { recursive: true });
    writeFileSync(join(root, 'agents/x.md'), '{{FRONTMATTER}}\n# X\n');
    writeFileSync(join(root, 'agents/x.alpha.yml'), 'name: x\ndescription: y\n');
    await translateAgent({ bodyPath: join(root, 'agents/x.md'), ymlPath: join(root, 'agents/x.alpha.yml'), adapter: ALPHA, outDir: join(root, 'out') });
    assert.ok(existsSync(join(root, 'out/alpha/agents/x.md')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// FR-24 fixture 2: skill with inline frontmatter (no per-harness yml expected).
test('FIXTURE: skill SKILL.md inline frontmatter passes through (FR-24, AD-13)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fx-skill-inline-'));
  try {
    const src = join(root, 'src/inline');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'SKILL.md'), '---\nname: inline\ndescription: d\n---\nhello\n');
    await translateSkill({ skillDir: src, adapter: ALPHA, outDir: join(root, 'out') });
    const out = readFileSync(join(root, 'out/alpha/skills/inline/SKILL.md'), 'utf8');
    assert.match(out, /^---\nname: inline/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// FR-24 fixture 3: skill with subfolders (scripts/, references/, templates/) recurse and copy.
test('FIXTURE: skill subfolders recurse with text + binary handling (FR-24)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fx-skill-subs-'));
  try {
    const src = join(root, 'src/sub');
    mkdirSync(join(src, 'scripts'), { recursive: true });
    mkdirSync(join(src, 'references'), { recursive: true });
    mkdirSync(join(src, 'templates'), { recursive: true });
    writeFileSync(join(src, 'SKILL.md'), '---\nname: sub\ndescription: d\n---\n');
    writeFileSync(join(src, 'scripts/run.js'), 'console.log("ok");');
    writeFileSync(join(src, 'references/note.md'), '# notes');
    writeFileSync(join(src, 'references/icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(src, 'templates/T.md'), '# template');
    await translateSkill({ skillDir: src, adapter: ALPHA, outDir: join(root, 'out') });
    for (const p of ['SKILL.md', 'scripts/run.js', 'references/note.md', 'references/icon.png', 'templates/T.md']) {
      assert.ok(existsSync(join(root, 'out/alpha/skills/sub', p)), `missing ${p}`);
    }
    const png = readFileSync(join(root, 'out/alpha/skills/sub/references/icon.png'));
    assert.deepStrictEqual([...png], [0x89, 0x50, 0x4e, 0x47], 'binary bytes preserved verbatim');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// FR-24 fixture 4: missing-yml error path (FR-16, FR-24).
test('FIXTURE: missing per-harness yml aborts the build with named path (FR-24)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fx-missing-yml-'));
  try {
    mkdirSync(join(root, 'files/agents'), { recursive: true });
    mkdirSync(join(root, 'adapters/alpha'), { recursive: true });
    writeFileSync(join(root, 'files/agents/orphan.md'), '{{FRONTMATTER}}\n# orphan\n');
    writeFileSync(join(root, 'adapters/alpha/adapter.js'),
      `export const adapter = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: {} };\n`);
    await assert.rejects(
      build({ filesRoot: join(root, 'files'), adaptersRoot: join(root, 'adapters'), outDir: join(root, 'out') }),
      /orphan\.alpha\.yml/, 'error names the missing yml');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// FR-24 fixture 5: bodyTokens substitution at engine layer (verbatim find/replace).
test('FIXTURE: bodyTokens applied verbatim to agent and skill text (FR-24)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fx-btoks-'));
  try {
    const adapter = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: { 'FOO': 'BAR' } };
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/a.md'), '{{FRONTMATTER}}\nFOO appears here.\n');
    writeFileSync(join(root, 'src/a.alpha.yml'), 'name: a\ndescription: d\n');
    await translateAgent({ bodyPath: join(root, 'src/a.md'), ymlPath: join(root, 'src/a.alpha.yml'), adapter, outDir: join(root, 'out') });
    const out = readFileSync(join(root, 'out/alpha/agents/a.md'), 'utf8');
    assert.ok(out.includes('BAR appears here.') && !out.includes('FOO appears here.'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// FR-24 fixture 6: {{FRONTMATTER}} substitution is exact-literal (FR-11, AD-5).
test('FIXTURE: {{FRONTMATTER}} token replaced with --- wrapped yml content (FR-24)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fx-fm-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/a.md'), '{{FRONTMATTER}}\nbody\n');
    writeFileSync(join(root, 'src/a.alpha.yml'), 'name: a\ndescription: d\n');
    await translateAgent({ bodyPath: join(root, 'src/a.md'), ymlPath: join(root, 'src/a.alpha.yml'), adapter: ALPHA, outDir: join(root, 'out') });
    const out = readFileSync(join(root, 'out/alpha/agents/a.md'), 'utf8');
    assert.match(out, /^---\nname: a\ndescription: d\n---\nbody\n$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// FR-24 fixture 7: ${SKILLS_ROOT} passthrough (FR-22, AD-8).
test('FIXTURE: ${SKILLS_ROOT} passes through unchanged (FR-24)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fx-tok-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/a.md'), '{{FRONTMATTER}}\nsee ${SKILLS_ROOT}/x/y.md\n');
    writeFileSync(join(root, 'src/a.alpha.yml'), 'name: a\ndescription: d\n');
    await translateAgent({ bodyPath: join(root, 'src/a.md'), ymlPath: join(root, 'src/a.alpha.yml'), adapter: ALPHA, outDir: join(root, 'out') });
    const out = readFileSync(join(root, 'out/alpha/agents/a.md'), 'utf8');
    assert.ok(out.includes('see ${SKILLS_ROOT}/x/y.md'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

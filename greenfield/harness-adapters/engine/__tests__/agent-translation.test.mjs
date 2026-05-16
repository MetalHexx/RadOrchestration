import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { translateAgent, clearOutputForAdapter } from '../index.js';

test('translateAgent substitutes {{FRONTMATTER}} with the yml wrapped in --- delimiters, writes under output/<adapter.name>/agents/, and leaves ${...} tokens untouched', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-xlate-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/planner.md'),
      '{{FRONTMATTER}}\n\n# Planner\n\nSee ${SKILLS_ROOT}/rad-create-plans/SKILL.md.\n');
    writeFileSync(join(root, 'src/planner.alpha.yml'),
      'name: planner\ndescription: test agent\nmodel: opus\n');
    const adapter = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: {} };
    const outDir = join(root, 'output');
    await translateAgent({
      bodyPath: join(root, 'src/planner.md'),
      ymlPath: join(root, 'src/planner.alpha.yml'),
      adapter, outDir,
    });
    const outPath = join(outDir, 'alpha/agents/planner.md');
    assert.ok(existsSync(outPath), 'output file written at output/<adapter.name>/agents/<resolved-filename> (DD-3, FR-13)');
    const content = readFileSync(outPath, 'utf8');
    assert.match(content, /^---\nname: planner\ndescription: test agent\nmodel: opus\n---\n/,
      '{{FRONTMATTER}} replaced with yml wrapped in --- delimiters (FR-11, AD-5)');
    assert.ok(!content.includes('{{FRONTMATTER}}'), 'token must not remain in output');
    assert.ok(content.includes('${SKILLS_ROOT}/rad-create-plans/SKILL.md'),
      '${...} destination tokens pass through unchanged (FR-22, AD-8)');
    assert.ok(content.includes('# Planner'), 'body prose preserved');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('translateAgent applies bodyTokens after frontmatter substitution', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-tokens-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/x.md'), '{{FRONTMATTER}}\n\nUse the FOOTOOL.\n');
    writeFileSync(join(root, 'src/x.alpha.yml'), 'name: x\ndescription: t\n');
    const adapter = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: { FOOTOOL: 'bartool' } };
    await translateAgent({
      bodyPath: join(root, 'src/x.md'),
      ymlPath: join(root, 'src/x.alpha.yml'),
      adapter, outDir: join(root, 'output'),
    });
    const content = readFileSync(join(root, 'output/alpha/agents/x.md'), 'utf8');
    assert.ok(content.includes('Use the bartool.'), 'bodyTokens applied (FR-9 wiring)');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearOutputForAdapter removes prior agents/ and skills/ subtrees, leaving the run stateless', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-clear-'));
  try {
    const outDir = join(root, 'output');
    mkdirSync(join(outDir, 'alpha/agents'), { recursive: true });
    mkdirSync(join(outDir, 'alpha/skills/leftover'), { recursive: true });
    writeFileSync(join(outDir, 'alpha/agents/stale.md'), 'stale');
    writeFileSync(join(outDir, 'alpha/skills/leftover/SKILL.md'), 'stale');
    await clearOutputForAdapter({ name: 'alpha' }, outDir);
    assert.ok(!existsSync(join(outDir, 'alpha/agents/stale.md')), 'prior agent file removed (FR-17, AD-6)');
    assert.ok(!existsSync(join(outDir, 'alpha/skills/leftover')), 'prior skill folder removed (FR-17, AD-6)');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

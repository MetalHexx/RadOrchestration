import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../index.js';

function makeFullFixture() {
  const root = mkdtempSync(join(tmpdir(), 'build-e2e-'));
  const filesRoot = join(root, 'harness-files');
  const adaptersRoot = join(root, 'harness-adapters/adapters');
  const outDir = join(root, 'harness-adapters/output');
  mkdirSync(join(filesRoot, 'agents'), { recursive: true });
  mkdirSync(join(filesRoot, 'skills/s1'), { recursive: true });
  writeFileSync(join(filesRoot, 'agents/p.md'), '{{FRONTMATTER}}\n# P\n');
  writeFileSync(join(filesRoot, 'agents/p.alpha.yml'), 'name: p\ndescription: alpha p\n');
  writeFileSync(join(filesRoot, 'agents/p.beta.yml'), 'name: p\ndescription: beta p\n');
  writeFileSync(join(filesRoot, 'skills/s1/SKILL.md'), '---\nname: s1\ndescription: d\n---\nbody\n');
  mkdirSync(join(adaptersRoot, 'alpha'), { recursive: true });
  writeFileSync(join(adaptersRoot, 'alpha/adapter.js'),
    `export const adapter = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: {} };\n`);
  mkdirSync(join(adaptersRoot, 'beta'), { recursive: true });
  writeFileSync(join(adaptersRoot, 'beta/adapter.js'),
    `export const adapter = { name: 'beta', filenames: { agent: '{name}.agent.md', skill: 'SKILL.md' }, bodyTokens: {} };\n`);
  return { root, filesRoot, adaptersRoot, outDir };
}

test('build() default translates every discovered adapter', async () => {
  const fx = makeFullFixture();
  try {
    await build({ filesRoot: fx.filesRoot, adaptersRoot: fx.adaptersRoot, outDir: fx.outDir });
    assert.ok(existsSync(join(fx.outDir, 'alpha/agents/p.md')), 'alpha agent written (FR-14, AD-12)');
    assert.ok(existsSync(join(fx.outDir, 'beta/agents/p.agent.md')), 'beta agent uses its filename template (FR-14)');
    assert.ok(existsSync(join(fx.outDir, 'alpha/skills/s1/SKILL.md')), 'alpha skill written (FR-14)');
    assert.ok(existsSync(join(fx.outDir, 'beta/skills/s1/SKILL.md')), 'beta skill written (FR-14)');
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});

test('build({ harness: "alpha" }) scopes to that adapter only', async () => {
  const fx = makeFullFixture();
  try {
    await build({ filesRoot: fx.filesRoot, adaptersRoot: fx.adaptersRoot, outDir: fx.outDir, harness: 'alpha' });
    assert.ok(existsSync(join(fx.outDir, 'alpha/agents/p.md')), 'alpha translated (DD-5)');
    assert.ok(!existsSync(join(fx.outDir, 'beta')), 'beta NOT translated under filter (DD-5)');
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});

test('build({ harness: "nope" }) errors with a clear message', async () => {
  const fx = makeFullFixture();
  try {
    await assert.rejects(
      build({ filesRoot: fx.filesRoot, adaptersRoot: fx.adaptersRoot, outDir: fx.outDir, harness: 'nope' }),
      /nope/, 'error names the unknown harness (FR-14)');
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});

test('build() fails fast when an agent body has no matching per-harness yml', async () => {
  const fx = makeFullFixture();
  try {
    // Remove beta yml so the beta adapter sees a missing yml for agent `p`.
    rmSync(join(fx.filesRoot, 'agents/p.beta.yml'));
    await assert.rejects(
      build({ filesRoot: fx.filesRoot, adaptersRoot: fx.adaptersRoot, outDir: fx.outDir }),
      /p\.beta\.yml/, 'error names the missing per-harness yml path (FR-16, DD-7)');
  } finally { rmSync(fx.root, { recursive: true, force: true }); }
});

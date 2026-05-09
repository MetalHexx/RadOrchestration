import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const buildPluginUrl = pathToFileURL(path.join(repoRoot, 'scripts', 'build-plugin.js')).href;

test('build-plugin meta-script: orchestration order constant exposes the documented sequence', async () => {
  const mod = await import(buildPluginUrl);
  assert.deepEqual(mod.PIPELINE_STEPS, [
    'cli-build',
    'cli-bundle',
    'pipeline-bundle',
    'ui-standalone',
    'adapters-plugin',
    'copy-bundles-into-claude-plugin',
    'sync-plugin-version',
    'validate-plugin-tree',
  ]);
});

test('validatePluginTree: detects missing required artifacts', async () => {
  const { validatePluginTree } = await import(buildPluginUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-val-'));
  // empty tree → many violations
  const empty = validatePluginTree(tmp);
  assert.equal(empty.ok, false);
  assert.ok(empty.missing.includes('.claude-plugin/plugin.json'));
  assert.ok(empty.missing.includes('bin/radorch.mjs'));
  assert.ok(empty.missing.includes('dist/pipeline.js'));
  assert.ok(empty.missing.includes('ui/server.js'));
  assert.ok(empty.missing.includes('hooks/hooks.json'));
  assert.ok(empty.missing.some((m) => m.startsWith('skills/rad-ui-start/')));
});

test('validatePluginTree: passes on a complete fixture', async () => {
  const { validatePluginTree } = await import(buildPluginUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-val-ok-'));
  // populate every required artifact
  const writeF = (rel, body = 'x') => {
    const f = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  };
  writeF('.claude-plugin/plugin.json', JSON.stringify({ name: 'rad-orchestration', version: '1.1.0' }));
  writeF('bin/radorch.mjs');
  writeF('dist/pipeline.js');
  writeF('ui/server.js');
  writeF('hooks/hooks.json', '{}');
  writeF('hooks/session-start.sh');
  writeF('hooks/session-start.ps1');
  // Representative canonical skills (full enumeration)
  for (const s of ['rad-orchestration', 'rad-plan', 'rad-ui-start']) writeF(`skills/${s}/SKILL.md`);

  // All canonical agents must be present in agents/. Use the actual repo root
  // so the fixture stays in sync with the canonical agents/ directory.
  const agentsDir = path.join(repoRoot, 'agents');
  const agentNames = fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md') && !fs.statSync(path.join(agentsDir, f)).isDirectory())
    .map((f) => f.replace(/\.md$/, ''));
  for (const name of agentNames) writeF(`agents/${name}.md`);

  // orchestrator.md body must contain rad-orchestration:<name> for every
  // non-orchestrator canonical agent (namespaced dispatch token assertion).
  const nonOrchNames = agentNames.filter((n) => n !== 'orchestrator');
  const orchTokens = nonOrchNames.map((n) => `rad-orchestration:${n}`).join('\n');
  writeF('agents/orchestrator.md', orchTokens);

  const ok = validatePluginTree(tmp, repoRoot);
  assert.equal(ok.ok, true, JSON.stringify(ok));
});

test('syncPluginVersion: rewrites plugin.json version from cli/package.json', async () => {
  const { syncPluginVersion } = await import(buildPluginUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-sync-'));
  const cpDir = path.join(tmp, '.claude-plugin');
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(path.join(cpDir, 'plugin.json'), JSON.stringify({ name: 'rad-orchestration', version: '0.0.0' }));
  syncPluginVersion(tmp, '2.5.7');
  const v = JSON.parse(fs.readFileSync(path.join(cpDir, 'plugin.json'), 'utf8')).version;
  assert.equal(v, '2.5.7');
});

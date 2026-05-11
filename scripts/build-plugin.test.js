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
    'copy-manifest-catalog',
    'copy-bundles-into-claude-plugin',
    'copy-plugin-package-json',
    'sync-plugin-version',
    'validate-plugin-tree',
    'npm-pack-staging',
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
  assert.ok(empty.missing.includes('skills/rad-orchestration/scripts/pipeline.js'));
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
  writeF('skills/rad-orchestration/scripts/pipeline.js');
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

test('validatePluginTree requires skills/rad-orchestration/scripts/pipeline.js', async () => {
  const { validatePluginTree } = await import(buildPluginUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-pl-pipeline-'));
  // Build a fixture plugin tree that has every required artifact EXCEPT the
  // new pipeline.js path — simulates a stale build that still emits dist/pipeline.js.
  const writeF = (rel, body = 'x') => {
    const f = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  };
  writeF('.claude-plugin/plugin.json', JSON.stringify({ name: 'rad-orchestration', version: '1.1.0' }));
  writeF('bin/radorch.mjs');
  // Intentionally write the OLD path instead of the new one.
  writeF('dist/pipeline.js');
  writeF('ui/server.js');
  writeF('hooks/hooks.json', '{}');
  writeF('hooks/session-start.sh');
  writeF('hooks/session-start.ps1');
  for (const s of ['rad-orchestration', 'rad-plan', 'rad-ui-start']) writeF(`skills/${s}/SKILL.md`);
  const agentsDir = path.join(repoRoot, 'agents');
  const agentNames = fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md') && !fs.statSync(path.join(agentsDir, f)).isDirectory())
    .map((f) => f.replace(/\.md$/, ''));
  for (const name of agentNames) writeF(`agents/${name}.md`);
  const nonOrchNames = agentNames.filter((n) => n !== 'orchestrator');
  const orchTokens = nonOrchNames.map((n) => `rad-orchestration:${n}`).join('\n');
  writeF('agents/orchestrator.md', orchTokens);
  // Also supply the manifest so the only missing thing is the new pipeline path.
  writeF('manifests/v1.1.0.json', '{}');

  const r = validatePluginTree(tmp, repoRoot, '1.1.0');
  assert.equal(r.ok, false, 'should fail because skills/rad-orchestration/scripts/pipeline.js is missing');
  assert.ok(
    r.missing.includes('skills/rad-orchestration/scripts/pipeline.js'),
    `expected skills/rad-orchestration/scripts/pipeline.js in missing, got: ${JSON.stringify(r.missing)}`,
  );
});

test('validatePluginTree requires manifests/v<version>.json', async () => {
  const { validatePluginTree } = await import(buildPluginUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-pl-manifest-'));
  // Build a fixture tree with the new pipeline path but no manifests/ entry.
  const writeF = (rel, body = 'x') => {
    const f = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  };
  writeF('.claude-plugin/plugin.json', JSON.stringify({ name: 'rad-orchestration', version: '1.1.0' }));
  writeF('bin/radorch.mjs');
  // Write the new pipeline path.
  writeF('skills/rad-orchestration/scripts/pipeline.js');
  writeF('ui/server.js');
  writeF('hooks/hooks.json', '{}');
  writeF('hooks/session-start.sh');
  writeF('hooks/session-start.ps1');
  for (const s of ['rad-orchestration', 'rad-plan', 'rad-ui-start']) writeF(`skills/${s}/SKILL.md`);
  const agentsDir = path.join(repoRoot, 'agents');
  const agentNames = fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md') && !fs.statSync(path.join(agentsDir, f)).isDirectory())
    .map((f) => f.replace(/\.md$/, ''));
  for (const name of agentNames) writeF(`agents/${name}.md`);
  const nonOrchNames = agentNames.filter((n) => n !== 'orchestrator');
  const orchTokens = nonOrchNames.map((n) => `rad-orchestration:${n}`).join('\n');
  writeF('agents/orchestrator.md', orchTokens);
  // Intentionally do NOT write manifests/v1.1.0.json.

  const r = validatePluginTree(tmp, repoRoot, '1.1.0');
  assert.equal(r.ok, false, 'should fail because manifests/v1.1.0.json is missing');
  assert.ok(
    r.missing.includes('manifests/v1.1.0.json'),
    `expected manifests/v1.1.0.json in missing, got: ${JSON.stringify(r.missing)}`,
  );
});

test('happy-path: validatePluginTree passes when pipeline.js and manifest both ship', async () => {
  const { validatePluginTree } = await import(buildPluginUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-pl-happy-'));
  const writeF = (rel, body = 'x') => {
    const f = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  };
  writeF('.claude-plugin/plugin.json', JSON.stringify({ name: 'rad-orchestration', version: '1.1.0' }));
  writeF('bin/radorch.mjs');
  // New pipeline path (not dist/).
  writeF('skills/rad-orchestration/scripts/pipeline.js');
  writeF('ui/server.js');
  writeF('hooks/hooks.json', '{}');
  writeF('hooks/session-start.sh');
  writeF('hooks/session-start.ps1');
  for (const s of ['rad-orchestration', 'rad-plan', 'rad-ui-start']) writeF(`skills/${s}/SKILL.md`);
  const agentsDir = path.join(repoRoot, 'agents');
  const agentNames = fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md') && !fs.statSync(path.join(agentsDir, f)).isDirectory())
    .map((f) => f.replace(/\.md$/, ''));
  for (const name of agentNames) writeF(`agents/${name}.md`);
  const nonOrchNames = agentNames.filter((n) => n !== 'orchestrator');
  const orchTokens = nonOrchNames.map((n) => `rad-orchestration:${n}`).join('\n');
  writeF('agents/orchestrator.md', orchTokens);
  // Both new requirements present.
  writeF('manifests/v1.1.0.json', '{}');

  const ok = validatePluginTree(tmp, repoRoot, '1.1.0');
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

test('syncPluginVersion only mutates plugin.json', async () => {
  const { syncPluginVersion } = await import(buildPluginUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-spv-'));
  fs.mkdirSync(path.join(tmp, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'x', version: '0.0.0' }, null, 2));
  // Pre-create a hooks dir without sh/ps1 to assert no branch writes to them.
  fs.mkdirSync(path.join(tmp, 'hooks'));
  fs.writeFileSync(path.join(tmp, 'hooks', 'hooks.json'),
    JSON.stringify({ hooks: { SessionStart: [{ command: 'node x' }] } }));
  syncPluginVersion(tmp, '1.2.3');
  const pj = JSON.parse(fs.readFileSync(path.join(tmp, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(pj.version, '1.2.3');
  // Ensure no .sh/.ps1 was created as a side effect.
  assert.ok(!fs.existsSync(path.join(tmp, 'hooks', 'session-start.sh')));
  assert.ok(!fs.existsSync(path.join(tmp, 'hooks', 'session-start.ps1')));
});

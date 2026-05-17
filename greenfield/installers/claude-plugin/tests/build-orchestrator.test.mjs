import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { runBuild } from '../build-scripts/build.js';

function makeUpstream() {
  const root = fs.mkdtempSync(join(os.tmpdir(), 'build-'));
  // Adapter-engine output (claude only)
  fs.mkdirSync(join(root, 'harness-adapters/output/claude/agents'), { recursive: true });
  fs.writeFileSync(join(root, 'harness-adapters/output/claude/agents/orchestrator.md'),
    '---\nname: orchestrator\ndescription: test\n---\nSpawn **coder** agent. See ${SKILLS_ROOT}/rad-orchestration/SKILL.md.\n');
  fs.writeFileSync(join(root, 'harness-adapters/output/claude/agents/coder.md'),
    '---\nname: coder\ndescription: test\n---\n# Coder\n');
  fs.mkdirSync(join(root, 'harness-adapters/output/claude/skills/rad-orchestration'), { recursive: true });
  fs.writeFileSync(join(root, 'harness-adapters/output/claude/skills/rad-orchestration/SKILL.md'),
    '---\nname: rad-orchestration\ndescription: t\n---\nReference: ${SKILLS_ROOT}/rad-orchestration/scripts/pipeline.js\n');
  // runtime-config/
  fs.mkdirSync(join(root, 'runtime-config/templates'), { recursive: true });
  fs.writeFileSync(join(root, 'runtime-config/orchestration.yml'), 'pipeline: {}\n');
  fs.writeFileSync(join(root, 'runtime-config/templates/medium.yml'), 'name: medium\n');
  // cli/ source synthetic
  fs.mkdirSync(join(root, 'cli/src/bin'), { recursive: true });
  fs.writeFileSync(join(root, 'cli/src/bin/radorch.ts'), 'console.log("radorch");\n');
  fs.writeFileSync(join(root, 'cli/package.json'), JSON.stringify({ name: 'cli', type: 'module' }));
  // canonical agents (harness-files/agents/) — required by validatePluginTree gate 2 & 3.
  fs.mkdirSync(join(root, 'harness-files/agents'), { recursive: true });
  fs.writeFileSync(join(root, 'harness-files/agents/orchestrator.md'), 'Spawn **coder** agent.\n');
  fs.writeFileSync(join(root, 'harness-files/agents/coder.md'), '# Coder\n');
  // pipeline source TS
  fs.mkdirSync(join(root, 'harness-files/skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(root, 'harness-files/skills/rad-orchestration/scripts/pipeline.ts'), 'export const main = () => 1;\n');
  fs.writeFileSync(join(root, 'harness-files/skills/rad-orchestration/scripts/explode-master-plan.ts'), 'export const main = () => 2;\n');
  // ui/ synthetic
  fs.mkdirSync(join(root, 'ui/.next/standalone'), { recursive: true });
  fs.mkdirSync(join(root, 'ui/.next/static'), { recursive: true });
  fs.writeFileSync(join(root, 'ui/.next/standalone/server.js'), '// ui\n');
  // installer source root: hooks/, lib/install/, .claude-plugin/, manifests/
  fs.mkdirSync(join(root, 'installers/claude-plugin/hooks'), { recursive: true });
  fs.writeFileSync(join(root, 'installers/claude-plugin/hooks/bootstrap.mjs'), 'console.error("boot");\n');
  fs.writeFileSync(join(root, 'installers/claude-plugin/hooks/drift-check.mjs'), 'console.log("drift");\n');
  fs.writeFileSync(join(root, 'installers/claude-plugin/hooks/hooks.json'), '{}\n');
  fs.writeFileSync(join(root, 'installers/claude-plugin/hooks/AGENTS.md'), '# Hooks AGENTS\n');
  fs.mkdirSync(join(root, 'installers/claude-plugin/.claude-plugin'), { recursive: true });
  fs.writeFileSync(join(root, 'installers/claude-plugin/.claude-plugin/plugin.json'),
    JSON.stringify({ name: 'rad-orchestration', version: '1.2.3' }, null, 2));
  fs.mkdirSync(join(root, 'installers/claude-plugin/manifests'), { recursive: true });
  fs.writeFileSync(join(root, 'installers/claude-plugin/manifests/v1.2.3.json'),
    JSON.stringify({ version: '1.2.3', files: [
      { destinationPath: '${RAD_HOME}/orchestration.yml', sourcePath: 'orchestration.yml', ownership: 'user-config' },
    ]}));
  fs.writeFileSync(join(root, 'installers/claude-plugin/package.json'),
    JSON.stringify({ name: '@rad-orchestration/claude-plugin-source', private: true, type: 'module' }));
  return root;
}

test('runBuild emits the full plugin payload to output/ in correct shape', async () => {
  const root = makeUpstream();
  try {
    await runBuild({ rootDir: root, skipAdapterEngine: true, skipUiRunner: true, greenfieldRel: '.' });
    const out = join(root, 'installers/claude-plugin/output');
    assert.ok(fs.existsSync(join(out, 'agents/orchestrator.md')), 'agents copied');
    assert.ok(fs.existsSync(join(out, 'skills/rad-orchestration/SKILL.md')), 'skills copied');
    assert.ok(fs.existsSync(join(out, 'orchestration.yml')), 'orchestration.yml staged at top level');
    assert.ok(fs.existsSync(join(out, 'templates/medium.yml')), 'templates staged');
    assert.ok(fs.existsSync(join(out, 'skills/rad-orchestration/scripts/pipeline.js')), 'pipeline bundle');
    assert.ok(fs.existsSync(join(out, 'skills/rad-orchestration/scripts/explode-master-plan.js')), 'explode-master-plan bundle');
    assert.ok(fs.existsSync(join(out, 'skills/rad-orchestration/scripts/radorch.mjs')), 'CLI bundle');
    assert.ok(fs.existsSync(join(out, 'hooks/bootstrap.mjs')), 'hook bundle');
    assert.ok(fs.existsSync(join(out, 'hooks/drift-check.mjs')), 'drift-check verbatim');
    assert.ok(fs.existsSync(join(out, 'hooks/hooks.json')), 'hooks.json verbatim');
    assert.ok(fs.existsSync(join(out, '.claude-plugin/plugin.json')), 'plugin.json');
    assert.ok(fs.existsSync(join(out, 'package.json')), 'package.json synthesized');
    assert.ok(fs.existsSync(join(out, 'manifests/v1.2.3.json')), 'manifest catalog');
    // bin/ filtered out.
    assert.ok(!fs.existsSync(join(out, 'bin')), 'no bin/');
    // Source-only files not present.
    assert.ok(!fs.existsSync(join(out, 'build-scripts')), 'no build-scripts/');
    assert.ok(!fs.existsSync(join(out, 'lib/install')), 'no source lib/install/');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('destination tokens are substituted across body files', async () => {
  const root = makeUpstream();
  try {
    await runBuild({ rootDir: root, skipAdapterEngine: true, skipUiRunner: true, greenfieldRel: '.' });
    const out = join(root, 'installers/claude-plugin/output');
    const orch = fs.readFileSync(join(out, 'agents/orchestrator.md'), 'utf8');
    assert.ok(orch.includes('${CLAUDE_PLUGIN_ROOT}/skills/rad-orchestration/SKILL.md'),
      '${SKILLS_ROOT} replaced with ${CLAUDE_PLUGIN_ROOT}/skills');
    assert.ok(orch.includes('**rad-orchestration:coder**'),
      'agent-namespacing applied');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('synthesized output/package.json version equals plugin.json version, not wrapper version', async () => {
  const root = makeUpstream();
  try {
    await runBuild({ rootDir: root, skipAdapterEngine: true, skipUiRunner: true, greenfieldRel: '.' });
    const synthesized = JSON.parse(fs.readFileSync(
      join(root, 'installers/claude-plugin/output/package.json'), 'utf8'));
    assert.strictEqual(synthesized.version, '1.2.3', 'version from plugin.json');
    assert.strictEqual(synthesized.name, '@rad-orchestration/claude-plugin');
    assert.deepStrictEqual(synthesized.files.sort(), [
      '.claude-plugin/', 'agents/', 'hooks/', 'lib/', 'manifests/',
      'orchestration.yml', 'skills/', 'templates/', 'ui/',
    ]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('build aborts fail-fast on step error', async () => {
  const root = makeUpstream();
  try {
    fs.rmSync(join(root, 'runtime-config/orchestration.yml'));
    await assert.rejects(runBuild({ rootDir: root, skipAdapterEngine: true, skipUiRunner: true, greenfieldRel: '.' }),
      /orchestration\.yml/, 'error names the failing step');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

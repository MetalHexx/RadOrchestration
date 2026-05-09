// adapters/run-plugin-selective-wipe.test.js — proves that runAdapterPlugin
// preserves bundle artifacts (bin/, dist/, ui/) placed by sibling meta-script
// steps while still wiping its own directories (skills/, hooks/, .claude-plugin/).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdapterPlugin } from './run-plugin.js';

test('selective wipe: bundle subdirs are preserved, owned subdirs are refreshed', async () => {
  // 1. Create temp outputRoot
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-selwipe-out-'));

  // 2. Pre-populate bundle artifacts that sibling steps would place
  const pluginRoot = path.join(
    outputRoot, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration',
  );
  const bundleFiles = [
    path.join(pluginRoot, 'bin', 'radorch.mjs'),
    path.join(pluginRoot, 'dist', 'pipeline.js'),
    path.join(pluginRoot, 'ui', 'server.js'),
  ];
  for (const f of bundleFiles) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, '// pre-existing bundle');
  }

  // 3. Pre-populate a stale skill that should be removed after the run
  const staleSkill = path.join(pluginRoot, 'skills', 'old-skill', 'SKILL.md');
  fs.mkdirSync(path.dirname(staleSkill), { recursive: true });
  fs.writeFileSync(staleSkill, '---\nname: old-skill\ndescription: stale\n---\nbody\n');

  // 4. Build a minimal canonicalRoot fixture
  const canonicalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-selwipe-can-'));
  // .claude-plugin/plugin.json
  const pluginCpDir = path.join(
    canonicalRoot, 'marketplace', 'plugins', 'rad-orchestration', '.claude-plugin',
  );
  fs.mkdirSync(pluginCpDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginCpDir, 'plugin.json'),
    JSON.stringify({ name: 'rad-orchestration', version: '0.0.0' }),
  );
  // skills/sample-skill/SKILL.md
  const sampleSkillDir = path.join(
    canonicalRoot, 'marketplace', 'plugins', 'rad-orchestration', 'skills', 'sample-skill',
  );
  fs.mkdirSync(sampleSkillDir, { recursive: true });
  fs.writeFileSync(
    path.join(sampleSkillDir, 'SKILL.md'),
    '---\nname: sample-skill\ndescription: fresh\n---\nbody\n',
  );
  // hooks/hooks.json lives at canonicalRoot/hooks/ (AD-10: canonical hooks/ is the sole source).
  const hooksDir = path.join(canonicalRoot, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, 'hooks.json'), JSON.stringify({ hooks: {} }));

  // 5. Minimal adapter object — name: 'claude', identity skillFrontmatter
  const adapter = {
    name: 'claude',
    skillFrontmatter(fm) { return { ...fm }; },
  };

  // 6. Call runAdapterPlugin
  await runAdapterPlugin(adapter, { canonicalRoot, outputRoot, version: '0.0.1' });

  // 7. Assert the three pre-existing bundle files STILL exist
  assert.ok(
    fs.existsSync(bundleFiles[0]),
    `bin/radorch.mjs must be preserved but is missing`,
  );
  assert.ok(
    fs.existsSync(bundleFiles[1]),
    `dist/pipeline.js must be preserved but is missing`,
  );
  assert.ok(
    fs.existsSync(bundleFiles[2]),
    `ui/server.js must be preserved but is missing`,
  );

  // 8. Stale skill was wiped; new sample-skill was emitted
  assert.ok(
    !fs.existsSync(path.join(pluginRoot, 'skills', 'old-skill')),
    `stale skills/old-skill/ must be wiped`,
  );
  assert.ok(
    fs.existsSync(path.join(pluginRoot, 'skills', 'sample-skill', 'SKILL.md')),
    `skills/sample-skill/SKILL.md must be emitted`,
  );

  // 9. hooks and .claude-plugin were emitted
  assert.ok(
    fs.existsSync(path.join(pluginRoot, 'hooks', 'hooks.json')),
    `hooks/hooks.json must be emitted`,
  );
  assert.ok(
    fs.existsSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json')),
    `.claude-plugin/plugin.json must be emitted`,
  );
});

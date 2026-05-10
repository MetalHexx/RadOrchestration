// tests/scripts/bundle-completeness.test.mjs
//
// Asserts that every per-harness installer bundle contains exactly the set of
// agents and skills that should ship — no silent additions, no silent drops.
// Replaces the "what files are present?" coverage previously provided by the
// pinned-SHA byte-identity sweep, without pinning any hashes.
//
// For each legacy harness bundle:
//   • Every canonical agents/*.md is present (filename projected via the
//     adapter's own filenameRule, so renames stay in sync automatically).
//   • Every canonical skills/<name>/ is present as a directory, except those
//     gated out by PLUGIN_ONLY_SKILLS.
//   • No agent or skill folder appears in the bundle without a corresponding
//     canonical source.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLUGIN_ONLY_SKILLS } from '../../adapters/run.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const LEGACY_HARNESSES = ['claude', 'copilot-cli', 'copilot-vscode'];

function listCanonicalAgents() {
  const agentsDir = path.join(repoRoot, 'agents');
  return fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

function listCanonicalSkills() {
  const skillsDir = path.join(repoRoot, 'skills');
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

async function loadAdapter(harness) {
  const adapterPath = path.join(repoRoot, 'adapters', harness, 'adapter.js');
  const mod = await import(pathToFileURL(adapterPath).href);
  return mod.adapter;
}

for (const harness of LEGACY_HARNESSES) {
  test(`installer/src/${harness}/agents/ contains every canonical agent and nothing else`, async () => {
    const adapter = await loadAdapter(harness);
    const bundleAgentsDir = path.join(repoRoot, 'installer', 'src', harness, 'agents');
    const canonicalNames = listCanonicalAgents();
    const expectedFilenames = new Set(
      canonicalNames.map((name) => adapter.filenameRule({ kind: 'agent', canonicalName: name })),
    );
    assert.ok(
      fs.existsSync(bundleAgentsDir),
      `bundle agents directory missing: ${path.relative(repoRoot, bundleAgentsDir)}`,
    );
    const observed = new Set(fs.readdirSync(bundleAgentsDir));
    for (const expected of expectedFilenames) {
      assert.ok(
        observed.has(expected),
        `canonical agent missing from ${harness} bundle: ${expected}`,
      );
    }
    for (const seen of observed) {
      assert.ok(
        expectedFilenames.has(seen),
        `unexpected file in ${harness} bundle agents/: ${seen}`,
      );
    }
  });

  test(`installer/src/${harness}/skills/ contains every non-plugin-only canonical skill and nothing else`, () => {
    const bundleSkillsDir = path.join(repoRoot, 'installer', 'src', harness, 'skills');
    const expected = new Set(listCanonicalSkills().filter((name) => !PLUGIN_ONLY_SKILLS.has(name)));
    assert.ok(
      fs.existsSync(bundleSkillsDir),
      `bundle skills directory missing: ${path.relative(repoRoot, bundleSkillsDir)}`,
    );
    const observed = new Set(
      fs.readdirSync(bundleSkillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name),
    );
    for (const name of expected) {
      assert.ok(observed.has(name), `canonical skill missing from ${harness} bundle: ${name}`);
    }
    for (const name of observed) {
      assert.ok(
        expected.has(name),
        `unexpected skill folder in ${harness} bundle: ${name} (canonical exists? ${listCanonicalSkills().includes(name)}; plugin-only? ${PLUGIN_ONLY_SKILLS.has(name)})`,
      );
    }
  });
}

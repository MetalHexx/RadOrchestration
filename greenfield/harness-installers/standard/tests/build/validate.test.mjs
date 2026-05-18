import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validatePackageTree } from '../../build-scripts/validate.js';

const HARNESSES = ['claude', 'copilot-vscode', 'copilot-cli'];
const VERSION = '1.0.0-alpha.9';

/** Build a minimal synthetic dist tree satisfying all four gates. */
function makeValidDist(root, canonicalAgentsDir, agents = ['orchestrator', 'coder']) {
  for (const h of HARNESSES) {
    const hOut = path.join(root, h);
    // Required per-harness artifacts (gate 1)
    fs.mkdirSync(path.join(hOut, 'skills/rad-orchestration/scripts'), { recursive: true });
    fs.mkdirSync(path.join(hOut, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(hOut, 'orchestration.yml'), 'pipeline: {}\n');
    for (const tier of ['extra-high', 'high', 'medium', 'low']) {
      fs.writeFileSync(path.join(hOut, `templates/${tier}.yml`), `name: ${tier}\n`);
    }
    fs.writeFileSync(path.join(hOut, 'skills/rad-orchestration/scripts/radorch.mjs'), '// radorch\n');
    fs.writeFileSync(path.join(hOut, 'skills/rad-orchestration/scripts/pipeline.js'), '// pipeline\n');
    fs.writeFileSync(path.join(hOut, 'skills/rad-orchestration/scripts/explode-master-plan.js'), '// explode\n');
    // Canonical agents (gate 2)
    fs.mkdirSync(path.join(hOut, 'agents'), { recursive: true });
    for (const name of agents) {
      fs.writeFileSync(path.join(hOut, `agents/${name}.md`), `# ${name}\n`);
    }
    // Per-harness manifest (gate 3)
    fs.mkdirSync(path.join(hOut, 'manifests'), { recursive: true });
    fs.writeFileSync(path.join(hOut, `manifests/v${VERSION}.json`), '{"files":[]}\n');
  }
}

/** Build a synthetic canonical agents dir with the given agent basenames. */
function makeCanonicalAgentsDir(root, agents = ['orchestrator', 'coder']) {
  const dir = path.join(root, 'canonical-agents');
  fs.mkdirSync(dir, { recursive: true });
  for (const name of agents) {
    fs.writeFileSync(path.join(dir, `${name}.md`), `# ${name}\n`);
  }
  return dir;
}

test('gate 1: missing required artifact throws (radorch.mjs)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-gate1-'));
  try {
    const outputDir = path.join(root, 'dist');
    const canonicalAgentsDir = makeCanonicalAgentsDir(root, ['orchestrator', 'coder']);
    makeValidDist(outputDir, canonicalAgentsDir, ['orchestrator', 'coder']);
    // Remove radorch.mjs from the claude harness to trigger gate 1
    fs.rmSync(path.join(outputDir, 'claude/skills/rad-orchestration/scripts/radorch.mjs'));
    assert.throws(
      () => validatePackageTree({ outputDir, canonicalAgentsDir, harnesses: HARNESSES, version: VERSION }),
      (err) => {
        assert.ok(err.message.includes('radorch.mjs'), `Expected message to name radorch.mjs, got: ${err.message}`);
        assert.ok(err.message.includes('gate 1'), `Expected message to include 'gate 1', got: ${err.message}`);
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gate 2: missing canonical agent in output throws (coder.md)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-gate2-'));
  try {
    const outputDir = path.join(root, 'dist');
    const canonicalAgentsDir = makeCanonicalAgentsDir(root, ['orchestrator', 'coder']);
    makeValidDist(outputDir, canonicalAgentsDir, ['orchestrator', 'coder']);
    // Remove coder.md from the claude harness agents directory
    fs.rmSync(path.join(outputDir, 'claude/agents/coder.md'));
    assert.throws(
      () => validatePackageTree({ outputDir, canonicalAgentsDir, harnesses: HARNESSES, version: VERSION }),
      (err) => {
        assert.ok(err.message.includes('coder.md'), `Expected message to name coder.md, got: ${err.message}`);
        assert.ok(err.message.includes('gate 2'), `Expected message to include 'gate 2', got: ${err.message}`);
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gate 3: missing per-harness manifest throws', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-gate3-'));
  try {
    const outputDir = path.join(root, 'dist');
    const canonicalAgentsDir = makeCanonicalAgentsDir(root, ['orchestrator', 'coder']);
    makeValidDist(outputDir, canonicalAgentsDir, ['orchestrator', 'coder']);
    // Remove the manifest for claude harness
    fs.rmSync(path.join(outputDir, `claude/manifests/v${VERSION}.json`));
    assert.throws(
      () => validatePackageTree({ outputDir, canonicalAgentsDir, harnesses: HARNESSES, version: VERSION }),
      (err) => {
        assert.ok(
          err.message.includes(`v${VERSION}.json`),
          `Expected message to name v${VERSION}.json, got: ${err.message}`,
        );
        assert.ok(err.message.includes('gate 3'), `Expected message to include 'gate 3', got: ${err.message}`);
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gate 4: tarball size exceeds budget throws', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-gate4-'));
  try {
    const outputDir = path.join(root, 'dist');
    const canonicalAgentsDir = makeCanonicalAgentsDir(root, ['orchestrator', 'coder']);
    makeValidDist(outputDir, canonicalAgentsDir, ['orchestrator', 'coder']);
    const bigSizer = () => ({ unpackedSize: 60 * 1024 * 1024 });
    assert.throws(
      () => validatePackageTree({
        outputDir,
        canonicalAgentsDir,
        harnesses: HARNESSES,
        version: VERSION,
        sizer: bigSizer,
      }),
      (err) => {
        assert.ok(
          err.message.includes('exceeds size budget'),
          `Expected message to include 'exceeds size budget', got: ${err.message}`,
        );
        assert.ok(err.message.includes('gate 4'), `Expected message to include 'gate 4', got: ${err.message}`);
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('happy path: valid synthetic dist passes all four gates without throwing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-happy-'));
  try {
    const outputDir = path.join(root, 'dist');
    const canonicalAgentsDir = makeCanonicalAgentsDir(root, ['orchestrator', 'coder']);
    makeValidDist(outputDir, canonicalAgentsDir, ['orchestrator', 'coder']);
    // Use a sizer that returns an acceptable size
    const okSizer = () => ({ unpackedSize: 10 * 1024 * 1024 });
    assert.doesNotThrow(
      () => validatePackageTree({
        outputDir,
        canonicalAgentsDir,
        harnesses: HARNESSES,
        version: VERSION,
        sizer: okSizer,
      }),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

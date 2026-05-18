// greenfield/harness-installers/standard/tests/index.test.mjs —
// End-to-end surface-order tests for index.js (DD-2). Spawns the real entry
// script against a synthetic fixture so no real ~/.claude or ~/.radorch is
// touched. Three cases:
//   1. --yes --harness claude  → banner → ::: Installation Complete → ::: What's Next (exit 0)
//   2. uninstall               → pointer message, exit 0
//   3. --yes --harness bogus   → exit != 0, stderr names allowed values

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to index.js in the package root (three dirs up from tests/).
const INDEX_JS = path.resolve(__dirname, '..', 'index.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Build a synthetic packageRoot containing dist/claude/ with just enough
 * structure to satisfy installHarness + hydrateUserData.
 *
 * packageRoot/
 *   package.json          (version: 1.0.0)
 *   dist/
 *     claude/
 *       package.json      (version: 1.0.0)
 *       manifests/
 *         v1.0.0.json     (file list: agents/orchestrator.md + radorch.mjs)
 *       agents/
 *         orchestrator.md
 *       skills/rad-orchestration/scripts/
 *         radorch.mjs
 *       orchestration.yml
 *       templates/
 *         extra-high.yml  high.yml  medium.yml  low.yml
 *     ui/
 *       main.js           (shared UI asset — needed by hydrateUserData)
 */
function buildSyntheticFixture(packageRoot) {
  const version = '1.0.0';

  // Top-level package.json (for index.js version command fallback).
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ name: 'rad-orchestration', version }, null, 2),
  );

  const bundleRoot = path.join(packageRoot, 'dist', 'claude');
  fs.mkdirSync(bundleRoot, { recursive: true });

  // Per-harness package.json (read by installHarness to get deliveringVersion).
  fs.writeFileSync(
    path.join(bundleRoot, 'package.json'),
    JSON.stringify({ name: 'rad-orchestration', version }, null, 2),
  );

  // agents/orchestrator.md
  fs.mkdirSync(path.join(bundleRoot, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(bundleRoot, 'agents', 'orchestrator.md'), `# orchestrator v${version}\n`);

  // skills/rad-orchestration/scripts/radorch.mjs
  const scriptsDir = path.join(bundleRoot, 'skills', 'rad-orchestration', 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(path.join(scriptsDir, 'radorch.mjs'), `#!/usr/bin/env node\n// v${version}\n`);

  // manifests/v1.0.0.json
  const manifest = {
    files: [
      {
        bundlePath: 'agents/orchestrator.md',
        destinationPath: '${HARNESS_ROOT}/agents/orchestrator.md',
        sha256: 'x',
      },
      {
        bundlePath: 'skills/rad-orchestration/scripts/radorch.mjs',
        destinationPath: '${HARNESS_ROOT}/skills/rad-orchestration/scripts/radorch.mjs',
        sha256: 'y',
      },
    ],
  };
  fs.mkdirSync(path.join(bundleRoot, 'manifests'), { recursive: true });
  fs.writeFileSync(
    path.join(bundleRoot, 'manifests', `v${version}.json`),
    JSON.stringify(manifest, null, 2),
  );

  // orchestration.yml — needed by hydrateUserData.
  fs.writeFileSync(
    path.join(bundleRoot, 'orchestration.yml'),
    'model: claude-opus-4-5\n',
  );

  // templates/ — four shipped tier files.
  const templatesDir = path.join(bundleRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  for (const name of ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml']) {
    fs.writeFileSync(path.join(templatesDir, name), `# ${name}\n`);
  }

  // Shared UI asset — hydrateUserData copies dist/ui/ to ~/.radorch/ui/.
  // The UI is in the shared dist/ root, not in dist/claude/.
  const uiDir = path.join(packageRoot, 'dist', 'ui');
  fs.mkdirSync(uiDir, { recursive: true });
  fs.writeFileSync(path.join(uiDir, 'main.js'), '// ui bundle\n');
}

/**
 * Strip ANSI escape codes from a string so we can assert on plain text.
 * @param {string} s
 * @returns {string}
 */
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Spawn index.js with the given argv, pointing HOME/USERPROFILE at tmpHome
 * and RADORCH_PACKAGE_ROOT at packageRoot so index.js doesn't touch the real
 * ~/.claude or ~/.radorch.
 *
 * @param {string[]} argv
 * @param {{ tmpHome: string, packageRoot?: string, cwd?: string }} opts
 * @returns {{ stdout: string, stderr: string, status: number | null }}
 */
function spawnIndex(argv, { tmpHome, packageRoot, cwd }) {
  const env = {
    ...process.env,
    HOME: tmpHome,
    USERPROFILE: tmpHome,
    // Force chalk/ora to skip ANSI so stdout assertions work on plain text.
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    // Force narrow terminal so banner.js emits the plain "RadOrch" text instead
    // of figlet block art (which doesn't contain the literal string "RadOrch").
    COLUMNS: '50',
  };
  if (packageRoot) {
    env.RADORCH_PACKAGE_ROOT = packageRoot;
  }
  const result = spawnSync(
    process.execPath,
    [INDEX_JS, ...argv],
    {
      cwd: cwd ?? tmpHome,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('index.js --yes --harness claude: banner → Installation Complete → What\'s Next (DD-2, FR-7, FR-8)', async () => {
  const tmp = mkTmp('idx-happy-');
  const tmpHome = path.join(tmp, 'home');
  fs.mkdirSync(tmpHome, { recursive: true });
  const packageRoot = path.join(tmp, 'pkg');
  fs.mkdirSync(packageRoot, { recursive: true });

  try {
    buildSyntheticFixture(packageRoot);

    const { stdout, stderr, status } = spawnIndex(
      ['--yes', '--harness', 'claude'],
      { tmpHome, packageRoot, cwd: tmpHome },
    );

    const out = stripAnsi(stdout);
    const err = stripAnsi(stderr);

    // Dump on failure for diagnostics.
    const diag = `\n--- stdout ---\n${out}\n--- stderr ---\n${err}\n`;

    assert.strictEqual(status, 0, `Expected exit 0.${diag}`);

    // Surface-order assertions (DD-2): RadOrch banner → Installation Complete → What's Next.
    // The section header format is "── ::  <title> ──..." so we search for the
    // title text rather than pinning the exact marker prefix.
    const bannerIdx = out.indexOf('RadOrch');
    const completeIdx = out.indexOf('Installation Complete');
    const nextIdx = out.indexOf("What's Next");

    assert.ok(bannerIdx !== -1, `"RadOrch" not found in stdout.${diag}`);
    assert.ok(completeIdx !== -1, `"Installation Complete" not found in stdout.${diag}`);
    assert.ok(nextIdx !== -1, `"What's Next" not found in stdout.${diag}`);

    assert.ok(
      bannerIdx < completeIdx,
      `"RadOrch" must appear before "Installation Complete".${diag}`,
    );
    assert.ok(
      completeIdx < nextIdx,
      `"Installation Complete" must appear before "What's Next".${diag}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('index.js uninstall: exits 0 and prints the pointer message (FR-29)', () => {
  const tmp = mkTmp('idx-uninstall-');
  const tmpHome = path.join(tmp, 'home');
  fs.mkdirSync(tmpHome, { recursive: true });

  try {
    const { stdout, status } = spawnIndex(
      ['uninstall'],
      { tmpHome, cwd: tmpHome },
    );

    const out = stripAnsi(stdout);

    assert.strictEqual(status, 0, 'uninstall must exit 0');
    assert.ok(
      out.includes('Run /rad-ui-stop and then radorch uninstall from inside your harness'),
      `Expected uninstall pointer message in stdout. Got:\n${out}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('index.js --yes --harness bogus: exits non-zero and names allowed values (FR-7)', () => {
  const tmp = mkTmp('idx-bogus-');
  const tmpHome = path.join(tmp, 'home');
  fs.mkdirSync(tmpHome, { recursive: true });

  try {
    const { stderr, stdout, status } = spawnIndex(
      ['--yes', '--harness', 'bogus'],
      { tmpHome, cwd: tmpHome },
    );

    const errOut = stripAnsi(stderr);
    const stdOut = stripAnsi(stdout);
    const combined = errOut + stdOut;

    assert.notStrictEqual(status, 0, 'bogus harness must exit non-zero');
    assert.ok(
      combined.includes('claude') && (combined.includes('copilot-vscode') || combined.includes('copilot')),
      `Expected stderr to name allowed harness values. Got stderr:\n${errOut}\nstdout:\n${stdOut}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

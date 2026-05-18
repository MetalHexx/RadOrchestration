// tests/lib/drift-check.test.mjs — Cross-channel drift detection between the
// standard installer and Claude Code's plugin registry. Every test passes a
// synthetic `homeDir` so the real ~/.claude is never read.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectPluginDrift } from '../../lib/drift-check.js';

function mkHome(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeRegistry(home, contents) {
  const dir = path.join(home, '.claude', 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'installed_plugins.json'),
    typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2),
  );
}

describe('detectPluginDrift — defensive defaults (NFR-4)', () => {
  it('returns { drift: false, plugins: [] } when registry file is absent', () => {
    const home = mkHome('std-drift-abs-');
    try {
      const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
      assert.deepEqual(result, { drift: false, plugins: [] });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns no-drift on malformed JSON in the registry', () => {
    const home = mkHome('std-drift-bad-');
    try {
      writeRegistry(home, '{ not valid json');
      const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
      assert.deepEqual(result, { drift: false, plugins: [] });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns no-drift when the registry has no rad-orchestration entries', () => {
    const home = mkHome('std-drift-none-');
    try {
      writeRegistry(home, {
        plugins: {
          'some-other-plugin@market': [{ version: '0.1.0' }],
        },
      });
      const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
      assert.equal(result.drift, false);
      assert.deepEqual(result.plugins, []);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns no-drift when the rad-orchestration entry matches installedVersion', () => {
    const home = mkHome('std-drift-match-');
    try {
      writeRegistry(home, {
        plugins: {
          'rad-orchestration@official': [
            { version: '1.0.0-alpha.9', installPath: '/x' },
          ],
        },
      });
      const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
      assert.equal(result.drift, false);
      assert.deepEqual(result.plugins, []);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('detectPluginDrift — drift detection (FR-9, AD-15)', () => {
  it('returns drift:true with the mismatching entry surfaced', () => {
    const home = mkHome('std-drift-mismatch-');
    try {
      writeRegistry(home, {
        plugins: {
          'rad-orchestration@official': [
            { version: '1.0.0-alpha.8', installPath: '/some/path' },
          ],
        },
      });
      const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
      assert.equal(result.drift, true);
      assert.equal(result.plugins.length, 1);
      assert.equal(result.plugins[0].key, 'rad-orchestration@official');
      assert.equal(result.plugins[0].version, '1.0.0-alpha.8');
      assert.equal(result.plugins[0].installPath, '/some/path');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('ignores plugin keys whose name part is not exactly "rad-orchestration"', () => {
    const home = mkHome('std-drift-namepart-');
    try {
      writeRegistry(home, {
        plugins: {
          'rad-orchestration-extras@official': [{ version: '0.0.1' }],
        },
      });
      const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
      assert.equal(result.drift, false);
      assert.deepEqual(result.plugins, []);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

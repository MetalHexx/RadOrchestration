// tests/scripts/plugin-tarball-size.test.mjs
//
// Asserts that the staged Claude plugin tarball stays within its published
// size budget: 50 MB unpacked + 10% headroom = 57,671,680 bytes. Bloat past
// this ceiling makes installs slow and updates expensive, so the budget is
// load-bearing for the plugin distribution channel.
//
// We measure size via `npm pack --dry-run --json` because that walks the
// exact `files` allowlist in plugin/package.json — the same filter the
// published tarball uses. A naive recursive directory sum overcounts by
// ~80 MB of dev debris (node_modules/, tests/, dist-bundle/, etc.) that
// npm pack strips.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 50 MB ceiling + 10% headroom. The headroom absorbs small dependency-graph
// growth between releases without requiring a fixture bump; if we ever push
// past it, the right move is a real audit (what got pulled in?), not a quiet
// raise.
const SIZE_LIMIT_BYTES = Math.round(50 * 1024 * 1024 * 1.1);

test('staged plugin tarball stays under the unpacked size budget (50 MB + 10%)', (t) => {
  const stagedRoot = path.join(
    repoRoot, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration',
  );
  if (!fs.existsSync(stagedRoot)) {
    t.skip('staged plugin tree absent — run npm run build:plugin first');
    return;
  }

  const out = execSync('npm pack --dry-run --json', {
    cwd: stagedRoot,
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const unpackedSize = entry?.unpackedSize ?? entry?.size ?? 0;

  assert.ok(
    unpackedSize > 0,
    `npm pack --dry-run reported no unpackedSize for ${stagedRoot}`,
  );
  assert.ok(
    unpackedSize <= SIZE_LIMIT_BYTES,
    `staged plugin tarball unpacked size ${unpackedSize} bytes exceeds size budget ${SIZE_LIMIT_BYTES} bytes (50 MB + 10% headroom)`,
  );
});

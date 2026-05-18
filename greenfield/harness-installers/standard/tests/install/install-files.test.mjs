import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installManifestFiles } from '../../lib/install/install-files.js';
import { removeManifestFiles } from '../../lib/install/remove-files.js';

test('installManifestFiles copies entries to expanded destinationPath, skips projects/, chmods CLI sentinel on POSIX', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'std-if-'));
  try {
    const bundle = path.join(tmp, 'bundle'); const home = path.join(tmp, 'home');
    process.env.HOME = home; process.env.USERPROFILE = home;
    fs.mkdirSync(path.join(bundle, 'skills/rad-orchestration/scripts'), { recursive: true });
    fs.writeFileSync(path.join(bundle, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
    fs.writeFileSync(path.join(bundle, 'fileA.md'), 'A');
    const manifest = { files: [
      { bundlePath: 'fileA.md', destinationPath: '${HARNESS_ROOT}/agents/fileA.md', sha256: 'x' },
      { bundlePath: 'skills/rad-orchestration/scripts/radorch.mjs', destinationPath: '${HARNESS_ROOT}/skills/rad-orchestration/scripts/radorch.mjs', sha256: 'y' },
      { bundlePath: 'shouldSkip.md', destinationPath: '${RAD_HOME}/projects/foo.md', sha256: 'z' },
    ]};
    const { copiedCount, skippedCount } = installManifestFiles(manifest, bundle, 'claude');
    assert.strictEqual(skippedCount, 1, 'projects/ entry skipped (AD-13)');
    assert.strictEqual(copiedCount, 2);
    if (process.platform !== 'win32') {
      const mode = fs.statSync(path.join(home, '.claude/skills/rad-orchestration/scripts/radorch.mjs')).mode & 0o777;
      assert.strictEqual(mode, 0o755, 'NFR-6: CLI sentinel chmod 0o755 on POSIX');
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('removeManifestFiles deletes every entry and prunes emptied parent dirs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'std-rm-'));
  try {
    const home = path.join(tmp, 'home');
    process.env.HOME = home; process.env.USERPROFILE = home;
    const sub = path.join(home, '.claude/agents'); fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'orchestrator.md'), 'x');
    const manifest = { files: [ { bundlePath: 'agents/orchestrator.md', destinationPath: '${HARNESS_ROOT}/agents/orchestrator.md', sha256: 'x' } ] };
    removeManifestFiles(manifest, 'claude');
    assert.strictEqual(fs.existsSync(path.join(sub, 'orchestrator.md')), false);
    assert.strictEqual(fs.existsSync(sub), false, 'AD-5: emptied parent dir pruned');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

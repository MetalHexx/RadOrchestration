import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { emitCliBundle } from '../emit-cli-bundle.js';

test('emitCliBundle writes one bundle to the requested outfile, never creates cli/dist/, sets 0o755 on POSIX', async () => {
  const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'emit-cli-'));
  try {
    // Synthetic mini-CLI source so the test does not depend on real cli/.
    const src = join(tmpRoot, 'src-cli');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(join(src, 'index.js'), 'export const hi = () => "ok";\n');
    fs.writeFileSync(join(src, 'package.json'), JSON.stringify({ name: 'x', type: 'module', main: 'index.js' }));
    const out = join(tmpRoot, 'out/radorch.mjs');
    await emitCliBundle({ source: src, target: out, entryPoint: join(src, 'index.js') });
    assert.ok(fs.existsSync(out), 'outfile written at caller-specified path (FR-26, DD-12)');
    assert.ok(!fs.existsSync(join(src, 'dist')), 'no cli/dist/ litter created (NFR-4)');
    if (process.platform !== 'win32') {
      const mode = fs.statSync(out).mode & 0o777;
      assert.strictEqual(mode, 0o755, 'POSIX chmod 0o755 applied at build time (FR-21)');
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

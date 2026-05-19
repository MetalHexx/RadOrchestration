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
    assert.ok(fs.existsSync(out), 'outfile written at caller-specified path');
    assert.ok(!fs.existsSync(join(src, 'dist')), 'no cli/dist/ litter created');
    if (process.platform !== 'win32') {
      const mode = fs.statSync(out).mode & 0o777;
      assert.strictEqual(mode, 0o755, 'POSIX chmod 0o755 applied at build time');
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('emitCliBundle output has exactly one shebang even when the entry source begins with its own shebang', async () => {
  // Guards against a double-prepend bug: esbuild's `banner` does not deduplicate
  // against a shebang already in the entry source, so a stray shebang in the
  // entry .ts plus the banner produced a `radorch.mjs` whose line 2 was a second
  // `#!/usr/bin/env node` — invalid ESM that Node rejects with SyntaxError.
  const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'emit-cli-shebang-'));
  try {
    const src = join(tmpRoot, 'src-cli');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(join(src, 'entry.js'), '#!/usr/bin/env node\nexport const hi = () => "ok";\n');
    fs.writeFileSync(join(src, 'package.json'), JSON.stringify({ name: 'x', type: 'module' }));
    const out = join(tmpRoot, 'out/radorch.mjs');
    await emitCliBundle({ source: src, target: out, entryPoint: join(src, 'entry.js') });
    const lines = fs.readFileSync(out, 'utf8').split(/\r?\n/);
    assert.strictEqual(lines[0], '#!/usr/bin/env node', 'line 1 is the canonical shebang');
    assert.ok(!lines[1].startsWith('#!'), `line 2 must not start with "#!" (got: ${JSON.stringify(lines[1])})`);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

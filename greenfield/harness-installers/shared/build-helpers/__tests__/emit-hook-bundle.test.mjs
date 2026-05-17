import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { emitHookBundle } from '../emit-hook-bundle.js';

test('emitHookBundle bundles bootstrap.mjs with deps inlined and copies drift-check + hooks.json + AGENTS.md verbatim', async () => {
  const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'emit-hook-'));
  try {
    const hooks = join(tmpRoot, 'hooks');
    const lib = join(tmpRoot, 'lib/install');
    fs.mkdirSync(hooks, { recursive: true });
    fs.mkdirSync(lib, { recursive: true });
    // bootstrap imports a sibling lib module that must be inlined.
    fs.writeFileSync(join(lib, 'install-json.js'), 'export const v = 42;\n');
    fs.writeFileSync(join(hooks, 'bootstrap.mjs'),
      "import { v } from '../lib/install/install-json.js';\nconsole.error(v);\n");
    fs.writeFileSync(join(hooks, 'drift-check.mjs'), '// drift-check verbatim\n');
    fs.writeFileSync(join(hooks, 'hooks.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [] } }, null, 2) + '\n');
    fs.writeFileSync(join(hooks, 'AGENTS.md'), '# Hooks AGENTS.md\n');

    const target = join(tmpRoot, 'out/hooks');
    await emitHookBundle({ source: hooks, target, libRoot: join(tmpRoot, 'lib') });
    const bundled = fs.readFileSync(join(target, 'bootstrap.mjs'), 'utf8');
    assert.ok(bundled.includes('42'), 'lib/install/install-json.js inlined into bootstrap.mjs');
    assert.ok(!bundled.includes("from '../lib/install/install-json.js'"), 'no unresolved imports remain');
    assert.strictEqual(fs.readFileSync(join(target, 'drift-check.mjs'), 'utf8'), '// drift-check verbatim\n',
      'drift-check.mjs copied verbatim, unbundled');
    assert.ok(fs.existsSync(join(target, 'hooks.json')), 'hooks.json copied verbatim');
    assert.ok(fs.existsSync(join(target, 'AGENTS.md')), 'hooks/AGENTS.md copied verbatim');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

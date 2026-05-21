import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { bakeAbsolutePaths } from '../lib/install/bake-paths.js';

const TOKEN = '${COPILOT_VSCODE_PLUGIN_ROOT}';

function makeTree() {
  const root = fs.mkdtempSync(join(os.tmpdir(), 'vsc-bake-'));
  fs.mkdirSync(join(root, 'skills/rad-ui-start'), { recursive: true });
  fs.mkdirSync(join(root, 'skills/rad-orchestration/references'), { recursive: true });
  fs.mkdirSync(join(root, 'hooks'), { recursive: true });
  fs.writeFileSync(
    join(root, 'skills/rad-ui-start/SKILL.md'),
    `# rad-ui-start\n\n\`\`\`bash\nnode "${TOKEN}/skills/rad-orchestration/scripts/radorch.mjs" ui start\n\`\`\`\n`,
  );
  fs.writeFileSync(
    join(root, 'skills/rad-orchestration/references/action-event-reference.md'),
    `See ${TOKEN}/skills/rad-plan-audit/references/full-audit.md.\n`,
  );
  fs.writeFileSync(
    join(root, 'skills/no-token.md'),
    `Plain doc with no token.\n`,
  );
  fs.writeFileSync(
    join(root, 'hooks/AGENTS.md'),
    `The shim reads \`process.env.CLAUDE_PLUGIN_ROOT\`. Discusses ${TOKEN} in prose; must not be substituted.\n`,
  );
  fs.writeFileSync(
    join(root, 'hooks/bootstrap.mjs'),
    `// ${TOKEN} is read from process.env\n`,
  );
  return root;
}

test('bakeAbsolutePaths substitutes the token with a forward-slashed absolute path', () => {
  const root = makeTree();
  try {
    const result = bakeAbsolutePaths(root);
    assert.strictEqual(result.baked, 2, 'two .md files under skills/ contained the token');
    const skill = fs.readFileSync(join(root, 'skills/rad-ui-start/SKILL.md'), 'utf8');
    const expectedPath = root.replaceAll('\\', '/');
    assert.ok(skill.includes(`node "${expectedPath}/skills/rad-orchestration/scripts/radorch.mjs"`),
      `expected baked absolute path; got: ${skill}`);
    assert.ok(!skill.includes(TOKEN), 'token literal removed from SKILL.md');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bakeAbsolutePaths is idempotent — running twice yields the same content as running once', () => {
  const root = makeTree();
  try {
    bakeAbsolutePaths(root);
    const after1 = fs.readFileSync(join(root, 'skills/rad-ui-start/SKILL.md'), 'utf8');
    const result2 = bakeAbsolutePaths(root);
    const after2 = fs.readFileSync(join(root, 'skills/rad-ui-start/SKILL.md'), 'utf8');
    assert.strictEqual(after1, after2, 'second bake produces identical file content');
    assert.strictEqual(result2.baked, 0, 'second bake reports zero files written (no token remains)');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bakeAbsolutePaths does not touch files under hooks/', () => {
  const root = makeTree();
  try {
    const hooksBefore = fs.readFileSync(join(root, 'hooks/AGENTS.md'), 'utf8');
    const bootstrapBefore = fs.readFileSync(join(root, 'hooks/bootstrap.mjs'), 'utf8');
    bakeAbsolutePaths(root);
    const hooksAfter = fs.readFileSync(join(root, 'hooks/AGENTS.md'), 'utf8');
    const bootstrapAfter = fs.readFileSync(join(root, 'hooks/bootstrap.mjs'), 'utf8');
    assert.strictEqual(hooksAfter, hooksBefore, 'hooks/AGENTS.md untouched (token in prose preserved)');
    assert.strictEqual(bootstrapAfter, bootstrapBefore, 'hooks/bootstrap.mjs untouched');
    assert.ok(hooksAfter.includes(TOKEN), 'token literal still present in hooks/AGENTS.md');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bakeAbsolutePaths skips .md files that contain no token (no needless rewrite)', () => {
  const root = makeTree();
  try {
    const before = fs.statSync(join(root, 'skills/no-token.md'));
    // Sleep briefly so mtime would change if a write occurred.
    const sleep = Date.now() + 20;
    while (Date.now() < sleep) { /* spin */ }
    bakeAbsolutePaths(root);
    const after = fs.statSync(join(root, 'skills/no-token.md'));
    assert.strictEqual(before.mtimeMs, after.mtimeMs, 'no write to token-free file');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bakeAbsolutePaths normalizes backslashes in pluginRoot to forward slashes in the output', () => {
  const root = makeTree();
  try {
    // Use a backslashed plugin-root string (the form Windows `path.dirname(fileURLToPath(...))`
    // can produce). The bake output must always be forward-slashed so the resulting absolute
    // path survives quoting in both bash and PowerShell on Windows.
    const backslashed = root.split(path.sep).join('\\');
    bakeAbsolutePaths(backslashed);
    const skill = fs.readFileSync(join(root, 'skills/rad-ui-start/SKILL.md'), 'utf8');
    const expected = backslashed.replaceAll('\\', '/');
    assert.ok(skill.includes(`node "${expected}/skills/`), `expected forward-slashed path in output; got: ${skill}`);
    assert.ok(!skill.includes('\\skills\\'), 'no backslashed path components in baked output');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

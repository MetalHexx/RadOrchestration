/**
 * Tests for resolveDocPath prefix stripping logic.
 * Run with: node --experimental-vm-modules ui/lib/path-resolver.test.mjs
 */
import path from 'node:path';
import assert from 'node:assert';

// Inline the function logic since we can't directly import .ts without a transpiler
function resolveDocPath(workspaceRoot, basePath, projectName, relativePath) {
  const prefix = basePath + '/' + projectName + '/';
  const normalizedPrefix = prefix.replace(/\\/g, '/');
  const normalizedRelPath = relativePath.replace(/\\/g, '/');

  const strippedPath = normalizedRelPath.startsWith(normalizedPrefix)
    ? normalizedRelPath.slice(normalizedPrefix.length)
    : relativePath;

  return path.resolve(workspaceRoot, basePath, projectName, strippedPath);
}

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

test('Workspace-relative path strips prefix correctly', () => {
  const result = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'custom/project-store/PROJ/tasks/FILE.md');
  const expected = path.resolve('/ws', 'custom/project-store', 'PROJ', 'tasks/FILE.md');
  assert.strictEqual(result, expected);
});

test('Project-relative path passes through unchanged', () => {
  const result = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'tasks/FILE.md');
  const expected = path.resolve('/ws', 'custom/project-store', 'PROJ', 'tasks/FILE.md');
  assert.strictEqual(result, expected);
});

test('Root-level file passes through unchanged', () => {
  const result = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'PROJ-PRD.md');
  const expected = path.resolve('/ws', 'custom/project-store', 'PROJ', 'PROJ-PRD.md');
  assert.strictEqual(result, expected);
});

test('Workspace-relative root-level file strips prefix correctly', () => {
  const result = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'custom/project-store/PROJ/PROJ-PRD.md');
  const expected = path.resolve('/ws', 'custom/project-store', 'PROJ', 'PROJ-PRD.md');
  assert.strictEqual(result, expected);
});

test('Windows backslash path normalizes and strips prefix', () => {
  const result = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'custom\\project-store\\PROJ\\tasks\\FILE.md');
  const expected = path.resolve('/ws', 'custom/project-store', 'PROJ', 'tasks/FILE.md');
  assert.strictEqual(result, expected);
});

test('Idempotent - already-stripped path produces same result', () => {
  const withPrefix = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'custom/project-store/PROJ/tasks/FILE.md');
  const withoutPrefix = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'tasks/FILE.md');
  assert.strictEqual(withPrefix, withoutPrefix);
});

test('Both workspace-relative and project-relative produce identical output', () => {
  const wsRelative = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'custom/project-store/PROJ/phases/PHASE-PLAN-P01.md');
  const projRelative = resolveDocPath('/ws', 'custom/project-store', 'PROJ', 'phases/PHASE-PLAN-P01.md');
  assert.strictEqual(wsRelative, projRelative);
});

// Run all tests
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

console.log(`\nResults: ${passed}/${passed + failed} passing`);
if (failed > 0) {
  process.exit(1);
}

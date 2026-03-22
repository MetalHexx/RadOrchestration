/**
 * Tests for resolveDocPath prefix stripping logic and resolveBasePath PROJECTS_DIR override.
 * Run with: node --experimental-vm-modules ui/lib/path-resolver.test.mjs
 */
import path from 'node:path';
import assert from 'node:assert';

// Inline the function logic since we can't directly import .ts without a transpiler
function resolveBasePath(workspaceRoot, basePath) {
  if (process.env.PROJECTS_DIR) {
    return process.env.PROJECTS_DIR;
  }
  return path.resolve(workspaceRoot, basePath);
}

function resolveProjectDir(workspaceRoot, basePath, projectName) {
  return path.join(resolveBasePath(workspaceRoot, basePath), projectName);
}

function resolveDocPath(workspaceRoot, basePath, projectName, relativePath) {
  const prefix = basePath + '/' + projectName + '/';
  const normalizedPrefix = prefix.replace(/\\/g, '/');
  const normalizedRelPath = relativePath.replace(/\\/g, '/');

  let strippedPath;
  if (normalizedRelPath.startsWith(normalizedPrefix)) {
    strippedPath = normalizedRelPath.slice(normalizedPrefix.length);
  } else {
    const marker = '/' + projectName + '/';
    const markerIdx = normalizedRelPath.indexOf(marker);
    strippedPath = markerIdx !== -1
      ? normalizedRelPath.slice(markerIdx + marker.length)
      : relativePath;
  }

  return path.join(resolveBasePath(workspaceRoot, basePath), projectName, strippedPath);
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

// ── resolveBasePath — PROJECTS_DIR override ──────────────────────────────────

test('resolveBasePath returns PROJECTS_DIR when env var is set', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    process.env.PROJECTS_DIR = '/projects';
    const result = resolveBasePath('/workspace', 'orchestration-projects');
    assert.strictEqual(result, '/projects');
  } finally {
    if (orig === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = orig;
  }
});

test('resolveBasePath falls back to path.resolve when PROJECTS_DIR is not set', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    delete process.env.PROJECTS_DIR;
    const result = resolveBasePath('/workspace', 'orchestration-projects');
    assert.strictEqual(result, path.resolve('/workspace', 'orchestration-projects'));
  } finally {
    if (orig !== undefined) process.env.PROJECTS_DIR = orig;
  }
});

// ── resolveProjectDir — PROJECTS_DIR override ────────────────────────────────

test('resolveProjectDir uses PROJECTS_DIR when set', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    process.env.PROJECTS_DIR = '/projects';
    const result = resolveProjectDir('/workspace', 'orchestration-projects', 'MY-PROJECT');
    assert.strictEqual(result, path.join('/projects', 'MY-PROJECT'));
  } finally {
    if (orig === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = orig;
  }
});

test('resolveProjectDir falls back when PROJECTS_DIR is not set', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    delete process.env.PROJECTS_DIR;
    const result = resolveProjectDir('/workspace', 'orchestration-projects', 'MY-PROJECT');
    assert.strictEqual(result, path.join(path.resolve('/workspace', 'orchestration-projects'), 'MY-PROJECT'));
  } finally {
    if (orig !== undefined) process.env.PROJECTS_DIR = orig;
  }
});

// ── resolveDocPath — PROJECTS_DIR override ───────────────────────────────────

test('resolveDocPath uses PROJECTS_DIR when set', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    process.env.PROJECTS_DIR = '/projects';
    const result = resolveDocPath('/workspace', 'orchestration-projects', 'PROJ', 'tasks/FILE.md');
    assert.strictEqual(result, path.join('/projects', 'PROJ', 'tasks/FILE.md'));
  } finally {
    if (orig === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = orig;
  }
});

// ── Docker scenario: absolute host path with relative base_path ─────────────

test('Docker: absolute Windows host path stripped by project marker, no PROJECTS_DIR', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    delete process.env.PROJECTS_DIR;
    // state.json contains a Windows absolute path; base_path is relative
    const result = resolveDocPath(
      '/workspace',
      'orchestration-projects',
      'MY-PROJECT',
      'C:/test/orchestration-projects/MY-PROJECT/MY-PROJECT-PRD.md'
    );
    const expected = path.join(
      path.resolve('/workspace', 'orchestration-projects'),
      'MY-PROJECT',
      'MY-PROJECT-PRD.md'
    );
    assert.strictEqual(result, expected);
  } finally {
    if (orig === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = orig;
  }
});

test('Docker: absolute Windows host path + PROJECTS_DIR resolves to container path', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    process.env.PROJECTS_DIR = '/projects';
    const result = resolveDocPath(
      '/workspace',
      'orchestration-projects',
      'MY-PROJECT',
      'C:/test/orchestration-projects/MY-PROJECT/tasks/MY-PROJECT-HANDOFF-P01-T01.md'
    );
    assert.strictEqual(result, path.join('/projects', 'MY-PROJECT', 'tasks', 'MY-PROJECT-HANDOFF-P01-T01.md'));
  } finally {
    if (orig === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = orig;
  }
});

test('Docker: project-relative path still works correctly with PROJECTS_DIR', () => {
  const orig = process.env.PROJECTS_DIR;
  try {
    process.env.PROJECTS_DIR = '/projects';
    const result = resolveDocPath('/workspace', 'orchestration-projects', 'MY-PROJECT', 'MY-PROJECT-PRD.md');
    assert.strictEqual(result, path.join('/projects', 'MY-PROJECT', 'MY-PROJECT-PRD.md'));
  } finally {
    if (orig === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = orig;
  }
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

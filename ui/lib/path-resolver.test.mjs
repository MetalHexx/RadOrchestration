import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

test('getProjectsRoot returns ~/.radorch/projects/', async () => {
  const m = await import('./path-resolver.ts');
  const r = m.getProjectsRoot();
  assert.equal(r, path.join(os.homedir(), '.radorch', 'projects'));
});

test('getTemplatesRoot returns ~/.radorch/templates/', async () => {
  const m = await import('./path-resolver.ts');
  const r = m.getTemplatesRoot();
  assert.equal(r, path.join(os.homedir(), '.radorch', 'templates'));
});

test('PROJECTS_DIR is ignored entirely', async () => {
  const prior = process.env.PROJECTS_DIR;
  process.env.PROJECTS_DIR = '/some/docker/mount';
  try {
    const m = await import('./path-resolver.ts');
    assert.notEqual(m.getProjectsRoot(), '/some/docker/mount');
  } finally {
    if (prior === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = prior;
  }
});

test('no getWorkspaceRoot export remains', async () => {
  const m = await import('./path-resolver.ts');
  assert.equal(m.getWorkspaceRoot, undefined);
});

test('resolveProjectDir composes ~/.radorch/projects/<name>', async () => {
  const m = await import('./path-resolver.ts');
  assert.equal(m.resolveProjectDir('MY-PROJ'), path.join(os.homedir(), '.radorch', 'projects', 'MY-PROJ'));
});

test('RADORCH_HOME is ignored entirely (FR-12)', async () => {
  const prior = process.env.RADORCH_HOME;
  process.env.RADORCH_HOME = '/some/legacy/override';
  try {
    const m = await import('./path-resolver.ts');
    const expected = path.join(os.homedir(), '.radorch', 'projects');
    assert.equal(m.getProjectsRoot(), expected);
    assert.notEqual(m.getProjectsRoot(), '/some/legacy/override/projects');
  } finally {
    if (prior === undefined) delete process.env.RADORCH_HOME;
    else process.env.RADORCH_HOME = prior;
  }
});

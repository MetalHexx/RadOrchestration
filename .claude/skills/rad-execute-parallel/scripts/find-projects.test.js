'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseArgs, readProjectState, extractMasterPlanPath, extractWorktreeInfo } = require('./find-projects');

// ─── Sandbox helper ─────────────────────────────────────────────────────────

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'find-projects-'));
  return {
    dir,
    cleanup() { fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

function writeState(baseDir, projectName, state) {
  const projectDir = path.join(baseDir, projectName);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'state.json'), JSON.stringify(state));
  return projectDir;
}

// ─── parseArgs ──────────────────────────────────────────────────────────────

describe('parseArgs', () => {

  it('parses all three flags', () => {
    const result = parseArgs(['node', 'script.js',
      '--projects-base-path', '/data/projects',
      '--repo-root', '/repo',
      '--project-name', 'MY-PROJECT',
    ]);
    assert.equal(result.projectsBasePath, '/data/projects');
    assert.equal(result.repoRoot, '/repo');
    assert.equal(result.projectName, 'MY-PROJECT');
  });

  it('returns nulls when no flags provided', () => {
    const result = parseArgs(['node', 'script.js']);
    assert.equal(result.projectsBasePath, null);
    assert.equal(result.repoRoot, null);
    assert.equal(result.projectName, null);
  });

  it('handles flags in any order', () => {
    const result = parseArgs(['node', 'script.js',
      '--project-name', 'X',
      '--repo-root', '/r',
      '--projects-base-path', '/p',
    ]);
    assert.equal(result.projectName, 'X');
    assert.equal(result.repoRoot, '/r');
    assert.equal(result.projectsBasePath, '/p');
  });

  it('ignores unknown flags', () => {
    const result = parseArgs(['node', 'script.js', '--unknown', 'val', '--repo-root', '/r']);
    assert.equal(result.repoRoot, '/r');
    assert.equal(result.projectsBasePath, null);
  });
});

// ─── readProjectState ───────────────────────────────────────────────────────

describe('readProjectState', () => {

  it('reads and parses state.json from a project directory', () => {
    const sandbox = makeSandbox();
    try {
      const state = { pipeline: { current_tier: 'execution' } };
      const dir = writeState(sandbox.dir, 'MY-PROJECT', state);
      const result = readProjectState(dir);
      assert.deepEqual(result, state);
    } finally {
      sandbox.cleanup();
    }
  });

  it('returns null when state.json does not exist', () => {
    const sandbox = makeSandbox();
    try {
      fs.mkdirSync(path.join(sandbox.dir, 'EMPTY'), { recursive: true });
      assert.equal(readProjectState(path.join(sandbox.dir, 'EMPTY')), null);
    } finally {
      sandbox.cleanup();
    }
  });

  it('returns null when state.json contains invalid JSON', () => {
    const sandbox = makeSandbox();
    try {
      const dir = path.join(sandbox.dir, 'BAD');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'state.json'), '{ not valid json }}');
      assert.equal(readProjectState(dir), null);
    } finally {
      sandbox.cleanup();
    }
  });

  it('returns null when directory does not exist', () => {
    assert.equal(readProjectState('/nonexistent/path/NOTHING'), null);
  });
});

// ─── extractMasterPlanPath ──────────────────────────────────────────────────

describe('extractMasterPlanPath', () => {

  it('extracts doc_path from the master_plan step by id', () => {
    const state = {
      planning: {
        steps: [
          { id: 'research', doc_path: 'research.md' },
          { id: 'master_plan', doc_path: '/projects/PROJ/MASTER-PLAN.md' },
        ],
      },
    };
    assert.equal(extractMasterPlanPath(state), '/projects/PROJ/MASTER-PLAN.md');
  });

  it('extracts doc_path from the master_plan step by name', () => {
    const state = {
      planning: {
        steps: [
          { name: 'master_plan', doc_path: '/mp.md' },
        ],
      },
    };
    assert.equal(extractMasterPlanPath(state), '/mp.md');
  });

  it('returns null when no master_plan step exists', () => {
    const state = {
      planning: {
        steps: [{ id: 'research', doc_path: 'r.md' }],
      },
    };
    assert.equal(extractMasterPlanPath(state), null);
  });

  it('returns null when steps array is empty', () => {
    assert.equal(extractMasterPlanPath({ planning: { steps: [] } }), null);
  });

  it('returns null for null state', () => {
    assert.equal(extractMasterPlanPath(null), null);
  });

  it('returns null when planning is missing', () => {
    assert.equal(extractMasterPlanPath({}), null);
  });

  it('returns null when planning.steps is not an array', () => {
    assert.equal(extractMasterPlanPath({ planning: { steps: 'bad' } }), null);
  });
});

// ─── extractWorktreeInfo ────────────────────────────────────────────────────

describe('extractWorktreeInfo', () => {

  it('extracts worktree_path and branch from source_control', () => {
    const state = {
      pipeline: {
        source_control: {
          worktree_path: '/wt/PROJECT',
          branch: 'feat/PROJECT',
        },
      },
    };
    const result = extractWorktreeInfo(state);
    assert.equal(result.worktreePath, '/wt/PROJECT');
    assert.equal(result.branch, 'feat/PROJECT');
  });

  it('returns nulls when source_control is absent', () => {
    const result = extractWorktreeInfo({ pipeline: {} });
    assert.equal(result.worktreePath, null);
    assert.equal(result.branch, null);
  });

  it('returns nulls for null state', () => {
    const result = extractWorktreeInfo(null);
    assert.equal(result.worktreePath, null);
    assert.equal(result.branch, null);
  });

  it('returns nulls when pipeline is missing', () => {
    const result = extractWorktreeInfo({});
    assert.equal(result.worktreePath, null);
    assert.equal(result.branch, null);
  });

  it('handles partial source_control (only branch)', () => {
    const state = {
      pipeline: {
        source_control: { branch: 'feat/X' },
      },
    };
    const result = extractWorktreeInfo(state);
    assert.equal(result.worktreePath, null);
    assert.equal(result.branch, 'feat/X');
  });
});

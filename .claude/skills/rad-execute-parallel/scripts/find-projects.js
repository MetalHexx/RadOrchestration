'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── Helpers ────────────────────────────────────────────────────────────────

function outputAndExit(result, code) {
  console.log(JSON.stringify(result));
  process.exit(code);
}

function parseArgs(argv) {
  let projectsBasePath = null;
  let repoRoot = null;
  let projectName = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--projects-base-path' && i + 1 < argv.length) {
      projectsBasePath = argv[++i];
    } else if (argv[i] === '--repo-root' && i + 1 < argv.length) {
      repoRoot = argv[++i];
    } else if (argv[i] === '--project-name' && i + 1 < argv.length) {
      projectName = argv[++i];
    }
  }
  return { projectsBasePath, repoRoot, projectName };
}

// ─── Git worktree list ──────────────────────────────────────────────────────

function getActiveWorktrees(repoRoot) {
  const paths = new Set();
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        paths.add(path.resolve(line.slice('worktree '.length).trim()));
      }
    }
  } catch {
    // If worktree list fails, return empty set
  }
  return paths;
}

// ─── Read project state ─────────────────────────────────────────────────────

function readProjectState(projectDir) {
  const statePath = path.join(projectDir, 'state.json');
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function extractMasterPlanPath(state) {
  if (!state || !state.planning || !Array.isArray(state.planning.steps)) return null;
  const step = state.planning.steps.find(s => s.name === 'master_plan' || s.id === 'master_plan');
  return (step && step.doc_path) || null;
}

function extractWorktreeInfo(state) {
  const sc = state && state.pipeline && state.pipeline.source_control;
  if (!sc) return { worktreePath: null, branch: null };
  return {
    worktreePath: sc.worktree_path || null,
    branch: sc.branch || null
  };
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { parseArgs, readProjectState, extractMasterPlanPath, extractWorktreeInfo };

// ─── Main ───────────────────────────────────────────────────────────────────

if (require.main !== module) return;

const { projectsBasePath, repoRoot, projectName } = parseArgs(process.argv);

if (!projectsBasePath || !repoRoot) {
  outputAndExit({
    error: 'missing_args',
    message: '--projects-base-path and --repo-root are required'
  }, 2);
}

if (!fs.existsSync(projectsBasePath)) {
  outputAndExit({
    error: 'path_not_found',
    message: 'Projects base path does not exist: ' + projectsBasePath
  }, 2);
}

const activeWorktrees = getActiveWorktrees(repoRoot);

// Single-project mode: look up one project by name
if (projectName) {
  const projectDir = path.join(projectsBasePath, projectName);
  const state = readProjectState(projectDir);

  if (!state) {
    outputAndExit({ projects: [] }, 0);
  }

  const masterPlanPath = extractMasterPlanPath(state);
  const wt = extractWorktreeInfo(state);
  const worktreeExists = wt.worktreePath
    ? activeWorktrees.has(path.resolve(wt.worktreePath))
    : false;

  outputAndExit({
    projects: [{
      name: projectName,
      masterPlanPath,
      currentTier: state.pipeline && state.pipeline.current_tier || null,
      existingWorktreePath: wt.worktreePath,
      existingBranch: wt.branch,
      worktreeExists
    }]
  }, 0);
}

// Scan mode: find all execution-ready projects
let dirs;
try {
  dirs = fs.readdirSync(projectsBasePath, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name));
} catch (err) {
  outputAndExit({
    error: 'read_failed',
    message: 'Failed to read projects directory: ' + err.message
  }, 2);
}

const projects = [];

for (const dir of dirs) {
  const projectDir = path.join(projectsBasePath, dir.name);
  const state = readProjectState(projectDir);
  if (!state) continue;

  const tier = state.pipeline && state.pipeline.current_tier;
  if (tier !== 'execution') continue;

  const masterPlanPath = extractMasterPlanPath(state);
  const wt = extractWorktreeInfo(state);
  const worktreeExists = wt.worktreePath
    ? activeWorktrees.has(path.resolve(wt.worktreePath))
    : false;

  projects.push({
    name: dir.name,
    masterPlanPath,
    currentTier: tier,
    existingWorktreePath: wt.worktreePath,
    existingBranch: wt.branch,
    worktreeExists
  });
}

outputAndExit({ projects }, 0);

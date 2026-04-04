'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── Helpers ────────────────────────────────────────────────────────────────

function outputAndExit(result, code) {
  console.log(JSON.stringify(result));
  process.exit(code);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/**
 * Extract simple key paths from a YAML file.
 * Only handles flat/nested scalar values — no arrays, anchors, or flow style.
 * Returns a flat map like { 'system.orch_root': '.github', 'projects.base_path': '...' }
 */
function parseSimpleYaml(content) {
  const result = {};
  const stack = []; // { indent, prefix }

  for (const raw of content.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;

    const indent = raw.search(/\S/);
    const trimmed = raw.trim();

    // Pop stack entries at same or deeper indent
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)/);
    if (!match) continue;

    const key = match[1];
    let value = match[2];

    const prefix = stack.length > 0 ? stack[stack.length - 1].prefix + '.' + key : key;

    if (value === '' || value === null) {
      // Section header — push onto stack
      stack.push({ indent, prefix });
    } else {
      // Strip inline comments
      value = value.replace(/\s+#.*$/, '');
      // Strip surrounding quotes
      value = value.replace(/^["'](.*)["']$/, '$1');
      result[prefix] = value;
    }
  }

  return result;
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { parseSimpleYaml };

// ─── Main ───────────────────────────────────────────────────────────────────

if (require.main !== module) return;

let repoRoot;
try {
  repoRoot = git(['rev-parse', '--show-toplevel']);
} catch {
  outputAndExit({
    error: 'not_a_git_repo',
    message: 'Could not detect git repository root. Run from inside a git repo.'
  }, 2);
}

// Normalize to OS path separators
repoRoot = path.resolve(repoRoot);
const repoName = path.basename(repoRoot);
const repoParent = path.dirname(repoRoot);

// Current branch
let currentBranch;
try {
  currentBranch = git(['branch', '--show-current']);
} catch {
  currentBranch = 'HEAD';
}

// Default branch detection
let defaultBranch = 'main';
try {
  const ref = git(['symbolic-ref', 'refs/remotes/origin/HEAD']);
  defaultBranch = ref.split('/').pop();
} catch {
  try {
    const branches = git(['branch', '-r']);
    if (branches.includes('origin/main')) {
      defaultBranch = 'main';
    } else if (branches.includes('origin/master')) {
      defaultBranch = 'master';
    }
  } catch {
    // keep 'main'
  }
}

// Platform
const platformMap = { win32: 'windows', darwin: 'mac' };
const platform = platformMap[process.platform] || 'linux';

// ─── Orchestration config ───────────────────────────────────────────────────

// Discover config via __dirname → skills/execute-parallel/scripts → up to orch root
// Then look for skills/orchestration/config/orchestration.yml
const orchRootGuess = path.resolve(__dirname, '..', '..');  // .github/skills → .github
const configPath = path.join(orchRootGuess, 'skills', 'orchestration', 'config', 'orchestration.yml');

let orchRoot = '.github';
let projectsBasePath = path.join(repoRoot, '.github', 'projects');
let configAutoCommit = 'ask';
let configAutoPr = 'ask';

if (fs.existsSync(configPath)) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const yaml = parseSimpleYaml(content);

    if (yaml['system.orch_root']) {
      orchRoot = yaml['system.orch_root'];
    }
    if (yaml['projects.base_path']) {
      const raw = yaml['projects.base_path'];
      projectsBasePath = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
    }
    if (yaml['source_control.auto_commit']) {
      configAutoCommit = yaml['source_control.auto_commit'];
    }
    if (yaml['source_control.auto_pr']) {
      configAutoPr = yaml['source_control.auto_pr'];
    }
  } catch {
    // Use defaults on parse failure
  }
}

outputAndExit({
  repoRoot,
  repoName,
  repoParent,
  currentBranch,
  defaultBranch,
  platform,
  orchRoot,
  projectsBasePath,
  configAutoCommit,
  configAutoPr
}, 0);

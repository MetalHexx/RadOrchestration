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
 * Convert SSH remote URL to HTTPS, or strip trailing .git from HTTPS URLs.
 * Returns empty string if format is unrecognized.
 */
function deriveRemoteUrl(rawUrl) {
  if (!rawUrl) return '';
  const sshMatch = rawUrl.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) return 'https://github.com/' + sshMatch[1];
  if (rawUrl.startsWith('https://')) return rawUrl.replace(/\.git$/, '');
  return '';
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

/**
 * Returns true when the parsed state object has a fully populated
 * `pipeline.source_control` with the auto fields set. Any other shape —
 * missing, null, wrong type, array, or missing auto fields — returns false,
 * letting callers treat the project as "needs initialization."
 */
function isSourceControlInitialized(state) {
  const sc = state && state.pipeline && state.pipeline.source_control;
  return !!sc && typeof sc === 'object' && !Array.isArray(sc) &&
    typeof sc.auto_commit === 'string' && sc.auto_commit !== '' &&
    typeof sc.auto_pr === 'string' && sc.auto_pr !== '';
}

function parseArgs(argv) {
  let projectName = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--project-name' && i + 1 < argv.length) {
      projectName = argv[++i];
    }
  }
  return { projectName };
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { parseSimpleYaml, deriveRemoteUrl, isSourceControlInitialized, parseArgs };

// ─── Main ───────────────────────────────────────────────────────────────────

if (require.main !== module) return;

const { projectName } = parseArgs(process.argv);

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

// Current branch — `git branch --show-current` returns "" (not an error)
// in detached HEAD state, so coalesce empty string to "HEAD" too.
let currentBranch;
try {
  currentBranch = git(['branch', '--show-current']) || 'HEAD';
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

// Discover config via __dirname → skills/rad-execute/scripts → up to orch root
// Then look for skills/orchestration/config/orchestration.yml
const orchRootGuess = path.resolve(__dirname, '..', '..', '..');  // scripts → rad-execute → skills → .claude
const configPath = path.join(orchRootGuess, 'skills', 'orchestration', 'config', 'orchestration.yml');

let orchRoot = '.claude';
let configAutoCommit = 'ask';
let configAutoPr = 'ask';
let _explicitProjectsBasePath = null;

if (fs.existsSync(configPath)) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const yaml = parseSimpleYaml(content);

    if (yaml['system.orch_root']) {
      orchRoot = yaml['system.orch_root'];
    }
    if (yaml['projects.base_path']) {
      const raw = yaml['projects.base_path'];
      _explicitProjectsBasePath = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
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

// Default derives from orchRoot so a custom orch_root without an explicit
// projects.base_path still resolves to the right location.
const projectsBasePath = _explicitProjectsBasePath ?? path.join(repoRoot, orchRoot, 'projects');

// ─── Remote URL ─────────────────────────────────────────────────────────────

let remoteUrl = '';
try {
  const raw = git(['remote', 'get-url', 'origin']);
  remoteUrl = deriveRemoteUrl(raw);
} catch {
  // no remote configured or git error — keep remoteUrl = ''
}

// ─── State.json peek (optional, only when --project-name is passed) ─────────

let projectDir = null;
let sourceControlInitialized = null; // null = not checked (no --project-name)

if (projectName) {
  projectDir = path.join(projectsBasePath, projectName);
  const stateJsonPath = path.join(projectDir, 'state.json');
  if (fs.existsSync(stateJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(stateJsonPath, 'utf8'));
      sourceControlInitialized = isSourceControlInitialized(parsed);
    } catch {
      // unparseable state → treat as uninitialized; pipeline will surface the real error downstream
      sourceControlInitialized = false;
    }
  } else {
    sourceControlInitialized = false;
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
  configAutoPr,
  remoteUrl,
  projectDir,
  sourceControlInitialized
}, 0);

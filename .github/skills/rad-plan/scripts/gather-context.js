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

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)/);
    if (!match) continue;

    const key = match[1];
    let value = match[2];

    const prefix = stack.length > 0 ? stack[stack.length - 1].prefix + '.' + key : key;

    if (value === '' || value === null) {
      stack.push({ indent, prefix });
    } else {
      value = value.replace(/\s+#.*$/, '');
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

repoRoot = path.resolve(repoRoot);

// Discover config: __dirname → scripts → rad-plan → skills → .github
const orchRootGuess = path.resolve(__dirname, '..', '..', '..');
const configPath = path.join(orchRootGuess, 'skills', 'orchestration', 'config', 'orchestration.yml');

let orchRoot = '.github';
let projectsBasePath = path.join(repoRoot, '.github', 'projects');

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
  } catch {
    // Use defaults on parse failure
  }
}

outputAndExit({ repoRoot, orchRoot, projectsBasePath }, 0);

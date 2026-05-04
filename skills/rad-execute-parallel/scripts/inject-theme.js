'use strict';

const fs = require('fs');
const path = require('path');

// ─── Theme list ──────────────────────────────────────────────────────────────

const THEMES = [
  'Abyss',
  'Kimbie Dark',
  'Monokai',
  'Monokai Dimmed',
  'Red',
  'Solarized Dark',
  'Tomorrow Night Blue',
  'Default Dark Modern',
  'Quiet Light',
  'Solarized Light',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function outputAndExit(result, code) {
  console.log(JSON.stringify(result));
  process.exit(code);
}

function parseArgs(argv) {
  let worktreePath = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--worktree-path' && i + 1 < argv.length) {
      worktreePath = argv[++i];
    }
  }
  return { worktreePath };
}

function pickTheme(themes) {
  return themes[Math.floor(Math.random() * themes.length)];
}

/**
 * Merge workbench.colorTheme into .vscode/settings.json, preserving existing keys.
 * Creates the file (and .vscode/ dir) if they do not exist.
 * Returns the absolute path written.
 */
function writeSettings(worktreePath, theme) {
  const vsDir = path.join(worktreePath, '.vscode');
  fs.mkdirSync(vsDir, { recursive: true });
  const settingsPath = path.join(vsDir, 'settings.json');
  let existing = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      // Unparseable — start fresh rather than corrupt the file further
      existing = {};
    }
  }
  existing['workbench.colorTheme'] = theme;
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return settingsPath;
}

/**
 * Append .vscode/settings.json to .gitignore if not already present.
 * Creates .gitignore if it does not exist.
 * Returns the absolute path of the .gitignore file.
 */
function ensureGitignore(worktreePath) {
  const giPath = path.join(worktreePath, '.gitignore');
  const entry = '.vscode/settings.json';
  let existing = '';
  if (fs.existsSync(giPath)) {
    existing = fs.readFileSync(giPath, 'utf8');
  }
  const lines = existing.split(/\r?\n/).map(l => l.trim());
  if (!lines.includes(entry)) {
    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(giPath, prefix + entry + '\n', 'utf8');
  }
  return giPath;
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { parseArgs, pickTheme, writeSettings, ensureGitignore, THEMES };

// ─── Main ────────────────────────────────────────────────────────────────────

if (require.main !== module) return;

const { worktreePath } = parseArgs(process.argv);

if (!worktreePath) {
  outputAndExit({
    theme: null,
    settingsPath: null,
    gitignorePath: null,
    error: 'Missing required argument: --worktree-path',
  }, 2);
}

try {
  const theme = pickTheme(THEMES);
  const settingsPath = writeSettings(worktreePath, theme);
  const gitignorePath = ensureGitignore(worktreePath);
  outputAndExit({ theme, settingsPath, gitignorePath, error: null }, 0);
} catch (err) {
  outputAndExit({ theme: null, settingsPath: null, gitignorePath: null, error: err.message }, 2);
}

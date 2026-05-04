// installer/lib/cli.js — CLI argument parser

import path from 'node:path';

/**
 * @typedef {Object} ParsedCli
 * @property {'help'|'version'|'run'|'uninstall'} command - The resolved command
 * @property {Partial<import('./types.js').CliOptions>} options - Parsed key-value options
 */

/** Map of --flag → config field name */
const FLAG_MAP = {
  '--workspace':      'workspaceDir',
  '--tool':           'tool',
  '--orch-root':      'orchRoot',
  '--projects-path':  'projectsBasePath',
  '--naming':         'projectsNaming',
  '--max-phases':     'maxPhases',
  '--max-tasks':      'maxTasksPerPhase',
  '--max-retries':    'maxRetriesPerTask',
  '--max-rejections': 'maxConsecutiveReviewRejections',
  '--execution-mode': 'executionMode',
  '--auto-commit':    'autoCommit',
  '--auto-pr':        'autoPr',
  '--dashboard-dir':  'uiDir',
};

/** Fields that must be parsed as integers */
const INT_FIELDS = new Set([
  'maxPhases', 'maxTasksPerPhase', 'maxRetriesPerTask', 'maxConsecutiveReviewRejections',
]);

/** Valid values for enum-type fields */
const ENUM_VALUES = {
  // `cursor` is intentionally omitted: it appears as a disabled "Coming
  // soon" choice in the interactive prompt, but no manifest backs it, so
  // accepting it on the CLI would crash deep in getManifest().
  tool:            ['claude-code', 'copilot-vscode', 'copilot-cli'],
  projectsNaming:  ['SCREAMING_CASE', 'lowercase', 'numbered'],
  executionMode:   ['ask', 'phase', 'task', 'autonomous'],
  autoCommit:      ['always', 'ask', 'never'],
  autoPr:          ['always', 'ask', 'never'],
};

/**
 * Parses a process.argv-style array into a structured command + options object.
 * Does NOT perform side effects — pure function.
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {ParsedCli}
 */
export function parseArgs(argv) {
  // Early-exit commands
  if (argv.includes('--help') || argv.includes('-h')) {
    return { command: 'help', options: {} };
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    return { command: 'version', options: {} };
  }
  // Positional subcommand — must be the first non-flag argument.
  let isUninstall = false;
  if (argv[0] === 'uninstall') {
    isUninstall = true;
    argv = argv.slice(1);
  }

  /** @type {Partial<import('./types.js').CliOptions>} */
  const options = {};

  // Boolean flags
  if (argv.includes('--yes') || argv.includes('-y')) {
    options.skipConfirmation = true;
  }
  if (argv.includes('--overwrite') || argv.includes('--force')) {
    options.overwrite = true;
  }
  if (argv.includes('--no-dashboard')) {
    options.installUi = false;
  }
  if (argv.includes('--dashboard')) {
    options.installUi = true;
  }

  // Key-value flags
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const field = FLAG_MAP[flag];
    if (field && i + 1 < argv.length) {
      const raw = argv[i + 1];
      options[field] = INT_FIELDS.has(field) ? parseInt(raw, 10) : raw;
      i++; // skip consumed value
    }
  }

  // Resolve workspace to absolute path
  if (options.workspaceDir) {
    options.workspaceDir = path.resolve(options.workspaceDir);
  }

  // --dashboard-dir implies installUi
  if (options.uiDir !== undefined && options.installUi === undefined) {
    options.installUi = true;
  }

  // Resolve uiDir to absolute path
  if (options.uiDir) {
    options.uiDir = path.resolve(options.uiDir);
  }

  // Validate enum values
  for (const [field, allowed] of Object.entries(ENUM_VALUES)) {
    if (options[field] !== undefined && !allowed.includes(options[field])) {
      throw new Error(
        `Invalid value "${options[field]}" for --${fieldToFlag(field)}. ` +
        `Allowed: ${allowed.join(', ')}`
      );
    }
  }

  // Validate integer fields
  for (const field of INT_FIELDS) {
    if (options[field] !== undefined && (!Number.isInteger(options[field]) || options[field] < 0)) {
      throw new Error(
        `Invalid value for --${fieldToFlag(field)}. Must be a non-negative integer.`
      );
    }
  }

  return { command: isUninstall ? 'uninstall' : 'run', options };
}

/**
 * Converts a camelCase field name back to --kebab-flag for error messages.
 * @param {string} field
 * @returns {string}
 */
function fieldToFlag(field) {
  for (const [flag, f] of Object.entries(FLAG_MAP)) {
    if (f === field) return flag.slice(2); // strip leading --
  }
  return field;
}

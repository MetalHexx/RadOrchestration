// installer/lib/cli.js — CLI argument parser

/**
 * @typedef {Object} ParsedCli
 * @property {'help'|'version'|'run'|'uninstall'} command - The resolved command
 * @property {Partial<import('./types.js').CliOptions>} options - Parsed key-value options
 */

/** Map of --flag → config field name */
const FLAG_MAP = {
  // Active flags — used by the rewritten wizard.
  '--harness':           'harnesses',        // comma-list parsed into a string[]
  '--default-template':  'defaultTemplate',
  '--max-phases':        'maxPhases',
  '--max-tasks':         'maxTasksPerPhase',
  '--max-retries':       'maxRetriesPerTask',
  '--max-rejections':    'maxConsecutiveReviewRejections',
  '--after-planning':    'afterPlanning',
  '--execution-mode':    'executionMode',
  '--after-final-review': 'afterFinalReview',
  '--auto-commit':       'autoCommit',
  '--auto-pr':           'autoPr',
};

/** Fields that must be parsed as integers */
const INT_FIELDS = new Set([
  'maxPhases', 'maxTasksPerPhase', 'maxRetriesPerTask', 'maxConsecutiveReviewRejections',
]);

/** Valid values for enum-type fields */
const ENUM_VALUES = {
  defaultTemplate: ['extra-high', 'high', 'medium', 'low', 'ask'],
  executionMode:   ['ask', 'phase', 'task', 'autonomous'],
  autoCommit:      ['always', 'ask', 'never'],
  autoPr:          ['always', 'ask', 'never'],
};

/** Valid harness names (each value of the comma-list passed to --harness). */
const HARNESS_NAMES = new Set(['claude', 'copilot-vscode', 'copilot-cli']);

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

  // Key-value flags
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const field = FLAG_MAP[flag];
    if (field && i + 1 < argv.length) {
      const raw = argv[i + 1];
      if (field === 'harnesses') {
        // --harness accepts a comma-separated list: --harness claude,copilot-vscode
        const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          if (!HARNESS_NAMES.has(p)) {
            throw new Error(
              `Invalid harness '${p}' for --harness. Allowed: claude, copilot-vscode, copilot-cli`,
            );
          }
        }
        options.harnesses = parts;
      } else if (field === 'afterPlanning' || field === 'afterFinalReview') {
        // Boolean-via-string flag.
        const lower = raw.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') options[field] = true;
        else if (lower === 'false' || lower === '0' || lower === 'no') options[field] = false;
        else throw new Error(`Invalid value '${raw}' for --${fieldToFlag(field)}. Expected true|false.`);
      } else {
        options[field] = INT_FIELDS.has(field) ? parseInt(raw, 10) : raw;
      }
      i++; // skip consumed value
    }
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

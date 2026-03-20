'use strict';

// ─── ANSI Color Token Maps ────────────────────────────────────────────────────

const COLOR_TOKENS = {
  pass: '\x1b[32m',
  fail: '\x1b[31m',
  warn: '\x1b[33m',
  categoryHeader: '\x1b[1;36m',
  boldWhite: '\x1b[1;37m',
  boldRed: '\x1b[1;31m',
  boldGreen: '\x1b[1;32m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

const NO_COLOR_TOKENS = {
  pass: '',
  fail: '',
  warn: '',
  categoryHeader: '',
  boldWhite: '',
  boldRed: '',
  boldGreen: '',
  dim: '',
  reset: '',
};

// ─── Marker Maps ──────────────────────────────────────────────────────────────

const COLOR_MARKERS = {
  pass: '\u2713',   // ✓
  fail: '\u2717',   // ✗
  warn: '\u26A0',   // ⚠
};

const NO_COLOR_MARKERS = {
  pass: '[PASS]',
  fail: '[FAIL]',
  warn: '[WARN]',
};

// ─── Separator Maps ───────────────────────────────────────────────────────────

const COLOR_SEPARATORS = {
  double: '\u2550',     // ═
  topLeft: '\u250C',    // ┌
  bottomLeft: '\u2514', // └
  vertical: '\u2502',   // │
  horizontal: '\u2500', // ─
  pipe: '\u2502',       // │
};

const NO_COLOR_SEPARATORS = {
  double: '=',
  topLeft: '---',
  bottomLeft: '---',
  vertical: ' ',
  horizontal: '-',
  pipe: '|',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SEPARATOR_WIDTH = 50;
const HEADER_TEXT = 'Orchestration Validator v1.0.0';

const CATEGORY_DISPLAY_NAMES = {
  'structure': 'File Structure',
  'agents': 'Agents',
  'skills': 'Skills',
  'config': 'Configuration',
  'instructions': 'Instructions',
  'prompts': 'Prompts',
  'cross-references': 'Cross-References',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function write(text) {
  try {
    process.stdout.write(text);
  } catch (_) {
    // degrade gracefully
  }
}

function writeln(text) {
  write((text || '') + '\n');
}

function repeatChar(ch, count) {
  if (count < 1) return '';
  return ch.repeat(count);
}

/**
 * Group an array by a key function, preserving order of first appearance.
 */
function groupByOrdered(arr, keyFn) {
  const groups = [];
  const seen = {};
  for (let i = 0; i < arr.length; i++) {
    const key = keyFn(arr[i]);
    if (!(key in seen)) {
      seen[key] = groups.length;
      groups.push({ key, items: [] });
    }
    groups[seen[key]].items.push(arr[i]);
  }
  return groups;
}

function countByStatus(items) {
  let passed = 0, failed = 0, warnings = 0;
  for (let i = 0; i < items.length; i++) {
    const s = items[i].status;
    if (s === 'pass') passed++;
    else if (s === 'fail') failed++;
    else if (s === 'warn') warnings++;
  }
  return { passed, failed, warnings };
}

// ─── Region Renderers ─────────────────────────────────────────────────────────

function renderHeader(t, sep) {
  writeln(t.boldWhite + HEADER_TEXT + t.reset);
  writeln(t.dim + repeatChar(sep.double, SEPARATOR_WIDTH) + t.reset);
}

function renderCategoryBlock(category, items, t, m, sep, verbose) {
  const noColor = (t.reset === '');
  const displayName = CATEGORY_DISPLAY_NAMES[category] || category;

  // Category header
  if (noColor) {
    writeln(sep.topLeft + ' ' + displayName + ' ' + sep.topLeft.replace(/^---$/, '---'));
    // no-color header: "--- DisplayName ---"
  } else {
    const prefix = sep.topLeft + sep.horizontal + ' ';
    const suffix = ' ';
    const nameLen = prefix.length + displayName.length + suffix.length;
    const remaining = SEPARATOR_WIDTH - nameLen;
    const fill = remaining > 0 ? repeatChar(sep.horizontal, remaining) : '';
    writeln(t.dim + prefix + t.reset + t.categoryHeader + displayName + t.reset + t.dim + suffix + fill + t.reset);
  }

  // Check lines
  for (let i = 0; i < items.length; i++) {
    const r = items[i];
    const statusColor = t[r.status] || '';
    const marker = m[r.status] || r.status;

    if (noColor) {
      writeln('  ' + marker + ' ' + r.name + ' \u2014 ' + r.message);
    } else {
      writeln(t.dim + sep.vertical + t.reset + '  ' + statusColor + marker + t.reset + ' ' + r.name + ' \u2014 ' + r.message);
    }

    // Detail blocks
    const showDetail = r.detail && (r.status === 'fail' || verbose);
    if (showDetail) {
      const indent = noColor ? '      ' : (t.dim + sep.vertical + t.reset + '      ');
      if (r.detail.expected !== undefined) {
        writeln(indent + 'Expected: ' + r.detail.expected);
      }
      if (r.detail.found !== undefined) {
        writeln(indent + 'Found: ' + r.detail.found);
      }
      if (r.detail.context !== undefined) {
        writeln(indent + r.detail.context);
      }
    }
  }

  // Blank line before category summary
  if (noColor) {
    writeln(sep.vertical);
  } else {
    writeln(t.dim + sep.vertical + t.reset);
  }

  // Category summary
  const counts = countByStatus(items);
  let contextColor;
  if (counts.failed > 0) {
    contextColor = t.fail;
  } else if (counts.warnings > 0) {
    contextColor = t.warn;
  } else {
    contextColor = t.pass;
  }

  const warningLabel = counts.warnings === 1 ? 'warning' : 'warnings';
  const summaryText = displayName + ': ' + counts.passed + ' passed, ' + counts.failed + ' failed, ' + counts.warnings + ' ' + warningLabel;

  if (noColor) {
    writeln('  ' + summaryText);
  } else {
    writeln(t.dim + sep.vertical + t.reset + '  ' + contextColor + summaryText + t.reset);
  }

  // Category footer
  if (noColor) {
    writeln(sep.bottomLeft);
  } else {
    writeln(t.dim + sep.bottomLeft + repeatChar(sep.horizontal, SEPARATOR_WIDTH) + t.reset);
  }
}

function renderSummaryBar(results, t, sep) {
  const noColor = (t.reset === '');
  const counts = countByStatus(results);
  const hasFails = counts.failed > 0;

  const borderLine = noColor
    ? repeatChar(sep.double, SEPARATOR_WIDTH)
    : t.dim + repeatChar(sep.double, SEPARATOR_WIDTH) + t.reset;

  const verdict = hasFails
    ? t.boldRed + 'FAIL' + t.reset
    : t.boldGreen + 'PASS' + t.reset;

  const warningLabel = counts.warnings === 1 ? 'warning' : 'warnings';

  const summaryLine = '  RESULT: ' + verdict + '  ' + sep.pipe + '  '
    + t.pass + counts.passed + ' passed' + t.reset + '  '
    + t.fail + counts.failed + ' failed' + t.reset + '  '
    + t.warn + counts.warnings + ' ' + warningLabel + t.reset;

  writeln(borderLine);
  writeln(summaryLine);
  writeln(borderLine);
}

// ─── Main Exports ─────────────────────────────────────────────────────────────

/**
 * Render CheckResult[] to stdout.
 * @param {Array} results - Array of CheckResult objects
 * @param {Object} options - ReporterOptions { noColor, verbose, quiet }
 */
function report(results, options) {
  try {
    const safeResults = Array.isArray(results) ? results : [];
    const opts = options && typeof options === 'object' ? options : {};
    const noColor = !!opts.noColor;
    const verbose = !!opts.verbose;
    const quiet = !!opts.quiet;

    const t = noColor ? NO_COLOR_TOKENS : COLOR_TOKENS;
    const m = noColor ? NO_COLOR_MARKERS : COLOR_MARKERS;
    const sep = noColor ? NO_COLOR_SEPARATORS : COLOR_SEPARATORS;

    // Quiet mode: only summary bar (quiet overrides verbose)
    if (quiet) {
      renderSummaryBar(safeResults, t, sep);
      return;
    }

    // Region 1: Header
    renderHeader(t, sep);

    // Region 2: Category blocks
    const groups = groupByOrdered(safeResults, function (r) { return r.category || 'unknown'; });
    for (let g = 0; g < groups.length; g++) {
      if (g > 0) {
        writeln(''); // blank line between categories
      }
      renderCategoryBlock(groups[g].key, groups[g].items, t, m, sep, verbose);
    }

    // Blank line before summary
    writeln('');

    // Region 3: Summary bar
    renderSummaryBar(safeResults, t, sep);
  } catch (_) {
    // degrade gracefully — attempt raw output
    try {
      const total = Array.isArray(results) ? results.length : 0;
      const fails = Array.isArray(results) ? results.filter(function (r) { return r.status === 'fail'; }).length : 0;
      writeln('RESULT: ' + (fails > 0 ? 'FAIL' : 'PASS') + ' | ' + total + ' checks, ' + fails + ' failed');
    } catch (_inner) {
      // nothing more we can do
    }
  }
}

/**
 * Print the --help usage text to stdout.
 * @param {string} [orchRoot='.github'] - Orchestration root folder name
 */
function printHelp(orchRoot) {
  try {
    const root = orchRoot || '.github';
    const helpText = [
      'Orchestration Validator v1.0.0',
      '',
      `Usage: node ${root}/skills/orchestration/scripts/validate/validate-orchestration.js [options]`,
      '',
      'Options:',
      '  -h, --help              Show this help message and exit',
      '  -v, --verbose           Show detailed context for every check',
      '  -q, --quiet             Show only the final summary line',
      '  -c, --category <name>   Run only the named category',
      '      --no-color          Suppress ANSI color codes',
      '',
      'Categories:',
      `  structure        ${root}/ directory structure and required files`,
      '  agents           Agent file frontmatter, tools, and body conventions',
      '  skills           Skill directory structure, SKILL.md frontmatter',
      '  config           orchestration.yml field presence and value validation',
      '  instructions     Instruction file frontmatter and applyTo patterns',
      '  prompts          Prompt file frontmatter and tools validation',
      '  cross-references Agent\u2192skill, skill\u2192template, and config\u2192path resolution',
      '',
      'Environment:',
      '  NO_COLOR=1       Equivalent to --no-color',
      '',
      'Examples:',
      `  node ${root}/skills/orchestration/scripts/validate/validate-orchestration.js                  Run all checks`,
      `  node ${root}/skills/orchestration/scripts/validate/validate-orchestration.js --category agents  Check agents only`,
      `  node ${root}/skills/orchestration/scripts/validate/validate-orchestration.js --verbose          Detailed output`,
      `  node ${root}/skills/orchestration/scripts/validate/validate-orchestration.js --quiet            Summary only`,
      `  node ${root}/skills/orchestration/scripts/validate/validate-orchestration.js --no-color         CI-friendly output`,
    ].join('\n') + '\n';

    write(helpText);
  } catch (_) {
    // degrade gracefully
  }
}

module.exports = { report, printHelp };

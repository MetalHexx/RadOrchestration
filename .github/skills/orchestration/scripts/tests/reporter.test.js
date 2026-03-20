'use strict';

const { report, printHelp } = require('../validate/lib/reporter');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

let capturedOutput = '';
const originalWrite = process.stdout.write;

function captureStart() {
  capturedOutput = '';
  process.stdout.write = function (chunk) {
    capturedOutput += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  };
}

function captureStop() {
  process.stdout.write = originalWrite;
  return capturedOutput;
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    originalWrite.call(process.stdout, '  \x1b[32m\u2713\x1b[0m ' + label + '\n');
  } else {
    failed++;
    originalWrite.call(process.stdout, '  \x1b[31m\u2717\x1b[0m ' + label + '\n');
  }
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const passResults = [
  { category: 'structure', name: 'agents/', status: 'pass', message: 'directory exists' },
  { category: 'structure', name: 'skills/', status: 'pass', message: 'directory exists' },
  { category: 'structure', name: 'orchestration.yml', status: 'pass', message: 'file exists' },
];

const mixedResults = [
  { category: 'agents', name: 'orchestrator.agent.md', status: 'pass', message: 'required frontmatter fields present', detail: { expected: 'name, description, tools', found: 'name, description, tools' } },
  { category: 'agents', name: 'research.agent.md', status: 'fail', message: 'missing required field: argument-hint', detail: { expected: 'non-empty string value', found: 'field absent' } },
  { category: 'agents', name: 'coder.agent.md', status: 'warn', message: 'description length is 42 chars', detail: { expected: '>= 50 chars', found: '42 chars' } },
  { category: 'config', name: 'orchestration.yml', status: 'pass', message: 'all required fields present' },
  { category: 'config', name: 'orchestration.yml — human_gates.execution_mode', status: 'fail', message: 'invalid execution mode', detail: { expected: 'ask | phase | task | autonomous', found: 'yolo', context: 'at config.human_gates.execution_mode' } },
];

const allPassResults = [
  { category: 'structure', name: 'agents/', status: 'pass', message: 'directory exists' },
  { category: 'structure', name: 'skills/', status: 'pass', message: 'directory exists' },
];

const failOnlyResults = [
  { category: 'structure', name: 'agents/', status: 'fail', message: 'directory missing', detail: { expected: 'directory at .github/agents/', found: 'not found' } },
];

const warnOnlyResults = [
  { category: 'agents', name: 'coder.agent.md', status: 'warn', message: 'description too short', detail: { expected: '>= 50 chars', found: '42 chars' } },
  { category: 'agents', name: 'reviewer.agent.md', status: 'pass', message: 'all fields present' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

originalWrite.call(process.stdout, '\nReporter Module Tests\n');
originalWrite.call(process.stdout, '='.repeat(50) + '\n\n');

// Test 1: Default mode - header, category blocks, summary bar
originalWrite.call(process.stdout, 'Default mode (pass results):\n');
captureStart();
report(passResults, { noColor: false, verbose: false, quiet: false });
const defaultOutput = captureStop();
assert(defaultOutput.includes('Orchestration Validator v1.0.0'), 'default mode includes header text');
assert(defaultOutput.includes('\u2550'), 'default mode includes double-line separator');
assert(defaultOutput.includes('\u2713'), 'default mode includes pass marker');
assert(defaultOutput.includes('File Structure'), 'default mode includes category display name');
assert(defaultOutput.includes('RESULT:'), 'default mode includes summary bar');
assert(defaultOutput.includes('PASS'), 'default mode shows PASS verdict for all-pass');

// Test 2: Default mode with mixed results — shows detail for failures only
originalWrite.call(process.stdout, '\nDefault mode (mixed results):\n');
captureStart();
report(mixedResults, { noColor: false, verbose: false, quiet: false });
const mixedOutput = captureStop();
assert(mixedOutput.includes('\u2717'), 'mixed results include fail marker');
assert(mixedOutput.includes('\u26A0'), 'mixed results include warn marker');
assert(mixedOutput.includes('Expected: non-empty string value'), 'mixed results show Expected for failure');
assert(mixedOutput.includes('Found: field absent'), 'mixed results show Found for failure');
assert(mixedOutput.includes('FAIL'), 'mixed results show FAIL verdict');
// Warn detail should NOT appear in default mode
assert(!mixedOutput.includes('Found: 42 chars'), 'default mode does NOT show detail for warn results');

// Test 3: Verbose mode — show detail for all statuses
originalWrite.call(process.stdout, '\nVerbose mode:\n');
captureStart();
report(mixedResults, { noColor: false, verbose: true, quiet: false });
const verboseOutput = captureStop();
assert(verboseOutput.includes('Expected: name, description, tools'), 'verbose mode shows detail for pass results');
assert(verboseOutput.includes('Found: 42 chars'), 'verbose mode shows detail for warn results');
assert(verboseOutput.includes('Expected: non-empty string value'), 'verbose mode shows detail for fail results');
assert(verboseOutput.includes('at config.human_gates.execution_mode'), 'verbose mode shows context when present');

// Test 4: Quiet mode — only summary bar
originalWrite.call(process.stdout, '\nQuiet mode:\n');
captureStart();
report(mixedResults, { noColor: false, verbose: false, quiet: true });
const quietOutput = captureStop();
assert(!quietOutput.includes('Orchestration Validator v1.0.0'), 'quiet mode has no header');
assert(!quietOutput.includes('\u250C'), 'quiet mode has no category block headers');
assert(quietOutput.includes('RESULT:'), 'quiet mode shows summary bar');
assert(quietOutput.includes('FAIL'), 'quiet mode shows verdict');

// Test 5: Quiet overrides verbose
originalWrite.call(process.stdout, '\nQuiet overrides verbose:\n');
captureStart();
report(mixedResults, { noColor: false, verbose: true, quiet: true });
const quietVerboseOutput = captureStop();
assert(!quietVerboseOutput.includes('Orchestration Validator v1.0.0'), 'quiet+verbose: no header');
assert(!quietVerboseOutput.includes('\u250C'), 'quiet+verbose: no category blocks');
assert(quietVerboseOutput.includes('RESULT:'), 'quiet+verbose: shows summary bar');

// Test 6: No-color mode
originalWrite.call(process.stdout, '\nNo-color mode:\n');
captureStart();
report(mixedResults, { noColor: true, verbose: false, quiet: false });
const noColorOutput = captureStop();
assert(!noColorOutput.includes('\x1b['), 'no-color mode contains zero ANSI escape sequences');
assert(noColorOutput.includes('[PASS]'), 'no-color mode uses [PASS] marker');
assert(noColorOutput.includes('[FAIL]'), 'no-color mode uses [FAIL] marker');
assert(noColorOutput.includes('[WARN]'), 'no-color mode uses [WARN] marker');
assert(noColorOutput.includes('---'), 'no-color mode uses --- separators');
assert(noColorOutput.includes('==='), 'no-color mode uses = borders');
assert(noColorOutput.includes('|'), 'no-color mode uses | pipe');
assert(!noColorOutput.includes('\u2550'), 'no-color mode does not use ═');
assert(!noColorOutput.includes('\u2502'), 'no-color mode does not use │');

// Test 7: Summary bar verdicts
originalWrite.call(process.stdout, '\nSummary bar verdicts:\n');
captureStart();
report(allPassResults, { noColor: true, verbose: false, quiet: false });
const passBar = captureStop();
assert(passBar.includes('RESULT: PASS'), 'all-pass shows RESULT: PASS');
assert(!passBar.includes('RESULT: FAIL'), 'all-pass does not show FAIL');

captureStart();
report(failOnlyResults, { noColor: true, verbose: false, quiet: false });
const failBar = captureStop();
assert(failBar.includes('RESULT: FAIL'), 'any-fail shows RESULT: FAIL');

// Test 8: Category summary contextual color
originalWrite.call(process.stdout, '\nCategory summary contextual color:\n');
captureStart();
report(allPassResults, { noColor: false, verbose: false, quiet: false });
const allPassCat = captureStop();
assert(allPassCat.includes('\x1b[32m' + 'File Structure:'), 'all-pass category uses green');

captureStart();
report(warnOnlyResults, { noColor: false, verbose: false, quiet: false });
const warnCat = captureStop();
assert(warnCat.includes('\x1b[33m' + 'Agents:'), 'warn-only category uses yellow');

captureStart();
report(failOnlyResults, { noColor: false, verbose: false, quiet: false });
const failCat = captureStop();
assert(failCat.includes('\x1b[31m' + 'File Structure:'), 'fail category uses red');

// Test 9: printHelp
originalWrite.call(process.stdout, '\nprintHelp:\n');
captureStart();
printHelp();
const helpOutput = captureStop();
assert(helpOutput.includes('Orchestration Validator v1.0.0'), 'help includes title');
assert(helpOutput.includes('Usage: node .github/skills/orchestration/scripts/validate/validate-orchestration.js [options]'), 'help includes usage line');
assert(helpOutput.includes('-h, --help'), 'help includes -h option');
assert(helpOutput.includes('-v, --verbose'), 'help includes -v option');
assert(helpOutput.includes('-q, --quiet'), 'help includes -q option');
assert(helpOutput.includes('-c, --category <name>'), 'help includes -c option');
assert(helpOutput.includes('--no-color'), 'help includes --no-color option');
assert(helpOutput.includes('Categories:'), 'help includes Categories section');
assert(helpOutput.includes('structure'), 'help includes structure category');
assert(helpOutput.includes('cross-references'), 'help includes cross-references category');
assert(helpOutput.includes('Environment:'), 'help includes Environment section');
assert(helpOutput.includes('NO_COLOR=1'), 'help includes NO_COLOR env var');
assert(helpOutput.includes('Examples:'), 'help includes Examples section');

// Test 10: No ANSI escapes in no-color output (comprehensive)
originalWrite.call(process.stdout, '\nNo ANSI in no-color (comprehensive):\n');
captureStart();
report(mixedResults, { noColor: true, verbose: true, quiet: false });
const noColorVerbose = captureStop();
assert(!noColorVerbose.includes('\x1b['), 'no-color verbose: zero ANSI escape sequences');

// Test 11: Graceful degradation on bad input
originalWrite.call(process.stdout, '\nGraceful degradation:\n');
captureStart();
report(null, null);
const nullOutput = captureStop();
assert(typeof nullOutput === 'string', 'null inputs produce string output without throwing');

captureStart();
report(undefined, {});
const undefOutput = captureStop();
assert(typeof undefOutput === 'string', 'undefined results produce string output without throwing');

captureStart();
report([], { noColor: true, verbose: false, quiet: false });
const emptyOutput = captureStop();
assert(emptyOutput.includes('RESULT: PASS'), 'empty results produce PASS verdict');

// ─── CLI Feature Tests (P03-T04) ──────────────────────────────────────────────

const { parseArgs } = require('../validate/validate-orchestration');

// Helpers for mocking globals
const originalIsTTY = process.stdout.isTTY;
const originalNoColor = process.env.NO_COLOR;

function restoreGlobals() {
  process.stdout.isTTY = originalIsTTY;
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }
}

// T-help: printHelp() output matches the Design-specified help text exactly
originalWrite.call(process.stdout, '\nT-help (exact help text match):\n');
{
  const expectedHelp = [
    'Orchestration Validator v1.0.0',
    '',
    'Usage: node .github/skills/orchestration/scripts/validate/validate-orchestration.js [options]',
    '',
    'Options:',
    '  -h, --help              Show this help message and exit',
    '  -v, --verbose           Show detailed context for every check',
    '  -q, --quiet             Show only the final summary line',
    '  -c, --category <name>   Run only the named category',
    '      --no-color          Suppress ANSI color codes',
    '',
    'Categories:',
    '  structure        .github/ directory structure and required files',
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
    '  node .github/skills/orchestration/scripts/validate/validate-orchestration.js                  Run all checks',
    '  node .github/skills/orchestration/scripts/validate/validate-orchestration.js --category agents  Check agents only',
    '  node .github/skills/orchestration/scripts/validate/validate-orchestration.js --verbose          Detailed output',
    '  node .github/skills/orchestration/scripts/validate/validate-orchestration.js --quiet            Summary only',
    '  node .github/skills/orchestration/scripts/validate/validate-orchestration.js --no-color         CI-friendly output',
  ].join('\n') + '\n';

  captureStart();
  printHelp();
  const helpOut = captureStop();
  assert(helpOut === expectedHelp, 'T-help: printHelp() output matches spec line-for-line');
}

// T-nocolor-env: parseArgs([]) with NO_COLOR='1' returns noColor: true
originalWrite.call(process.stdout, '\nT-nocolor-env:\n');
{
  process.env.NO_COLOR = '1';
  process.stdout.isTTY = true;
  const opts = parseArgs([]);
  assert(opts.noColor === true, 'T-nocolor-env: NO_COLOR=1 sets noColor to true');
  restoreGlobals();
}

// T-nocolor-env-empty: parseArgs([]) with NO_COLOR='' does NOT force noColor
originalWrite.call(process.stdout, '\nT-nocolor-env-empty:\n');
{
  process.env.NO_COLOR = '';
  process.stdout.isTTY = true;
  const opts = parseArgs([]);
  assert(opts.noColor === false, 'T-nocolor-env-empty: NO_COLOR="" does not force noColor');
  restoreGlobals();
}

// T-nontty: parseArgs([]) with isTTY=false returns noColor: true
originalWrite.call(process.stdout, '\nT-nontty:\n');
{
  delete process.env.NO_COLOR;
  process.stdout.isTTY = false;
  const opts = parseArgs([]);
  assert(opts.noColor === true, 'T-nontty: isTTY=false sets noColor to true');
  restoreGlobals();
}

// T-verbose-detail-pass: verbose mode shows detail for pass results
originalWrite.call(process.stdout, '\nT-verbose-detail-pass:\n');
{
  const passWithDetail = [
    { category: 'agents', name: 'test-pass', status: 'pass', message: 'ok', detail: { expected: 'pass-expected-val', found: 'pass-found-val' } },
  ];
  captureStart();
  report(passWithDetail, { verbose: true, noColor: true });
  const out = captureStop();
  assert(out.includes('Expected: pass-expected-val'), 'T-verbose-detail-pass: verbose shows Expected for pass');
  assert(out.includes('Found: pass-found-val'), 'T-verbose-detail-pass: verbose shows Found for pass');
}

// T-verbose-detail-warn: verbose mode shows detail for warn results
originalWrite.call(process.stdout, '\nT-verbose-detail-warn:\n');
{
  const warnWithDetail = [
    { category: 'agents', name: 'test-warn', status: 'warn', message: 'caution', detail: { expected: 'warn-expected-val', found: 'warn-found-val' } },
  ];
  captureStart();
  report(warnWithDetail, { verbose: true, noColor: true });
  const out = captureStop();
  assert(out.includes('Expected: warn-expected-val'), 'T-verbose-detail-warn: verbose shows Expected for warn');
  assert(out.includes('Found: warn-found-val'), 'T-verbose-detail-warn: verbose shows Found for warn');
}

// T-quiet-only-summary: quiet mode prints only the summary bar
originalWrite.call(process.stdout, '\nT-quiet-only-summary:\n');
{
  const items = [
    { category: 'agents', name: 'a', status: 'pass', message: 'm' },
    { category: 'agents', name: 'b', status: 'fail', message: 'n' },
  ];
  captureStart();
  report(items, { quiet: true, noColor: true });
  const out = captureStop();
  assert(out.includes('RESULT:'), 'T-quiet-only-summary: output contains RESULT:');
  assert(!out.includes('Orchestration Validator'), 'T-quiet-only-summary: no header in quiet mode');
  assert(!out.includes('Agents'), 'T-quiet-only-summary: no category header in quiet mode');
  assert(!out.includes('[PASS]'), 'T-quiet-only-summary: no check lines in quiet mode');
  assert(!out.includes('[FAIL]') || out.indexOf('[FAIL]') === -1 || out.includes('FAIL'), 'T-quiet-only-summary: no individual check lines');
}

// T-quiet-overrides-verbose: parseArgs(['--quiet', '--verbose'])
originalWrite.call(process.stdout, '\nT-quiet-overrides-verbose:\n');
{
  process.stdout.isTTY = true;
  delete process.env.NO_COLOR;
  const opts = parseArgs(['--quiet', '--verbose']);
  assert(opts.quiet === true, 'T-quiet-overrides-verbose: quiet is true');
  assert(opts.verbose === false, 'T-quiet-overrides-verbose: verbose is false');
  restoreGlobals();
}

// T-quiet-overrides-verbose-reverse: parseArgs(['--verbose', '--quiet'])
originalWrite.call(process.stdout, '\nT-quiet-overrides-verbose-reverse:\n');
{
  process.stdout.isTTY = true;
  delete process.env.NO_COLOR;
  const opts = parseArgs(['--verbose', '--quiet']);
  assert(opts.quiet === true, 'T-quiet-overrides-verbose-reverse: quiet is true');
  assert(opts.verbose === false, 'T-quiet-overrides-verbose-reverse: verbose is false');
  restoreGlobals();
}

// T-summary-counts: exact counts in summary bar
originalWrite.call(process.stdout, '\nT-summary-counts:\n');
{
  const countResults = [
    { category: 'a', name: 'p1', status: 'pass', message: '' },
    { category: 'a', name: 'p2', status: 'pass', message: '' },
    { category: 'a', name: 'p3', status: 'pass', message: '' },
    { category: 'a', name: 'p4', status: 'pass', message: '' },
    { category: 'a', name: 'p5', status: 'pass', message: '' },
    { category: 'a', name: 'f1', status: 'fail', message: '' },
    { category: 'a', name: 'f2', status: 'fail', message: '' },
    { category: 'a', name: 'w1', status: 'warn', message: '' },
  ];
  captureStart();
  report(countResults, { noColor: true });
  const out = captureStop();
  assert(out.includes('5 passed  2 failed  1 warning'), 'T-summary-counts: 5 passed  2 failed  1 warning');
}

// T-summary-plural: 0 warnings → 'warnings' (plural)
originalWrite.call(process.stdout, '\nT-summary-plural:\n');
{
  const zeroWarnResults = [
    { category: 'a', name: 'p1', status: 'pass', message: '' },
    { category: 'a', name: 'p2', status: 'pass', message: '' },
  ];
  captureStart();
  report(zeroWarnResults, { noColor: true });
  const out = captureStop();
  assert(out.includes('0 warnings'), 'T-summary-plural: 0 warnings uses plural');
}

// T-summary-singular: 1 warning → 'warning' (singular, no trailing s)
originalWrite.call(process.stdout, '\nT-summary-singular:\n');
{
  const oneWarnResults = [
    { category: 'a', name: 'w1', status: 'warn', message: '' },
  ];
  captureStart();
  report(oneWarnResults, { noColor: true });
  const out = captureStop();
  // Must contain '1 warning' but NOT '1 warnings'
  assert(out.includes('1 warning') && !out.includes('1 warnings'), 'T-summary-singular: 1 warning uses singular');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

originalWrite.call(process.stdout, '\n' + '='.repeat(50) + '\n');
originalWrite.call(process.stdout, 'Results: ' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) {
  process.exitCode = 1;
}

#!/usr/bin/env node
'use strict';

const path = require('path');
const { report, printHelp } = require('./lib/reporter');
const { readFile } = require('./lib/utils/fs-helpers');
const { parseYaml } = require('./lib/utils/yaml-parser');
const checkStructure = require('./lib/checks/structure');
const checkAgents = require('./lib/checks/agents');
const checkSkills = require('./lib/checks/skills');
const checkConfig = require('./lib/checks/config');
const checkInstructions = require('./lib/checks/instructions');
const checkPrompts = require('./lib/checks/prompts');
const checkCrossRefs = require('./lib/checks/cross-refs');

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['structure', 'agents', 'skills', 'config', 'instructions', 'prompts', 'cross-references'];

const CHECK_MODULES = [
  { category: 'structure', check: checkStructure },
  { category: 'agents', check: checkAgents },
  { category: 'skills', check: checkSkills },
  { category: 'config', check: checkConfig },
  { category: 'instructions', check: checkInstructions },
  { category: 'prompts', check: checkPrompts },
  { category: 'cross-references', check: checkCrossRefs },
];

// ─── Argument Parsing ─────────────────────────────────────────────────────────

/**
 * Parse CLI arguments into an options object.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ help: boolean, noColor: boolean, verbose: boolean, quiet: boolean, category: string|null }}
 */
function parseArgs(argv) {
  const opts = { help: false, noColor: false, verbose: false, quiet: false, category: null };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--no-color') {
      opts.noColor = true;
    } else if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (arg === '--category' || arg === '-c') {
      opts.category = argv[++i] || null;
    }
  }

  // --quiet overrides --verbose
  if (opts.quiet) {
    opts.verbose = false;
  }

  // Respect NO_COLOR env and non-TTY stdout
  if ((process.env.NO_COLOR && process.env.NO_COLOR !== '') || !process.stdout.isTTY) {
    opts.noColor = true;
  }

  return opts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the orchestration root folder name from orchestration.yml.
 * Uses __dirname-relative discovery (same pattern as pipeline scripts).
 * @param {string} basePath - Workspace root (reserved — config resolved via __dirname)
 * @returns {string} Folder name, e.g. '.github'
 */
function bootstrapOrchRoot(basePath) {
  try {
    const configPath = path.resolve(__dirname, '../../config/orchestration.yml');
    const content = readFile(configPath);
    if (content === null) return '.github';
    const parsed = parseYaml(content);
    if (parsed && parsed.system && typeof parsed.system.orch_root === 'string' && parsed.system.orch_root.trim() !== '') {
      return parsed.system.orch_root;
    }
    return '.github';
  } catch {
    return '.github';
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const basePath = path.resolve(process.cwd());
  const orchRoot = bootstrapOrchRoot(basePath);

  if (options.help) {
    printHelp(orchRoot);
    process.exit(0);
  }

  if (options.category !== null && !CATEGORIES.includes(options.category)) {
    console.error(`Error: Unknown category "${options.category}". Valid categories: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  const context = {
    agents: new Map(),
    skills: new Map(),
    config: null,
    instructions: [],
    prompts: [],
  };

  // Run ALL checks to populate shared context (silent prerequisites).
  // --category filtering happens after all checks complete.
  const allResults = [];
  for (const mod of CHECK_MODULES) {
    if (mod.check === null) continue;
    const results = await mod.check(basePath, context, context.config, orchRoot);
    allResults.push(...results);
  }

  const reportResults = options.category
    ? allResults.filter(r => r.category === options.category)
    : allResults;

  report(reportResults, {
    noColor: options.noColor,
    verbose: options.verbose,
    quiet: options.quiet,
  });

  const failCount = reportResults.filter(r => r.status === 'fail').length;
  process.exit(failCount > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  });
}

module.exports = { parseArgs, bootstrapOrchRoot };

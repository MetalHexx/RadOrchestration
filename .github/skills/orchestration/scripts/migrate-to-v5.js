'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SCHEMA_VERSION } = require('./lib/constants.js');
const { validateTransition } = require('./lib/validator.js');

const V4_SCHEMA = 'orchestration-state-v4';
const V5_SCHEMA = 'orchestration-state-v5'; // Should equal SCHEMA_VERSION

const V1_CONFIG = '1.0';
const V5_CONFIG = '5.0';

/**
 * Detect state version. Returns 4 for v4, 5 for v5.
 * @param {Object} rawState
 * @returns {4 | 5}
 * @throws {Error} on unknown schema
 */
function detectStateVersion(rawState) {
  if (rawState.$schema === V4_SCHEMA) return 4;
  if (rawState.$schema === V5_SCHEMA) return 5;
  throw new Error(`Unknown state schema: "${rawState.$schema}"`);
}

/**
 * Migrate a single state.json from v4 to v5.
 * Adds pipeline.source_control with null defaults.
 * @param {Object} v4State
 * @returns {Object} v5State — new object, input not mutated
 */
function migrateStateToV5(v4State) {
  const migrated = JSON.parse(JSON.stringify(v4State));
  migrated.$schema = V5_SCHEMA;
  migrated.pipeline.source_control = {
    activation_choice: null,
    branch_from_choice: null,
    worktree_path: null,
    branch: null,
    cleanup_choice: null,
  };
  return migrated;
}

/**
 * Process a single project directory: detect, backup, migrate, validate, write.
 * @param {string} projectDir - absolute path to project directory
 * @returns {{ status: 'migrated' | 'skipped' | 'failed', message: string }}
 */
function migrateProject(projectDir) {
  try {
    const statePath = path.join(projectDir, 'state.json');

    if (!fs.existsSync(statePath)) {
      return { status: 'skipped', message: 'No state.json found' };
    }

    const content = fs.readFileSync(statePath, 'utf8');
    const rawState = JSON.parse(content);
    const version = detectStateVersion(rawState);

    if (version === 5) {
      return { status: 'skipped', message: 'Already on v5' };
    }

    // Create backup
    const backupPath = path.join(projectDir, 'state.v4.json.bak');
    fs.writeFileSync(backupPath, content);

    // Migrate
    const migrated = migrateStateToV5(rawState);

    // Validate — use a permissive config to avoid TypeError in V5's config.limits access.
    // The validator requires config.limits and config.human_gates to exist as objects;
    // empty sub-objects cause numeric comparisons against undefined (returns false) so
    // no limits are enforced while structural checks (V16) still run.
    const errors = validateTransition(null, migrated, { limits: {}, human_gates: {} });
    if (errors.length > 0) {
      return { status: 'failed', message: `Validation failed: ${errors[0].message}` };
    }

    // Write migrated state
    fs.writeFileSync(statePath, JSON.stringify(migrated, null, 2) + '\n');

    return { status: 'migrated', message: 'Migrated from v4 to v5' };
  } catch (error) {
    return { status: 'failed', message: error.message };
  }
}

/**
 * Format CLI output lines per the Design spec.
 * @param {string} statePath - absolute path to state.json (or project dir when no state found)
 * @param {{ status: string, message: string }} result
 * @returns {string[]}
 */
function formatProjectOutput(statePath, result) {
  const lines = [`migrate-to-v5: ${statePath}`];

  if (result.status === 'migrated') {
    lines.push('  \u2713 Detected version: v4');
    lines.push('  \u2713 Backup created: state.v4.json.bak');
    lines.push('  \u2713 Migrated to v5 (added source_control fields)');
    lines.push('  \u2713 Validation passed');
    lines.push('  \u2713 Written: state.json');
  } else if (result.status === 'skipped') {
    lines.push(`  \u21b7 ${result.message} \u2014 skipped`);
  } else if (result.status === 'failed') {
    if (result.message.startsWith('Validation failed: ')) {
      const errMsg = result.message.slice('Validation failed: '.length);
      lines.push('  \u2713 Detected version: v4');
      lines.push('  \u2713 Backup created: state.v4.json.bak');
      lines.push('  \u2717 Validation failed after migration:');
      lines.push(`    - ${errMsg}`);
      lines.push('  \u2717 Migration aborted \u2014 backup preserved at state.v4.json.bak');
    } else {
      lines.push(`  \u2717 ${result.message}`);
    }
  }

  return lines;
}

/**
 * Detect config version from YAML content string.
 * @param {string} yamlContent - raw YAML file content
 * @returns {'1.0' | '5.0'}
 * @throws {Error} on unknown version or missing version field
 */
function detectConfigVersion(yamlContent) {
  const match = /^version:\s*["']?(\d+\.\d+)["']?/m.exec(yamlContent);
  if (!match) {
    throw new Error('No version field found in config');
  }
  const ver = match[1];
  if (ver === '1.0') return '1.0';
  if (ver === '5.0') return '5.0';
  throw new Error(`Unknown config version: "${ver}"`);
}

/**
 * Migrate orchestration.yml content from v1.0 to v5.0.
 * Uses string manipulation to bump version and insert source_control section.
 * @param {string} yamlContent - raw YAML file content (v1.0)
 * @returns {string} migrated YAML content (v5.0)
 */
function migrateConfigToV5(yamlContent) {
  // Bump the version line
  let migrated = yamlContent.replace(
    /^(version:\s*["'])1\.0(["'])/m,
    '$15.0$2'
  );

  // source_control block to insert (leading \n provides blank line separator)
  const scBlock =
    '\n# \u2500\u2500\u2500 Source Control \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
    'source_control:\n' +
    '  isolation_mode: "none"                 # worktree | branch | none\n' +
    '  activation: "never"                    # always | never | ask\n' +
    '  branch_from: "ask"                     # default | current | ask\n' +
    '  worktree_path: "../worktrees"          # Relative (from repo root) or absolute path\n' +
    '  branch_prefix: "project/"              # Branch naming prefix (e.g., project/MY-PROJECT)\n' +
    '  cleanup: "ask"                         # ask | on_completion | manual\n';

  // Find the Notes separator (case-insensitive on "notes")
  const notesMatch = /^# \u2500+\s+notes/im.exec(migrated);
  if (notesMatch) {
    const idx = notesMatch.index;
    migrated = migrated.slice(0, idx) + scBlock + migrated.slice(idx);
  } else {
    migrated = migrated + scBlock;
  }

  return migrated;
}

/**
 * Validate migrated config YAML structurally.
 * @param {string} yamlContent - migrated YAML content
 * @returns {string[]} array of error messages (empty = valid)
 */
function validateConfigMigration(yamlContent) {
  const errors = [];

  if (!/^version:\s*["']5\.0["']/m.test(yamlContent)) {
    errors.push('Missing version: "5.0"');
  }
  if (!/^source_control:/m.test(yamlContent)) {
    errors.push('Missing source_control: section');
  }
  for (const key of ['isolation_mode', 'activation', 'branch_from', 'worktree_path', 'branch_prefix', 'cleanup']) {
    if (!new RegExp(`^\\s+${key}:`, 'm').test(yamlContent)) {
      errors.push(`Missing source_control key: ${key}`);
    }
  }
  for (const section of ['system', 'projects', 'limits', 'human_gates']) {
    if (!new RegExp(`^${section}:`, 'm').test(yamlContent)) {
      errors.push(`Missing required section: ${section}`);
    }
  }

  return errors;
}

/**
 * Process a single config file: detect, backup, migrate, validate, write.
 * @param {string} configPath - absolute path to orchestration.yml
 * @returns {{ status: 'migrated' | 'skipped' | 'failed', message: string }}
 */
function migrateConfig(configPath) {
  try {
    if (!fs.existsSync(configPath)) {
      return { status: 'failed', message: 'File not found' };
    }

    const content = fs.readFileSync(configPath, 'utf8');

    let version;
    try {
      version = detectConfigVersion(content);
    } catch (e) {
      return { status: 'failed', message: e.message };
    }

    if (version === V5_CONFIG) {
      return { status: 'skipped', message: 'Already on 5.0' };
    }

    // Create backup
    const backupPath = path.join(path.dirname(configPath), 'orchestration.v1.yml.bak');
    fs.writeFileSync(backupPath, content);

    // Migrate
    const migrated = migrateConfigToV5(content);

    // Validate
    const errors = validateConfigMigration(migrated);
    if (errors.length > 0) {
      return { status: 'failed', message: 'Validation failed: ' + errors[0] };
    }

    // Write migrated config
    fs.writeFileSync(configPath, migrated);

    return { status: 'migrated', message: 'Migrated from 1.0 to 5.0' };
  } catch (error) {
    return { status: 'failed', message: error.message };
  }
}

/**
 * Format CLI output lines for config migration result.
 * @param {string} configPath - absolute path to the config file
 * @param {{ status: string, message: string }} result
 * @returns {string[]}
 */
function formatConfigOutput(configPath, result) {
  const lines = [`migrate-to-v5: ${configPath}`];

  if (result.status === 'migrated') {
    lines.push('  \u2713 Detected version: 1.0');
    lines.push('  \u2713 Backup created: orchestration.v1.yml.bak');
    lines.push('  \u2713 Migrated to 5.0 (added source_control section, bumped version)');
    lines.push('  \u2713 Validation passed');
    lines.push(`  \u2713 Written: ${path.basename(configPath)}`);
  } else if (result.status === 'skipped') {
    lines.push('  \u21b7 Already on 5.0 \u2014 skipped');
  } else if (result.status === 'failed') {
    if (result.message.startsWith('Validation failed: ')) {
      const errMsg = result.message.slice('Validation failed: '.length);
      lines.push('  \u2713 Detected version: 1.0');
      lines.push('  \u2713 Backup created: orchestration.v1.yml.bak');
      lines.push('  \u2717 Validation failed after migration:');
      lines.push(`    - ${errMsg}`);
      lines.push('  \u2717 Migration aborted \u2014 backup preserved at orchestration.v1.yml.bak');
    } else {
      lines.push(`  \u2717 ${result.message}`);
    }
  }

  return lines;
}

// ─── Bulk Migration ───────────────────────────────────────────────────────────

/**
 * Discover project directories containing state.json under basePath.
 * Scans immediate subdirs of basePath and immediate subdirs of basePath/_archived/.
 * Directories without state.json are silently excluded.
 * @param {string} basePath - absolute path to projects root
 * @returns {Array<{ name: string, dir: string, archived: boolean }>}
 */
function discoverProjects(basePath) {
  const projects = [];

  // Scan immediate subdirectories of basePath
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_archived') continue; // handled separately
    const dir = path.join(basePath, entry.name);
    const statePath = path.join(dir, 'state.json');
    if (fs.existsSync(statePath)) {
      projects.push({ name: entry.name, dir, archived: false });
    }
  }

  // Scan _archived/ subdirectories
  const archivedDir = path.join(basePath, '_archived');
  if (fs.existsSync(archivedDir) && fs.statSync(archivedDir).isDirectory()) {
    const archivedEntries = fs.readdirSync(archivedDir, { withFileTypes: true });
    for (const entry of archivedEntries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(archivedDir, entry.name);
      const statePath = path.join(dir, 'state.json');
      if (fs.existsSync(statePath)) {
        projects.push({ name: entry.name, dir, archived: true });
      }
    }
  }

  // Sort alphabetically by name
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

/**
 * Bulk-migrate all state.json files under basePath.
 * Optionally also migrates a config file.
 * In dry-run mode, detects versions but does not write any files.
 * @param {string} basePath          - absolute path to projects root
 * @param {string|null} [configPath] - absolute path to orchestration.yml (null = skip config)
 * @param {boolean} [dryRun]         - if true, detect versions only, no writes (default: false)
 * @returns {{
 *   migrated: number,
 *   skipped: number,
 *   failed: number,
 *   details: Array<{ name: string, status: string, message: string, archived: boolean }>,
 *   configResult: { status: string, message: string } | null
 * }}
 */
function migrateAll(basePath, configPath = null, dryRun = false) {
  try {
    const projects = discoverProjects(basePath);
    const details = [];

    for (const project of projects) {
      if (dryRun) {
        try {
          const statePath = path.join(project.dir, 'state.json');
          const content = fs.readFileSync(statePath, 'utf8');
          const rawState = JSON.parse(content);
          const version = detectStateVersion(rawState);
          if (version === 4) {
            details.push({ name: project.name, status: 'would_migrate', message: 'v4 \u2014 would migrate to v5', archived: project.archived });
          } else {
            details.push({ name: project.name, status: 'skipped', message: 'Already on v5', archived: project.archived });
          }
        } catch (e) {
          details.push({ name: project.name, status: 'failed', message: e.message, archived: project.archived });
        }
      } else {
        const result = migrateProject(project.dir);
        details.push({ name: project.name, status: result.status, message: result.message, archived: project.archived });
      }
    }

    let configResult = null;
    if (configPath !== null) {
      if (dryRun) {
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          const version = detectConfigVersion(content);
          if (version === V1_CONFIG) {
            configResult = { status: 'would_migrate', message: '1.0 \u2014 would migrate to 5.0' };
          } else {
            configResult = { status: 'skipped', message: 'Already on 5.0' };
          }
        } catch (e) {
          configResult = { status: 'failed', message: e.message };
        }
      } else {
        configResult = migrateConfig(configPath);
      }
    }

    const migrated = details.filter(d => d.status === 'migrated' || d.status === 'would_migrate').length;
    const skipped = details.filter(d => d.status === 'skipped').length;
    const failed = details.filter(d => d.status === 'failed').length;

    return { migrated, skipped, failed, details, configResult };
  } catch (error) {
    return { migrated: 0, skipped: 0, failed: 0, details: [], configResult: null };
  }
}

/**
 * Format CLI output lines for bulk migration result (Design Flow 10).
 * @param {string} basePath - absolute path to projects root
 * @param {Object} result   - return value from migrateAll
 * @param {boolean} dryRun  - whether this was a dry run
 * @returns {string[]}
 */
function formatBulkOutput(basePath, result, dryRun) {
  const lines = [];
  const BOX = '\u2500'.repeat(46);
  const { details, configResult } = result;

  // Header
  lines.push(`migrate-to-v5: Bulk migration of ${basePath}${dryRun ? ' (dry run)' : ''}`);
  lines.push('');

  // Processing/Scanning line
  const N = details.length;
  lines.push(`  ${dryRun ? 'Scanning' : 'Processing'} ${N} state ${N === 1 ? 'file' : 'files'}...`);
  lines.push('');

  // Project lines
  for (const d of details) {
    const nameDisplay = d.archived ? `${d.name} (archived)` : d.name;
    let line;
    if (dryRun) {
      if (d.status === 'would_migrate') {
        line = `  \u25cb ${nameDisplay} \u2014 v4, would migrate`;
      } else if (d.status === 'skipped') {
        line = `  \u21b7 ${nameDisplay} \u2014 already v5`;
      } else {
        line = `  \u2717 ${nameDisplay} \u2014 failed: ${d.message}`;
      }
    } else {
      if (d.status === 'migrated') {
        line = `  \u2713 ${nameDisplay} \u2014 migrated`;
      } else if (d.status === 'skipped') {
        line = `  \u21b7 ${nameDisplay} \u2014 already v5, skipped`;
      } else {
        line = `  \u2717 ${nameDisplay} \u2014 failed: ${d.message}`;
      }
    }
    lines.push(line);
  }

  // Config line (if provided)
  if (configResult !== null) {
    lines.push('');
    let configLine;
    if (dryRun) {
      if (configResult.status === 'would_migrate') {
        configLine = `  \u25cb orchestration.yml \u2014 1.0, would migrate to 5.0`;
      } else if (configResult.status === 'skipped') {
        configLine = `  \u21b7 orchestration.yml \u2014 already on 5.0`;
      } else {
        configLine = `  \u2717 orchestration.yml \u2014 failed: ${configResult.message}`;
      }
    } else {
      if (configResult.status === 'migrated') {
        configLine = `  \u2713 orchestration.yml \u2014 migrated from 1.0 to 5.0`;
      } else if (configResult.status === 'skipped') {
        configLine = `  \u21b7 orchestration.yml \u2014 already on 5.0`;
      } else {
        configLine = `  \u2717 orchestration.yml \u2014 failed: ${configResult.message}`;
      }
    }
    lines.push(configLine);
  }

  // Summary box
  lines.push('');
  lines.push(`  ${BOX}`);
  let summaryText;
  if (dryRun) {
    summaryText = `Summary: ${result.migrated} to migrate, ${result.failed} failed, ${result.skipped} already current`;
  } else {
    summaryText = `Summary: ${result.migrated} migrated, ${result.failed} failed, ${result.skipped} skipped`;
    if (configResult !== null) {
      summaryText += ` | Config: ${configResult.status}`;
    }
  }
  lines.push(`  ${summaryText}`);
  lines.push(`  ${BOX}`);

  // Failed details section
  const failedDetails = details.filter(d => d.status === 'failed');
  if (failedDetails.length > 0) {
    lines.push('');
    lines.push('  Failed:');
    for (const d of failedDetails) {
      lines.push(`    \u2717 ${d.name}: ${d.message}`);
    }
  }

  return lines;
}

module.exports = {
  detectStateVersion, migrateStateToV5, migrateProject,
  detectConfigVersion, migrateConfigToV5, migrateConfig,
  migrateAll,
};

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes('--dry-run');

  // --all mode (checked BEFORE --config so --all ... --config ... is parsed as bulk mode)
  const allIdx = rawArgs.indexOf('--all');
  if (allIdx !== -1) {
    const baseArg = rawArgs[allIdx + 1];
    if (!baseArg || baseArg.startsWith('--')) {
      process.stderr.write('Usage: node migrate-to-v5.js --all <base-path> [--config <path>] [--dry-run]\n');
      process.exit(1);
    }
    const basePath = path.resolve(baseArg);
    if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) {
      process.stderr.write(`\u2717 Base path does not exist or is not a directory: ${basePath}\n`);
      process.exit(1);
    }

    const cfgIdx = rawArgs.indexOf('--config');
    let configPath = null;
    if (cfgIdx !== -1) {
      const cfgArg = rawArgs[cfgIdx + 1];
      if (!cfgArg || cfgArg.startsWith('--')) {
        process.stderr.write('Usage: node migrate-to-v5.js --all <base-path> [--config <path>] [--dry-run]\n');
        process.exit(1);
      }
      configPath = path.resolve(cfgArg);
    }

    const result = migrateAll(basePath, configPath, dryRun);
    const lines = formatBulkOutput(basePath, result, dryRun);
    lines.forEach(line => process.stdout.write(line + '\n'));
    process.exit(result.failed > 0 ? 1 : 0);
  }

  // --config mode
  const configIdx = rawArgs.indexOf('--config');
  if (configIdx !== -1) {
    const configArg = rawArgs[configIdx + 1];
    if (!configArg || configArg.startsWith('--')) {
      process.stderr.write('Usage: node migrate-to-v5.js --config <path> [--dry-run]\n');
      process.exit(1);
    }
    const configPath = path.resolve(configArg);

    if (dryRun) {
      try {
        if (!fs.existsSync(configPath)) {
          process.stderr.write(`\u2717 File not found: ${configPath}\n`);
          process.exit(1);
        }
        const content = fs.readFileSync(configPath, 'utf8');
        const version = detectConfigVersion(content);
        process.stdout.write(`migrate-to-v5: ${configPath} (dry run)\n`);
        if (version === V5_CONFIG) {
          process.stdout.write('  \u21b7 Already on 5.0 \u2014 no changes needed\n');
        } else {
          process.stdout.write(`  \u25cb Detected version: ${version} \u2014 would migrate to 5.0\n`);
        }
      } catch (e) {
        process.stderr.write(`  \u2717 ${e.message}\n`);
        process.exit(1);
      }
      process.exit(0);
    }

    const result = migrateConfig(configPath);
    const lines = formatConfigOutput(configPath, result);
    lines.forEach(line => process.stdout.write(line + '\n'));
    process.exit(result.status === 'failed' ? 1 : 0);
  }

  // <project-dir> mode
  const args = rawArgs.filter(a => !a.startsWith('--'));

  if (args.length === 0) {
    process.stderr.write(
      'Usage: node migrate-to-v5.js <project-dir> [--dry-run]\n' +
      '       node migrate-to-v5.js --config <path> [--dry-run]\n' +
      '       node migrate-to-v5.js --all <base-path> [--config <path>] [--dry-run]\n'
    );
    process.exit(1);
  }

  const projectDir = path.resolve(args[0]);

  if (dryRun) {
    try {
      const statePath = path.join(projectDir, 'state.json');
      if (!fs.existsSync(statePath)) {
        process.stderr.write(`\u2717 No state.json found at: ${statePath}\n`);
        process.exit(1);
      }
      const content = fs.readFileSync(statePath, 'utf8');
      const rawState = JSON.parse(content);
      const version = detectStateVersion(rawState);
      process.stdout.write(`migrate-to-v5: ${statePath} (dry run)\n`);
      if (version === 5) {
        process.stdout.write('  \u21b7 Already on v5 \u2014 no changes needed\n');
      } else {
        process.stdout.write('  \u25cb Detected version: v4 \u2014 would migrate to v5\n');
      }
    } catch (e) {
      process.stderr.write(`  \u2717 ${e.message}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  const result = migrateProject(projectDir);

  // For "No state.json found" the Design spec shows project dir, not state path
  const displayPath =
    result.status === 'skipped' && result.message === 'No state.json found'
      ? projectDir
      : path.join(projectDir, 'state.json');

  const lines = formatProjectOutput(displayPath, result);
  lines.forEach(line => process.stdout.write(line + '\n'));

  process.exit(result.status === 'failed' ? 1 : 0);
}

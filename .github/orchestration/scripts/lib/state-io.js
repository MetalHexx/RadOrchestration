'use strict';

const fs = require('fs');
const path = require('path');
const { readFile, exists } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { parseYaml } = require('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser');
const { extractFrontmatter } = require('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter');
const { SCHEMA_VERSION } = require('./constants');

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG = Object.freeze({
  projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  errors: {
    severity: {
      critical: ['build_failure', 'security_vulnerability', 'architectural_violation', 'data_loss_risk'],
      minor: ['test_failure', 'lint_error', 'review_suggestion', 'missing_test_coverage', 'style_violation'],
    },
    on_critical: 'halt',
    on_minor: 'retry',
  },
  human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
});

// ─── readState ──────────────────────────────────────────────────────────────

function readState(projectDir) {
  const statePath = path.join(projectDir, 'state.json');
  const content = readFile(statePath);
  if (content === null) return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error('Failed to parse state.json: ' + err.message);
  }

  if (parsed.$schema !== SCHEMA_VERSION) {
    throw new Error(
      'Schema version mismatch: expected ' + SCHEMA_VERSION + ', got ' + parsed.$schema
    );
  }

  return parsed;
}

// ─── writeState ─────────────────────────────────────────────────────────────

function writeState(projectDir, state) {
  state.project.updated = new Date().toISOString();
  const statePath = path.join(projectDir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

// ─── readConfig ─────────────────────────────────────────────────────────────

function mergeConfig(parsed) {
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    projects: { ...DEFAULT_CONFIG.projects, ...(parsed.projects || {}) },
    limits: { ...DEFAULT_CONFIG.limits, ...(parsed.limits || {}) },
    errors: { ...DEFAULT_CONFIG.errors, ...(parsed.errors || {}) },
    human_gates: { ...DEFAULT_CONFIG.human_gates, ...(parsed.human_gates || {}) },
  };
}

function readConfig(configPath) {
  let resolvedPath = configPath;
  if (!resolvedPath) {
    resolvedPath = path.resolve(__dirname, '../../../orchestration.yml');
  }
  if (exists(resolvedPath)) {
    const content = readFile(resolvedPath);
    if (content !== null) {
      const parsed = parseYaml(content);
      if (parsed) {
        return mergeConfig(parsed);
      }
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

// ─── readDocument ───────────────────────────────────────────────────────────

function readDocument(docPath) {
  if (!exists(docPath)) return null;
  const content = readFile(docPath);
  if (content === null) return null;
  return extractFrontmatter(content);
}

// ─── ensureDirectories ──────────────────────────────────────────────────────

function ensureDirectories(projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'phases'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'reports'), { recursive: true });
}

// ─── createRealIO ───────────────────────────────────────────────────────────

function createRealIO() {
  return { readState, writeState, readConfig, readDocument, ensureDirectories };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  readState,
  writeState,
  readConfig,
  readDocument,
  ensureDirectories,
  createRealIO,
  DEFAULT_CONFIG,
};

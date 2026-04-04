'use strict';

const fs = require('fs');
const path = require('path');
const { readFile, exists } = require('../validate/lib/utils/fs-helpers');
const { parseYaml } = require('../validate/lib/utils/yaml-parser');
const { extractFrontmatter } = require('../validate/lib/utils/frontmatter');
const { SCHEMA_VERSION } = require('./constants');

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG = Object.freeze({
  system: { orch_root: '.github' },
  projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
  source_control: { auto_commit: 'ask', auto_pr: 'ask', provider: 'github' },
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
    system: { ...DEFAULT_CONFIG.system, ...(parsed.system || {}) },
    projects: { ...DEFAULT_CONFIG.projects, ...(parsed.projects || {}) },
    limits: { ...DEFAULT_CONFIG.limits, ...(parsed.limits || {}) },
    human_gates: { ...DEFAULT_CONFIG.human_gates, ...(parsed.human_gates || {}) },
    source_control: { ...DEFAULT_CONFIG.source_control, ...(parsed.source_control || {}) },
  };
}

function readConfig(configPath) {
  let resolvedPath = configPath;
  if (!resolvedPath) {
    resolvedPath = path.resolve(__dirname, '../../config/orchestration.yml');
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

// ─── bootstrapOrchRoot ─────────────────────────────────────────────────────

/**
 * Resolve the orchestration root folder from orchestration.yml.
 * Uses __dirname-relative discovery (same pattern as validate-orchestration.js).
 * Supports both relative folder names and absolute paths.
 * @returns {string} The orch_root value, e.g. '.github' or '/shared/orch'
 */
function bootstrapOrchRoot() {
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
  bootstrapOrchRoot,
  readDocument,
  ensureDirectories,
  createRealIO,
  DEFAULT_CONFIG,
};

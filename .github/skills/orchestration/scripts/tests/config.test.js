'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// ─── Mock Setup ─────────────────────────────────────────────────────────────

// Mock fs-helpers and yaml-parser modules to avoid real file system access.
// Same cache-replacement pattern as agents.test.js and skills.test.js.

let mockReadFile = () => null;
let mockParseYaml = () => null;

const path = require('path');
const fsHelpersPath = require.resolve('../validate/lib/utils/fs-helpers');
const yamlParserPath = require.resolve('../validate/lib/utils/yaml-parser');

// Save originals so other exports remain functional
const origFsHelpers = require(fsHelpersPath);

// Replace with proxies
require.cache[fsHelpersPath] = {
  id: fsHelpersPath,
  filename: fsHelpersPath,
  loaded: true,
  exports: {
    exists: (...args) => origFsHelpers.exists(...args),
    isDirectory: (...args) => origFsHelpers.isDirectory(...args),
    listFiles: (...args) => origFsHelpers.listFiles(...args),
    listDirs: (...args) => origFsHelpers.listDirs(...args),
    readFile: (...args) => mockReadFile(...args),
  }
};

require.cache[yamlParserPath] = {
  id: yamlParserPath,
  filename: yamlParserPath,
  loaded: true,
  exports: {
    parseYaml: (...args) => mockParseYaml(...args),
  }
};

// Now require the module under test — it will pick up the mocked dependencies
const checkConfig = require('../validate/lib/checks/config');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeContext() {
  return {
    agents: new Map(),
    skills: new Map(),
    config: null,
    instructions: [],
    prompts: [],
  };
}

/**
 * Build a valid config object with optional overrides.
 */
function makeConfig(overrides = {}) {
  const base = {
    version: '1.0',
    projects: {
      base_path: 'custom/project-store',
      naming: 'SCREAMING_CASE'
    },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3
    },
    human_gates: {
      after_planning: true,
      execution_mode: 'ask',
      after_final_review: true
    }
  };

  // Apply overrides (shallow merge at top level)
  return { ...base, ...overrides };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('checkConfig', () => {

  beforeEach(() => {
    mockReadFile = () => null;
    mockParseYaml = () => null;
  });

  // ── Basic contract ────────────────────────────────────────────────

  it('exports an async function', async () => {
    assert.strictEqual(typeof checkConfig, 'function');
    const result = checkConfig('/fake', makeContext());
    assert.ok(result instanceof Promise);
    await result;
  });

  // ── File read / parse failures ────────────────────────────────────

  it('file not found (readFile returns null) → 1 fail result, context.config is null', async () => {
    mockReadFile = () => null;
    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.strictEqual(results[0].message, 'Could not read orchestration.yml');
    assert.strictEqual(results[0].category, 'config');
    assert.strictEqual(ctx.config, null);
  });

  it('parse failure (parseYaml returns null) → 1 fail result, context.config is null', async () => {
    mockReadFile = () => 'some content';
    mockParseYaml = () => null;
    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.strictEqual(results[0].message, 'Failed to parse orchestration.yml');
    assert.strictEqual(results[0].category, 'config');
    assert.strictEqual(ctx.config, null);
  });

  // ── Valid config ──────────────────────────────────────────────────

  it('valid config (all sections, correct values) → all pass results, context.config populated', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 0, `Expected 0 fails, got ${fails.length}: ${fails.map(f => f.message).join(', ')}`);

    const passes = results.filter(r => r.status === 'pass');
    assert.ok(passes.length > 0, 'Should have pass results');

    // context.config populated
    assert.strictEqual(ctx.config, config);
    assert.strictEqual(ctx.config.version, '1.0');
  });

  // ── Required sections ─────────────────────────────────────────────

  it('missing required section (no limits key) → fail result for that section', async () => {
    const config = makeConfig();
    delete config.limits;
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.some(f => f.message === 'Missing required section: limits'), 'Should have fail for missing limits');
  });

  it('missing multiple sections → fail result for each missing section', async () => {
    const config = makeConfig();
    delete config.version;
    delete config.limits;
    delete config.human_gates;
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail' && r.message.startsWith('Missing required section'));
    assert.strictEqual(fails.length, 3, `Expected 3 missing section fails, got ${fails.length}`);
    const messages = fails.map(f => f.message);
    assert.ok(messages.includes('Missing required section: version'));
    assert.ok(messages.includes('Missing required section: limits'));
    assert.ok(messages.includes('Missing required section: human_gates'));
  });

  // ── Version validation ────────────────────────────────────────────

  it('invalid version ("2.0" instead of "1.0") → fail with expected="1.0", found="2.0"', async () => {
    const config = makeConfig({ version: '2.0' });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Invalid version');
    assert.ok(fail, 'Should have fail for invalid version');
    assert.strictEqual(fail.detail.expected, '1.0');
    assert.strictEqual(fail.detail.found, '2.0');
  });

  it('valid version ("1.0") → pass result', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const pass = results.find(r => r.message === 'Valid version');
    assert.ok(pass, 'Should have pass for valid version');
    assert.strictEqual(pass.status, 'pass');
  });

  // ── Enum validation ───────────────────────────────────────────────

  it('invalid enum: projects.naming = "camelCase" → fail with expected list', async () => {
    const config = makeConfig({ projects: { base_path: 'custom/project-store', naming: 'camelCase' } });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Invalid value for projects.naming');
    assert.ok(fail, 'Should have fail for invalid projects.naming');
    assert.strictEqual(fail.detail.expected, 'One of: SCREAMING_CASE, lowercase, numbered');
    assert.strictEqual(fail.detail.found, 'camelCase');
  });

  it('valid enum: projects.naming = "SCREAMING_CASE" → pass result', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const pass = results.find(r => r.message === 'Valid projects.naming');
    assert.ok(pass, 'Should have pass for valid projects.naming');
    assert.strictEqual(pass.status, 'pass');
  });

  it('invalid enum: human_gates.execution_mode = "manual" → fail result', async () => {
    const config = makeConfig({
      human_gates: { after_planning: true, execution_mode: 'manual', after_final_review: true }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Invalid value for human_gates.execution_mode');
    assert.ok(fail, 'Should have fail for invalid human_gates.execution_mode');
    assert.strictEqual(fail.detail.found, 'manual');
  });

  it('all valid enums → pass results for each enum field', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const enumKeys = ['projects.naming', 'human_gates.execution_mode'];
    for (const key of enumKeys) {
      const pass = results.find(r => r.message === `Valid ${key}`);
      assert.ok(pass, `Should have pass for ${key}`);
      assert.strictEqual(pass.status, 'pass');
    }
  });

  // ── Limit validation ──────────────────────────────────────────────

  it('missing limit field → fail result', async () => {
    const config = makeConfig({
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2
        // missing max_consecutive_review_rejections
      }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Missing required limit: max_consecutive_review_rejections');
    assert.ok(fail, 'Should have fail for missing limit field');
    assert.strictEqual(fail.status, 'fail');
  });

  it('limit value is 0 → fail (not positive)', async () => {
    const config = makeConfig({
      limits: {
        max_phases: 0,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3
      }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Invalid limit value: max_phases');
    assert.ok(fail, 'Should have fail for zero limit');
    assert.strictEqual(fail.detail.found, '0');
  });

  it('limit value is negative → fail', async () => {
    const config = makeConfig({
      limits: {
        max_phases: -5,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3
      }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Invalid limit value: max_phases');
    assert.ok(fail, 'Should have fail for negative limit');
    assert.strictEqual(fail.detail.found, '-5');
  });

  it('limit value is a string → fail', async () => {
    const config = makeConfig({
      limits: {
        max_phases: 'ten',
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3
      }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Invalid limit value: max_phases');
    assert.ok(fail, 'Should have fail for string limit');
    assert.strictEqual(fail.detail.found, 'ten');
  });

  it('limit value is a float (e.g., 3.5) → fail (not integer)', async () => {
    const config = makeConfig({
      limits: {
        max_phases: 3.5,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3
      }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Invalid limit value: max_phases');
    assert.ok(fail, 'Should have fail for float limit');
    assert.strictEqual(fail.detail.found, '3.5');
  });

  it('all valid limits (positive integers) → pass results for each', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const limitFields = ['max_phases', 'max_tasks_per_phase', 'max_retries_per_task', 'max_consecutive_review_rejections'];
    for (const field of limitFields) {
      const pass = results.find(r => r.message === `Valid limit: ${field}`);
      assert.ok(pass, `Should have pass for ${field}`);
      assert.strictEqual(pass.status, 'pass');
    }
  });

  // ── Human gate hard gates ─────────────────────────────────────────

  it('after_planning is false → fail', async () => {
    const config = makeConfig({
      human_gates: { after_planning: false, execution_mode: 'ask', after_final_review: true }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Human gate violation: after_planning must be true');
    assert.ok(fail, 'Should have fail for after_planning = false');
    assert.strictEqual(fail.detail.expected, 'true');
    assert.strictEqual(fail.detail.found, 'false');
  });

  it('after_final_review is false → fail', async () => {
    const config = makeConfig({
      human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: false }
    });
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const fail = results.find(r => r.message === 'Human gate violation: after_final_review must be true');
    assert.ok(fail, 'Should have fail for after_final_review = false');
    assert.strictEqual(fail.detail.expected, 'true');
    assert.strictEqual(fail.detail.found, 'false');
  });

  it('both gates true → pass result', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    const pass = results.find(r => r.message === 'Human gate hard gates enforced');
    assert.ok(pass, 'Should have pass for both gates true');
    assert.strictEqual(pass.status, 'pass');
  });

  // ── Category consistency ──────────────────────────────────────────

  it('all results have category: "config"', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    for (const result of results) {
      assert.strictEqual(result.category, 'config', `Result "${result.message}" should have category "config"`);
    }
  });

  // ── Never throws ──────────────────────────────────────────────────

  it('function never throws — wraps errors in try/catch, returns fail result', async () => {
    mockReadFile = () => 'content';
    mockParseYaml = () => { throw new Error('kaboom'); };

    const ctx = makeContext();
    let results;
    try {
      results = await checkConfig('/fake', ctx);
    } catch (err) {
      assert.fail(`checkConfig should never throw, but threw: ${err.message}`);
    }

    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.ok(results[0].message.includes('kaboom'));
    assert.strictEqual(ctx.config, null);
  });

  // ── context.config populated on success ───────────────────────────

  it('context.config is populated with the parsed config object on success', async () => {
    const config = makeConfig();
    mockReadFile = () => 'yaml content';
    mockParseYaml = () => config;

    const ctx = makeContext();
    await checkConfig('/fake', ctx);

    assert.strictEqual(ctx.config, config);
    assert.strictEqual(ctx.config.version, '1.0');
    assert.strictEqual(ctx.config.limits.max_phases, 10);
  });

  // ── Edge case: empty string content → parseYaml returns null ──────────

  it('readFile returns empty string → single fail, context.config is null', async () => {
    mockReadFile = () => '';
    mockParseYaml = () => null;
    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.strictEqual(results[0].message, 'Failed to parse orchestration.yml');
    assert.strictEqual(ctx.config, null);
  });

  // ── Edge case: unparseable YAML content ───────────────────────────────

  it('readFile returns unparseable content → single fail, context.config is null', async () => {
    mockReadFile = () => ':::broken:::yaml:::';
    mockParseYaml = () => null;
    const ctx = makeContext();
    const results = await checkConfig('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.strictEqual(results[0].message, 'Failed to parse orchestration.yml');
    assert.ok(results[0].detail, 'Fail result should have detail');
    assert.ok(typeof results[0].detail.expected === 'string');
    assert.ok(typeof results[0].detail.found === 'string');
    assert.strictEqual(ctx.config, null);
  });
});

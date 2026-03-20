'use strict';
/**
 * Tests for the updated checkConfig() in lib/checks/config.js
 *
 * Uses require-cache injection to isolate readFile / parseYaml responses
 * without adding external dependencies.
 */

const assert = require('assert');
const path   = require('path');

// Absolute paths for module cache keys
const fsHelpersPath   = require.resolve('../lib/utils/fs-helpers');
const yamlParserPath  = require.resolve('../lib/utils/yaml-parser');
const configCheckPath = require.resolve('../lib/checks/config');

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeFsHelpersMock(readFileFn) {
  return {
    id: fsHelpersPath,
    filename: fsHelpersPath,
    loaded: true,
    exports: {
      exists: () => false,
      isDirectory: () => false,
      listFiles: () => [],
      listDirs: () => [],
      readFile: readFileFn,
    },
  };
}

function makeYamlParserMock(parseYamlResult) {
  return {
    id: yamlParserPath,
    filename: yamlParserPath,
    loaded: true,
    exports: {
      parseYaml: () => parseYamlResult,
    },
  };
}

/**
 * Load (or reload) checkConfig with injected utility mocks.
 * @param {Function}    readFileFn      - readFile(path) implementation
 * @param {object|null} parseYamlResult - Value returned by parseYaml()
 * @returns {Function} checkConfig
 */
function loadCheckConfig(readFileFn, parseYamlResult) {
  delete require.cache[configCheckPath];

  require.cache[fsHelpersPath]  = makeFsHelpersMock(readFileFn);
  require.cache[yamlParserPath] = makeYamlParserMock(parseYamlResult);

  const checkConfig = require('../lib/checks/config');

  // Restore real modules so other code is unaffected
  delete require.cache[fsHelpersPath];
  delete require.cache[yamlParserPath];
  delete require.cache[configCheckPath];

  return checkConfig;
}

// ─── Fixture ─────────────────────────────────────────────────────────────────

const VALID_BASE_CONFIG = {
  version: '1.0',
  projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 5,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3
  },
  human_gates: {
    after_planning: true,
    after_final_review: true,
    execution_mode: 'autonomous'
  },
};

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(description, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL  ${description}`);
    console.error(`          ${err.message}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('\ncheckConfig() unit tests\n');

  // Test 1: orchRoot parameter changes config file path
  await test('orchRoot parameter changes config file path', async () => {
    let calledPath = null;
    const checkConfig = loadCheckConfig(
      (p) => { calledPath = p; return null; },
      null
    );
    await checkConfig('/fake', {}, null, '.agents');
    assert.ok(calledPath !== null, 'readFile should have been called');
    assert.ok(
      calledPath.endsWith(path.join('.agents', 'skills', 'orchestration', 'config', 'orchestration.yml')),
      `Expected path ending with ${path.join('.agents', 'skills', 'orchestration', 'config', 'orchestration.yml')}, got "${calledPath}"`
    );
    assert.ok(
      !calledPath.includes(path.join('.github', 'orchestration.yml')),
      `Path should NOT contain .github segment, got "${calledPath}"`
    );
  });

  // Test 2: orchRoot defaults to '.github' when undefined
  await test('orchRoot defaults to ".github" when undefined', async () => {
    let calledPath = null;
    const checkConfig = loadCheckConfig(
      (p) => { calledPath = p; return null; },
      null
    );
    await checkConfig('/fake', {}, null, undefined);
    assert.ok(calledPath !== null, 'readFile should have been called');
    assert.ok(
      calledPath.endsWith(path.join('.github', 'skills', 'orchestration', 'config', 'orchestration.yml')),
      `Expected path ending with ${path.join('.github', 'skills', 'orchestration', 'config', 'orchestration.yml')}, got "${calledPath}"`
    );
  });

  // Test 3: Valid system.orch_root produces pass
  await test('valid system.orch_root ".agents" produces a pass result', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG, { system: { orch_root: '.agents' } });
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const matches = results.filter(r => r.message === 'Valid system.orch_root');
    assert.strictEqual(matches.length, 1, `Expected 1 "Valid system.orch_root" result, got ${matches.length}`);
    assert.strictEqual(matches[0].status, 'pass');
  });

  // Test 4: Empty string system.orch_root produces fail
  await test('empty string system.orch_root produces fail with correct message', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG, { system: { orch_root: '' } });
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const matches = results.filter(r => r.message === 'system.orch_root must be a non-empty string');
    assert.strictEqual(matches.length, 1, `Expected 1 failure result, got ${matches.length}`);
    assert.strictEqual(matches[0].status, 'fail');
  });

  // Test 5: Numeric system.orch_root produces fail
  await test('numeric system.orch_root produces fail with correct message', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG, { system: { orch_root: 123 } });
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const matches = results.filter(r => r.message === 'system.orch_root must be a non-empty string');
    assert.strictEqual(matches.length, 1, `Expected 1 failure result, got ${matches.length}`);
    assert.strictEqual(matches[0].status, 'fail');
  });

  // Test 6: system.orch_root with forward slash produces fail
  await test('system.orch_root with forward slash produces fail with correct message', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG, { system: { orch_root: 'path/to/folder' } });
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const matches = results.filter(r => r.message === 'system.orch_root must be a single folder name (relative) or an absolute path');
    assert.strictEqual(matches.length, 1, `Expected 1 failure result, got ${matches.length}`);
    assert.strictEqual(matches[0].status, 'fail');
  });

  // Test 7: system.orch_root with backslash produces fail
  await test('system.orch_root with backslash produces fail with correct message', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG, { system: { orch_root: 'path\\to\\folder' } });
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const matches = results.filter(r => r.message === 'system.orch_root must be a single folder name (relative) or an absolute path');
    assert.strictEqual(matches.length, 1, `Expected 1 failure result, got ${matches.length}`);
    assert.strictEqual(matches[0].status, 'fail');
  });

  // Test 8: Absolute path system.orch_root produces pass
  await test('absolute path system.orch_root produces pass result', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG, { system: { orch_root: '/etc/github' } });
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const matches = results.filter(r => r.message === 'Valid system.orch_root');
    assert.strictEqual(matches.length, 1, `Expected 1 "Valid system.orch_root" result, got ${matches.length}`);
    assert.strictEqual(matches[0].status, 'pass');
  });

  // Test 9a: Windows absolute path system.orch_root produces pass
  await test('Windows absolute path system.orch_root produces pass result', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG, { system: { orch_root: 'C:\\orch' } });
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const matches = results.filter(r => r.message === 'Valid system.orch_root');
    assert.strictEqual(matches.length, 1, `Expected 1 "Valid system.orch_root" result, got ${matches.length}`);
    assert.strictEqual(matches[0].status, 'pass');
  });

  // Test 10: Omitted system section produces no system.orch_root errors
  await test('omitted system section produces no system.orch_root-related results', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG); // no system key
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);
    const sysRootErrors = results.filter(r => r.name === 'orchestration.yml \u2014 system.orch_root');
    assert.strictEqual(sysRootErrors.length, 0, `Expected 0 system.orch_root results, got ${sysRootErrors.length}`);
  });

  // Test 11: Existing validations still work
  await test('existing validations (version, enum fields) still produce pass results', async () => {
    const cfg = Object.assign({}, VALID_BASE_CONFIG);
    const checkConfig = loadCheckConfig(() => 'dummy', cfg);
    const results = await checkConfig('/fake', {}, null, undefined);

    const versionPass = results.filter(r => r.message === 'Valid version' && r.status === 'pass');
    assert.ok(versionPass.length > 0, 'Expected at least one "Valid version" pass result');

    const enumPass = results.filter(r =>
      r.message && r.message.startsWith('Valid ') &&
      r.status === 'pass' &&
      r.name === 'orchestration.yml'
    );
    assert.ok(enumPass.length >= 2, `Expected at least 2 enum/section pass results, got ${enumPass.length}`);
  });

  // ─── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();

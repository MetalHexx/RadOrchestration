'use strict';
/**
 * Tests for bootstrapOrchRoot() in validate-orchestration.js
 *
 * Uses require-cache injection to isolate readFile / parseYaml responses
 * without adding external dependencies.
 */

const assert = require('assert');
const path = require('path');

// Absolute paths for module cache keys
const fsHelpersPath  = require.resolve('../lib/utils/fs-helpers');
const yamlParserPath = require.resolve('../lib/utils/yaml-parser');
const entryPath      = require.resolve('../validate-orchestration');

// ─── Helper: build a module cache stub ─────────────────────────────────────

function makeFsHelpersMock(readFileResult) {
  return {
    id: fsHelpersPath,
    filename: fsHelpersPath,
    loaded: true,
    exports: {
      exists: () => false,
      isDirectory: () => false,
      listFiles: () => [],
      listDirs: () => [],
      readFile: () => readFileResult,
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
 * Load (or reload) validate-orchestration.js with injected utility mocks.
 * Returns the { bootstrapOrchRoot } export.
 *
 * @param {string|null}  readFileResult  - Value returned by readFile()
 * @param {object|null}  parsedConfig    - Value returned by parseYaml()
 */
function loadWithMocks(readFileResult, parsedConfig) {
  // Remove any cached version of the entry module and utilities
  delete require.cache[entryPath];

  // Inject mocks before loading
  require.cache[fsHelpersPath]  = makeFsHelpersMock(readFileResult);
  require.cache[yamlParserPath] = makeYamlParserMock(parsedConfig);

  const { bootstrapOrchRoot } = require('../validate-orchestration');

  // Restore real modules so other code is unaffected
  delete require.cache[fsHelpersPath];
  delete require.cache[yamlParserPath];
  delete require.cache[entryPath];

  return bootstrapOrchRoot;
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL  ${description}`);
    console.error(`          ${err.message}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('\nbootstrapOrchRoot() unit tests\n');

test('returns ".github" when config file does not exist (readFile returns null)', () => {
  const fn = loadWithMocks(null, /* ignored */ null);
  assert.strictEqual(fn(''), '.github');
});

test('returns ".github" when config file contains invalid YAML (parseYaml returns null)', () => {
  const fn = loadWithMocks('!!! invalid yaml %%%', null);
  assert.strictEqual(fn(''), '.github');
});

test('returns ".github" when config file omits the system section', () => {
  const fn = loadWithMocks('version: "1.0"\n', { version: '1.0' });
  assert.strictEqual(fn(''), '.github');
});

test('returns ".github" when system.orch_root is an empty string', () => {
  const fn = loadWithMocks('system:\n  orch_root: ""\n', { system: { orch_root: '' } });
  assert.strictEqual(fn(''), '.github');
});

test('returns ".agents" when config file contains system: { orch_root: ".agents" }', () => {
  const fn = loadWithMocks('system:\n  orch_root: ".agents"\n', { system: { orch_root: '.agents' } });
  assert.strictEqual(fn(''), '.agents');
});

// Structural check — Test #6:
// Verify that main() passes orchRoot as 4th argument to every mod.check() call.
// This is done by examining the source directly.
test('main() passes orchRoot as the fourth argument to each check module call (structural)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.resolve(__dirname, '../validate-orchestration.js'), 'utf-8');
  // Should contain mod.check(basePath, context, context.config, orchRoot)
  assert.ok(
    src.includes('mod.check(basePath, context, context.config, orchRoot)'),
    'Expected "mod.check(basePath, context, context.config, orchRoot)" in source'
  );
  // Should NOT contain the old 3-argument form
  assert.ok(
    !src.includes('mod.check(basePath, context, context.config)'),
    'Old 3-argument call form should not be present'
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

'use strict';
/**
 * Tests for the updated check modules accepting orchRoot as a 4th parameter.
 *
 * Verifies that each module uses orchRoot to construct its directory path
 * instead of the hardcoded '.github' string.
 *
 * Uses require-cache injection to isolate fs-helpers / frontmatter without
 * adding external dependencies.
 */

const assert = require('assert');
const path   = require('path');

// ─── Absolute paths for module cache keys ────────────────────────────────────

const fsHelpersPath    = require.resolve('../lib/utils/fs-helpers');
const frontmatterPath  = require.resolve('../lib/utils/frontmatter');
const structurePath    = require.resolve('../lib/checks/structure');
const agentsPath       = require.resolve('../lib/checks/agents');
const skillsPath       = require.resolve('../lib/checks/skills');
const instructionsPath = require.resolve('../lib/checks/instructions');
const promptsPath      = require.resolve('../lib/checks/prompts');
const crossRefsPath    = require.resolve('../lib/checks/cross-refs');

// ─── Mock factories ──────────────────────────────────────────────────────────

function makeFsHelpersMock({ isDirectory, exists, listFiles, listDirs, readFile } = {}) {
  return {
    id: fsHelpersPath,
    filename: fsHelpersPath,
    loaded: true,
    exports: {
      isDirectory: isDirectory || (() => false),
      exists:      exists      || (() => false),
      listFiles:   listFiles   || (() => []),
      listDirs:    listDirs    || (() => []),
      readFile:    readFile    || (() => null),
    },
  };
}

function makeFrontmatterMock() {
  return {
    id: frontmatterPath,
    filename: frontmatterPath,
    loaded: true,
    exports: {
      extractFrontmatter: () => ({ frontmatter: null, body: '' }),
    },
  };
}

// ─── Module loader with cache injection ──────────────────────────────────────

/**
 * Load (or reload) a check module with injected utility mocks.
 * @param {string}      modulePath  - Resolved path of the module to load
 * @param {object}      fsMock      - Module cache stub for fs-helpers
 * @param {object}      [fmMock]    - Module cache stub for frontmatter (optional)
 * @returns {Function} the module's export function
 */
function loadModule(modulePath, fsMock, fmMock) {
  delete require.cache[modulePath];

  require.cache[fsHelpersPath] = fsMock;
  if (fmMock) require.cache[frontmatterPath] = fmMock;

  const mod = require(modulePath);

  // Restore so real modules are unaffected by subsequent requires
  delete require.cache[fsHelpersPath];
  if (fmMock) delete require.cache[frontmatterPath];
  delete require.cache[modulePath];

  return mod;
}

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
  console.log('\ncheck-modules orchRoot unit tests\n');

  // ── structure.js ───────────────────────────────────────────────────────────

  // Test 1: checkStructure with orchRoot='.agents' — name fields use '.agents' prefix
  await test('checkStructure with orchRoot=".agents" uses ".agents" prefix in name fields', async () => {
    const fsMock = makeFsHelpersMock({ isDirectory: () => true, exists: () => true });
    const checkStructure = loadModule(structurePath, fsMock);

    const results = await checkStructure('/fake', {}, null, '.agents');

    assert.ok(results.length > 0, 'Expected at least one result');
    for (const r of results) {
      assert.ok(
        r.name === '.agents' || r.name.startsWith('.agents/'),
        `Expected name to start with ".agents" but got "${r.name}"`
      );
    }
  });

  // Test 2: checkStructure with orchRoot=undefined — falls back to '.github'
  await test('checkStructure with orchRoot=undefined falls back to ".github"', async () => {
    const fsMock = makeFsHelpersMock({ isDirectory: () => true, exists: () => true });
    const checkStructure = loadModule(structurePath, fsMock);

    const results = await checkStructure('/fake', {}, null, undefined);

    assert.ok(results.length > 0, 'Expected at least one result');
    for (const r of results) {
      assert.ok(
        r.name === '.github' || r.name.startsWith('.github/'),
        `Expected name to start with ".github" but got "${r.name}"`
      );
    }
  });

  // ── agents.js ──────────────────────────────────────────────────────────────

  // Test 3: checkAgents with orchRoot='.agents' — listFiles receives .agents/agents path
  await test('checkAgents with orchRoot=".agents" constructs path under ".agents/agents"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listFiles: (p) => { capturedPath = p; return []; },
    });
    const checkAgents = loadModule(agentsPath, fsMock, makeFrontmatterMock());

    await checkAgents('/fake', {}, null, '.agents');

    assert.ok(capturedPath !== null, 'listFiles should have been called');
    const expected = path.join('/fake', '.agents', 'agents');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // Test 4: checkAgents with orchRoot=undefined — falls back to .github/agents
  await test('checkAgents with orchRoot=undefined falls back to ".github/agents"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listFiles: (p) => { capturedPath = p; return []; },
    });
    const checkAgents = loadModule(agentsPath, fsMock, makeFrontmatterMock());

    await checkAgents('/fake', {}, null, undefined);

    assert.ok(capturedPath !== null, 'listFiles should have been called');
    const expected = path.join('/fake', '.github', 'agents');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // ── skills.js ──────────────────────────────────────────────────────────────

  // Test 5: checkSkills with orchRoot='.agents' — listDirs receives .agents/skills path
  await test('checkSkills with orchRoot=".agents" constructs path under ".agents/skills"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listDirs:  (p) => { capturedPath = p; return []; },
      listFiles: () => [],
    });
    const checkSkills = loadModule(skillsPath, fsMock, makeFrontmatterMock());

    await checkSkills('/fake', {}, null, '.agents');

    assert.ok(capturedPath !== null, 'listDirs should have been called');
    const expected = path.join('/fake', '.agents', 'skills');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // Test 6: checkSkills with orchRoot=undefined — falls back to .github/skills
  await test('checkSkills with orchRoot=undefined falls back to ".github/skills"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listDirs:  (p) => { capturedPath = p; return []; },
      listFiles: () => [],
    });
    const checkSkills = loadModule(skillsPath, fsMock, makeFrontmatterMock());

    await checkSkills('/fake', {}, null, undefined);

    assert.ok(capturedPath !== null, 'listDirs should have been called');
    const expected = path.join('/fake', '.github', 'skills');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // ── instructions.js ────────────────────────────────────────────────────────

  // Test 7: checkInstructions with orchRoot='.agents' — listFiles receives .agents/instructions path
  await test('checkInstructions with orchRoot=".agents" constructs path under ".agents/instructions"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listFiles: (p) => { capturedPath = p; return []; },
    });
    const checkInstructions = loadModule(instructionsPath, fsMock, makeFrontmatterMock());

    await checkInstructions('/fake', {}, null, '.agents');

    assert.ok(capturedPath !== null, 'listFiles should have been called');
    const expected = path.join('/fake', '.agents', 'instructions');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // Test 8: checkInstructions with orchRoot=undefined — falls back to .github/instructions
  await test('checkInstructions with orchRoot=undefined falls back to ".github/instructions"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listFiles: (p) => { capturedPath = p; return []; },
    });
    const checkInstructions = loadModule(instructionsPath, fsMock, makeFrontmatterMock());

    await checkInstructions('/fake', {}, null, undefined);

    assert.ok(capturedPath !== null, 'listFiles should have been called');
    const expected = path.join('/fake', '.github', 'instructions');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // ── prompts.js ─────────────────────────────────────────────────────────────

  // Test 9: checkPrompts with orchRoot='.agents' — listFiles receives .agents/prompts path
  await test('checkPrompts with orchRoot=".agents" constructs path under ".agents/prompts"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listFiles: (p) => { capturedPath = p; return []; },
    });
    const checkPrompts = loadModule(promptsPath, fsMock, makeFrontmatterMock());

    await checkPrompts('/fake', {}, null, '.agents');

    assert.ok(capturedPath !== null, 'listFiles should have been called');
    const expected = path.join('/fake', '.agents', 'prompts');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // Test 10: checkPrompts with orchRoot=undefined — falls back to .github/prompts
  await test('checkPrompts with orchRoot=undefined falls back to ".github/prompts"', async () => {
    let capturedPath = null;
    const fsMock = makeFsHelpersMock({
      listFiles: (p) => { capturedPath = p; return []; },
    });
    const checkPrompts = loadModule(promptsPath, fsMock, makeFrontmatterMock());

    await checkPrompts('/fake', {}, null, undefined);

    assert.ok(capturedPath !== null, 'listFiles should have been called');
    const expected = path.join('/fake', '.github', 'prompts');
    assert.strictEqual(capturedPath, expected,
      `Expected path "${expected}", got "${capturedPath}"`);
  });

  // ── cross-refs.js ──────────────────────────────────────────────────────────

  // Test 11: checkCrossRefs accepts 4 params without error
  await test('checkCrossRefs accepts 4 parameters without error', async () => {
    const fsMock = makeFsHelpersMock();
    const checkCrossRefs = loadModule(crossRefsPath, fsMock);

    const context = { agents: new Map(), skills: new Map(), config: null };
    const results = await checkCrossRefs('/fake', context, null, '.agents');

    assert.ok(Array.isArray(results), 'Expected results to be an array');
  });

  // Test 12: checkCrossRefs with orchRoot=undefined executes without error
  await test('checkCrossRefs with orchRoot=undefined executes without error', async () => {
    const fsMock = makeFsHelpersMock();
    const checkCrossRefs = loadModule(crossRefsPath, fsMock);

    const context = { agents: new Map(), skills: new Map(), config: null };
    const results = await checkCrossRefs('/fake', context, null, undefined);

    assert.ok(Array.isArray(results), 'Expected results to be an array');
  });

  // ─── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();

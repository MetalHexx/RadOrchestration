'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// ─── Mock Setup ─────────────────────────────────────────────────────────────

// Mock fs-helpers and frontmatter modules to avoid real file system access.
// Same cache-replacement pattern as agents.test.js.

let mockListFiles = () => [];
let mockReadFile = () => null;
let mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

const path = require('path');
const fsHelpersPath = require.resolve('../validate/lib/utils/fs-helpers');
const frontmatterPath = require.resolve('../validate/lib/utils/frontmatter');

// Save originals
const origFsHelpers = require(fsHelpersPath);

// Replace with proxies
require.cache[fsHelpersPath] = {
  id: fsHelpersPath,
  filename: fsHelpersPath,
  loaded: true,
  exports: {
    exists: (...args) => origFsHelpers.exists(...args),
    isDirectory: (...args) => origFsHelpers.isDirectory(...args),
    listFiles: (...args) => mockListFiles(...args),
    listDirs: (...args) => origFsHelpers.listDirs(...args),
    readFile: (...args) => mockReadFile(...args),
  }
};

require.cache[frontmatterPath] = {
  id: frontmatterPath,
  filename: frontmatterPath,
  loaded: true,
  exports: {
    extractFrontmatter: (...args) => mockExtractFrontmatter(...args),
  }
};

// Now require the module under test — it will pick up the mocked dependencies
const checkInstructions = require('../validate/lib/checks/instructions');

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

function makeFrontmatter(overrides = {}) {
  return {
    applyTo: 'custom/project-store/**',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('checkInstructions', () => {

  beforeEach(() => {
    // Reset mocks to defaults
    mockListFiles = () => [];
    mockReadFile = () => null;
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });
  });

  it('exports an async function', async () => {
    assert.strictEqual(typeof checkInstructions, 'function');
    const result = checkInstructions('/fake', makeContext());
    assert.ok(result instanceof Promise);
    await result;
  });

  it('empty directory — returns empty array, context.instructions = []', async () => {
    mockListFiles = () => [];
    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
    assert.ok(Array.isArray(ctx.instructions));
    assert.strictEqual(ctx.instructions.length, 0);
  });

  it('valid instruction file with applyTo — pass result, context populated', async () => {
    const fm = makeFrontmatter();
    mockListFiles = () => ['project-docs.instructions.md'];
    mockReadFile = () => 'file content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: 'body content' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].category, 'instructions');
    assert.strictEqual(results[0].name, 'project-docs.instructions.md');
    assert.strictEqual(results[0].status, 'pass');
    assert.strictEqual(ctx.instructions.length, 1);
    assert.strictEqual(ctx.instructions[0].filename, 'project-docs.instructions.md');
    assert.deepStrictEqual(ctx.instructions[0].frontmatter, fm);
  });

  it('missing applyTo field — fail result', async () => {
    const fm = makeFrontmatter({ applyTo: undefined });
    delete fm.applyTo;
    mockListFiles = () => ['bad.instructions.md'];
    mockReadFile = () => 'file content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('applyTo'));
    assert.strictEqual(fails[0].detail.found, 'undefined');
    // Still added to context
    assert.strictEqual(ctx.instructions.length, 1);
  });

  it('empty applyTo field — fail result', async () => {
    const fm = makeFrontmatter({ applyTo: '' });
    mockListFiles = () => ['bad.instructions.md'];
    mockReadFile = () => 'file content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('applyTo'));
    assert.strictEqual(ctx.instructions.length, 1);
  });

  it('whitespace-only applyTo field — fail result', async () => {
    const fm = makeFrontmatter({ applyTo: '   ' });
    mockListFiles = () => ['bad.instructions.md'];
    mockReadFile = () => 'file content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('applyTo'));
  });

  it('no frontmatter (returns null) — fail result', async () => {
    mockListFiles = () => ['no-fm.instructions.md'];
    mockReadFile = () => 'some content with no frontmatter';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: 'some content' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.ok(results[0].message.includes('frontmatter'));
    // Still added to context with null frontmatter
    assert.strictEqual(ctx.instructions.length, 1);
    assert.strictEqual(ctx.instructions[0].frontmatter, null);
  });

  it('unreadable file (readFile returns null) — fail result', async () => {
    mockListFiles = () => ['unreadable.instructions.md'];
    mockReadFile = () => null;

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.ok(results[0].message.includes('Could not read'));
    // Still added to context
    assert.strictEqual(ctx.instructions.length, 1);
    assert.strictEqual(ctx.instructions[0].frontmatter, null);
  });

  it('multiple instruction files — all validated, all added to context', async () => {
    const fm1 = makeFrontmatter({ applyTo: 'custom/project-store/**' });
    const fm2 = makeFrontmatter({ applyTo: '**/state.json' });

    let callCount = 0;
    mockListFiles = () => ['project-docs.instructions.md', 'coding-standards.instructions.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => {
      callCount++;
      return { frontmatter: callCount === 1 ? fm1 : fm2, body: '' };
    };

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.status === 'pass'));
    assert.ok(results.every(r => r.category === 'instructions'));
    assert.strictEqual(ctx.instructions.length, 2);
    assert.strictEqual(ctx.instructions[0].filename, 'project-docs.instructions.md');
    assert.strictEqual(ctx.instructions[1].filename, 'coding-standards.instructions.md');
  });

  it('unexpected thrown error — returns fail result (no crash)', async () => {
    mockListFiles = () => { throw new Error('Simulated explosion'); };

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.strictEqual(results[0].category, 'instructions');
    assert.ok(results[0].message.includes('Simulated explosion'));
  });

  it('all results have category set to "instructions"', async () => {
    const fm = makeFrontmatter();
    mockListFiles = () => ['a.instructions.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    for (const r of results) {
      assert.strictEqual(r.category, 'instructions');
    }
  });

  // ── Edge case: empty content file ─────────────────────────────────────

  it('empty content file — fail for no frontmatter', async () => {
    mockListFiles = () => ['empty.instructions.md'];
    mockReadFile = () => '';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for no frontmatter');
    assert.strictEqual(ctx.instructions.length, 1);
    assert.strictEqual(ctx.instructions[0].frontmatter, null);
  });

  // ── Edge case: corrupt frontmatter ────────────────────────────────────

  it('corrupt frontmatter — fail for no valid frontmatter', async () => {
    mockListFiles = () => ['corrupt.instructions.md'];
    mockReadFile = () => '---\n:::broken:::\n---\n';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkInstructions('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for corrupt frontmatter');
    assert.strictEqual(ctx.instructions.length, 1);
    assert.strictEqual(ctx.instructions[0].frontmatter, null);
  });

  // ── checkApplyToSync via checkInstructions ────────────────────────────

  describe('checkApplyToSync via checkInstructions', () => {

    beforeEach(() => {
      mockListFiles = () => [];
      mockReadFile = () => null;
      mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });
    });

    function makeConfig(overrides = {}) {
      return { projects: { base_path: 'custom/project-store', ...overrides } };
    }

    it('mismatch detected — warns with actual, expected applyTo and configure-system text', async () => {
      const fm = makeFrontmatter({ applyTo: '.github/projects/**' });
      mockListFiles = () => ['project-docs.instructions.md'];
      mockReadFile = () => 'file content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

      const ctx = makeContext();
      const config = makeConfig();
      const results = await checkInstructions('/fake', ctx, config);

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 1, 'Should have exactly one warn result');
      assert.ok(warns[0].message.includes('.github/projects/**'), 'Should include actual applyTo');
      assert.ok(warns[0].message.includes('custom/project-store/**'), 'Should include expected applyTo');
      assert.ok(warns[0].message.includes('configure-system'), 'Should mention configure-system');
    });

    it('match (silent pass) — zero warn results when applyTo matches base_path', async () => {
      const fm = makeFrontmatter({ applyTo: 'custom/project-store/**' });
      mockListFiles = () => ['project-docs.instructions.md'];
      mockReadFile = () => 'file content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

      const ctx = makeContext();
      const config = makeConfig();
      const results = await checkInstructions('/fake', ctx, config);

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 0, 'Should have zero warn results');
      const passes = results.filter(r => r.status === 'pass');
      assert.ok(passes.length >= 1, 'Should have at least one pass result');
    });

    it('missing config (null) — zero warn results, no error thrown', async () => {
      const fm = makeFrontmatter({ applyTo: '.github/projects/**' });
      mockListFiles = () => ['project-docs.instructions.md'];
      mockReadFile = () => 'file content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

      const ctx = makeContext();
      const results = await checkInstructions('/fake', ctx, null);

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 0, 'Should have zero warn results when config is null');
    });

    it('missing projects.base_path in config — zero warn results, no error thrown', async () => {
      const fm = makeFrontmatter({ applyTo: '.github/projects/**' });
      mockListFiles = () => ['project-docs.instructions.md'];
      mockReadFile = () => 'file content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

      const ctx = makeContext();
      const results = await checkInstructions('/fake', ctx, {});

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 0, 'Should have zero warn results when config has no projects.base_path');
    });

    it('non-project-docs file ignored — zero warn results even with mismatch', async () => {
      const fm = makeFrontmatter({ applyTo: '.github/projects/**' });
      mockListFiles = () => ['coding-standards.instructions.md'];
      mockReadFile = () => 'file content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

      const ctx = makeContext();
      const config = makeConfig();
      const results = await checkInstructions('/fake', ctx, config);

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 0, 'Should have zero warn results for non-project-docs files');
    });

    it('trailing slash normalization — no false positive when base_path has trailing slash', async () => {
      const fm = makeFrontmatter({ applyTo: 'custom/project-store/**' });
      mockListFiles = () => ['project-docs.instructions.md'];
      mockReadFile = () => 'file content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

      const ctx = makeContext();
      const config = makeConfig({ base_path: 'custom/project-store/' });
      const results = await checkInstructions('/fake', ctx, config);

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 0, 'Should have zero warn results with trailing slash normalization');
    });

    it('whitespace-only applyTo with config — both fail and warn coexist', async () => {
      const fm = makeFrontmatter({ applyTo: '   ' });
      mockListFiles = () => ['project-docs.instructions.md'];
      mockReadFile = () => 'file content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

      const ctx = makeContext();
      const config = makeConfig();
      const results = await checkInstructions('/fake', ctx, config);

      const fails = results.filter(r => r.status === 'fail');
      const warns = results.filter(r => r.status === 'warn');
      assert.ok(fails.length >= 1, 'Should have a fail result for whitespace-only applyTo');
      assert.ok(warns.length >= 1, 'Should have a warn result from sync check (applyTo is truthy)');
    });
  });
});

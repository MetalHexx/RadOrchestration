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
const checkPrompts = require('../validate/lib/checks/prompts');

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
    description: 'Configure the orchestration system for a workspace',
    tools: ['read', 'edit', 'search'],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('checkPrompts', () => {

  beforeEach(() => {
    // Reset mocks to defaults
    mockListFiles = () => [];
    mockReadFile = () => null;
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });
  });

  it('exports an async function', async () => {
    assert.strictEqual(typeof checkPrompts, 'function');
    const result = checkPrompts('/fake', makeContext());
    assert.ok(result instanceof Promise);
    await result;
  });

  it('empty directory — returns empty array, context.prompts = []', async () => {
    mockListFiles = () => [];
    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
    assert.ok(Array.isArray(ctx.prompts));
    assert.strictEqual(ctx.prompts.length, 0);
  });

  it('valid prompt file with description and valid tools — pass result, context populated', async () => {
    const fm = makeFrontmatter();
    mockListFiles = () => ['configure-system.prompt.md'];
    mockReadFile = () => 'file content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: 'body content' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].category, 'prompts');
    assert.strictEqual(results[0].name, 'configure-system.prompt.md');
    assert.strictEqual(results[0].status, 'pass');
    assert.strictEqual(ctx.prompts.length, 1);
    assert.strictEqual(ctx.prompts[0].filename, 'configure-system.prompt.md');
    assert.deepStrictEqual(ctx.prompts[0].frontmatter, fm);
  });

  it('missing description field — fail result', async () => {
    const fm = makeFrontmatter({ description: undefined });
    delete fm.description;
    mockListFiles = () => ['bad.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('description'));
    assert.strictEqual(fails[0].detail.found, 'undefined');
    // Still added to context
    assert.strictEqual(ctx.prompts.length, 1);
  });

  it('empty description field — fail result', async () => {
    const fm = makeFrontmatter({ description: '' });
    mockListFiles = () => ['bad.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('description'));
  });

  it('valid prompt without tools field — pass (tools are optional)', async () => {
    const fm = makeFrontmatter({ tools: undefined });
    delete fm.tools;
    mockListFiles = () => ['no-tools.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'pass');
    assert.strictEqual(ctx.prompts.length, 1);
  });

  it('invalid tool name in tools array — fail result with detail', async () => {
    const fm = makeFrontmatter({ tools: ['read', 'invalidToolXYZ'] });
    mockListFiles = () => ['bad-tool.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('invalidToolXYZ'));
    assert.ok(fails[0].detail.context.includes('Valid toolsets'));
    // Still added to context
    assert.strictEqual(ctx.prompts.length, 1);
  });

  it('multiple invalid tools — multiple fail results', async () => {
    const fm = makeFrontmatter({ tools: ['badTool1', 'badTool2', 'read'] });
    mockListFiles = () => ['multi-bad.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 2);
    assert.ok(fails[0].message.includes('badTool1'));
    assert.ok(fails[1].message.includes('badTool2'));
  });

  it('valid toolset name in tools — pass', async () => {
    const fm = makeFrontmatter({ tools: ['read', 'edit', 'search', 'execute', 'web', 'todo', 'agent', 'vscode'] });
    mockListFiles = () => ['all-toolsets.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'pass');
  });

  it('valid namespaced tool in tools — pass', async () => {
    const fm = makeFrontmatter({ tools: ['web/fetch', 'read/readFile', 'execute/runInTerminal'] });
    mockListFiles = () => ['namespaced.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'pass');
  });

  it('no frontmatter (returns null) — fail result', async () => {
    mockListFiles = () => ['no-fm.prompt.md'];
    mockReadFile = () => 'some content with no frontmatter';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: 'some content' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.ok(results[0].message.includes('frontmatter'));
    assert.strictEqual(ctx.prompts.length, 1);
    assert.strictEqual(ctx.prompts[0].frontmatter, null);
  });

  it('unreadable file (readFile returns null) — fail result', async () => {
    mockListFiles = () => ['unreadable.prompt.md'];
    mockReadFile = () => null;

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.ok(results[0].message.includes('Could not read'));
    assert.strictEqual(ctx.prompts.length, 1);
    assert.strictEqual(ctx.prompts[0].frontmatter, null);
  });

  it('multiple prompt files — all validated, all added to context', async () => {
    const fm1 = makeFrontmatter({ description: 'First prompt' });
    const fm2 = makeFrontmatter({ description: 'Second prompt', tools: ['edit'] });

    let callCount = 0;
    mockListFiles = () => ['first.prompt.md', 'second.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => {
      callCount++;
      return { frontmatter: callCount === 1 ? fm1 : fm2, body: '' };
    };

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.status === 'pass'));
    assert.ok(results.every(r => r.category === 'prompts'));
    assert.strictEqual(ctx.prompts.length, 2);
    assert.strictEqual(ctx.prompts[0].filename, 'first.prompt.md');
    assert.strictEqual(ctx.prompts[1].filename, 'second.prompt.md');
  });

  it('unexpected thrown error — returns fail result (no crash)', async () => {
    mockListFiles = () => { throw new Error('Simulated explosion'); };

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'fail');
    assert.strictEqual(results[0].category, 'prompts');
    assert.ok(results[0].message.includes('Simulated explosion'));
  });

  it('tools field is a string — treated as single-element array', async () => {
    const fm = makeFrontmatter({ tools: 'read' });
    mockListFiles = () => ['string-tool.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'pass');
  });

  it('tools field is not an array or string — fail result', async () => {
    const fm = makeFrontmatter({ tools: 42 });
    mockListFiles = () => ['bad-type.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('tools'));
  });

  it('all results have category set to "prompts"', async () => {
    const fm = makeFrontmatter();
    mockListFiles = () => ['a.prompt.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    for (const r of results) {
      assert.strictEqual(r.category, 'prompts');
    }
  });

  // ── Edge case: empty content file ─────────────────────────────────────

  it('empty content file — fail for no frontmatter', async () => {
    mockListFiles = () => ['empty.prompt.md'];
    mockReadFile = () => '';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for no frontmatter');
    assert.strictEqual(ctx.prompts.length, 1);
    assert.strictEqual(ctx.prompts[0].frontmatter, null);
  });

  // ── Edge case: corrupt frontmatter ────────────────────────────────────

  it('corrupt frontmatter — fail for no valid frontmatter', async () => {
    mockListFiles = () => ['corrupt.prompt.md'];
    mockReadFile = () => '---\n:::broken:::\n---\n';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkPrompts('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for corrupt frontmatter');
    assert.strictEqual(ctx.prompts.length, 1);
    assert.strictEqual(ctx.prompts[0].frontmatter, null);
  });
});

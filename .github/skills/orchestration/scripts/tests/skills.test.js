'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// ─── Mock Setup ─────────────────────────────────────────────────────────────

// Mock fs-helpers and frontmatter modules to avoid real file system access.
// Same cache-replacement pattern as agents.test.js.

let mockListDirs = () => [];
let mockListFiles = () => [];
let mockReadFile = () => null;
let mockExists = () => false;
let mockIsDirectory = () => false;
let mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

const path = require('path');
const fsHelpersPath = require.resolve('../validate/lib/utils/fs-helpers');
const frontmatterPath = require.resolve('../validate/lib/utils/frontmatter');

// Replace with proxies
require.cache[fsHelpersPath] = {
  id: fsHelpersPath,
  filename: fsHelpersPath,
  loaded: true,
  exports: {
    exists: (...args) => mockExists(...args),
    isDirectory: (...args) => mockIsDirectory(...args),
    listFiles: (...args) => mockListFiles(...args),
    listDirs: (...args) => mockListDirs(...args),
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
const checkSkills = require('../validate/lib/checks/skills');

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
    name: 'create-prd',
    description: 'Create a Product Requirements Document from research findings. Use when building a PRD or defining requirements.',
    ...overrides,
  };
}

function makeBody(templateLinks = []) {
  if (templateLinks.length === 0) return '# Skill\n\nSome content.\n';
  const lines = templateLinks.map(t => `- [${path.basename(t)}](${t})`);
  return `# Skill\n\nSome content.\n\n## Template\n\n${lines.join('\n')}\n`;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('checkSkills', () => {

  beforeEach(() => {
    // Reset mocks to defaults
    mockListDirs = () => [];
    mockListFiles = () => [];
    mockReadFile = () => null;
    mockExists = () => false;
    mockIsDirectory = () => false;
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });
  });

  it('exports an async function', async () => {
    assert.strictEqual(typeof checkSkills, 'function');
    const result = checkSkills('/fake', makeContext());
    assert.ok(result instanceof Promise);
    await result;
  });

  it('no skills directory — returns empty results, context.skills is empty Map', async () => {
    mockListDirs = () => [];
    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
    assert.ok(ctx.skills instanceof Map);
    assert.strictEqual(ctx.skills.size, 0);
  });

  it('valid skill — 1 pass result, context.skills populated with correct SkillInfo', async () => {
    const fm = makeFrontmatter();
    const body = makeBody(['./templates/PRD.md']);

    mockListDirs = () => ['create-prd'];
    mockReadFile = () => 'file content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body });
    mockIsDirectory = () => true;
    mockExists = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const passes = results.filter(r => r.status === 'pass');
    assert.strictEqual(passes.length, 1);
    assert.strictEqual(passes[0].category, 'skills');
    assert.strictEqual(passes[0].name, 'create-prd');
    assert.strictEqual(passes[0].message, 'Valid skill');

    // Check context.skills populated
    assert.ok(ctx.skills.has('create-prd'));
    const info = ctx.skills.get('create-prd');
    assert.strictEqual(info.folderName, 'create-prd');
    assert.deepStrictEqual(info.frontmatter, fm);
    assert.strictEqual(info.hasTemplates, true);
    assert.deepStrictEqual(info.templateLinks, ['./templates/PRD.md']);
  });

  it('missing SKILL.md — 1 fail result', async () => {
    mockListDirs = () => ['broken-skill'];
    mockReadFile = () => null;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('Missing SKILL.md'));
    assert.strictEqual(fails[0].name, 'broken-skill');
  });

  it('null frontmatter (no frontmatter block) — 1 fail result', async () => {
    mockListDirs = () => ['bad-skill'];
    mockReadFile = () => 'some content without frontmatter';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('No frontmatter found'));
  });

  it('missing name field — 1 fail result', async () => {
    const fm = makeFrontmatter({ name: undefined });
    mockListDirs = () => ['some-skill'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.some(r => r.message.includes('Missing required field: name')));
  });

  it('missing description field — 1 fail result', async () => {
    const fm = makeFrontmatter({ name: 'some-skill', description: undefined });
    mockListDirs = () => ['some-skill'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.some(r => r.message.includes('Missing required field: description')));
  });

  it('name-folder mismatch — 1 fail result with detail showing expected vs found', async () => {
    const fm = makeFrontmatter({ name: 'wrong-name' });
    mockListDirs = () => ['create-prd'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.message.includes('does not match'));
    assert.strictEqual(fails.length, 1);
    assert.strictEqual(fails[0].detail.expected, 'create-prd');
    assert.strictEqual(fails[0].detail.found, 'wrong-name');
  });

  it('description too short (< 50 chars) — 1 warn result', async () => {
    const fm = makeFrontmatter({ name: 'short-desc', description: 'Too short.' });
    mockListDirs = () => ['short-desc'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const warns = results.filter(r => r.status === 'warn');
    assert.strictEqual(warns.length, 1);
    assert.ok(warns[0].message.includes('Description length outside recommended range'));
    assert.strictEqual(warns[0].detail.expected, '50-200 characters');
  });

  it('description too long (> 200 chars) — 1 warn result', async () => {
    const longDesc = 'A'.repeat(201);
    const fm = makeFrontmatter({ name: 'long-desc', description: longDesc });
    mockListDirs = () => ['long-desc'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const warns = results.filter(r => r.status === 'warn');
    assert.strictEqual(warns.length, 1);
    assert.ok(warns[0].detail.found.includes('201'));
  });

  it('description in range (50-200 chars) — no warn', async () => {
    const goodDesc = 'A'.repeat(100);
    const fm = makeFrontmatter({ name: 'good-desc', description: goodDesc });
    mockListDirs = () => ['good-desc'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const warns = results.filter(r => r.status === 'warn');
    assert.strictEqual(warns.length, 0);
  });

  it('missing templates/ for non-exempt skill — 1 fail result', async () => {
    const fm = makeFrontmatter({ name: 'create-prd' });
    mockListDirs = () => ['create-prd'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => false; // templates/ does not exist

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.message.includes('Missing templates/'));
    assert.strictEqual(fails.length, 1);
  });

  it('missing templates/ for run-tests (exempt) — no fail result', async () => {
    const fm = makeFrontmatter({ name: 'run-tests', description: 'A'.repeat(100) });
    mockListDirs = () => ['run-tests'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => false; // no templates/ — but exempt

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const templateFails = results.filter(r => r.message.includes('Missing templates/'));
    assert.strictEqual(templateFails.length, 0, 'run-tests should be exempt from templates check');
  });

  it('template link resolves to existing file — no fail', async () => {
    const fm = makeFrontmatter({ name: 'create-prd' });
    const body = makeBody(['./templates/PRD.md']);

    mockListDirs = () => ['create-prd'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body });
    mockIsDirectory = () => true;
    mockExists = () => true; // template file exists

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const linkFails = results.filter(r => r.message.includes('Broken template link'));
    assert.strictEqual(linkFails.length, 0);
  });

  it('template link resolves to non-existing file — 1 fail result', async () => {
    const fm = makeFrontmatter({ name: 'create-prd' });
    const body = makeBody(['./templates/MISSING.md']);

    mockListDirs = () => ['create-prd'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body });
    mockIsDirectory = () => true;
    mockExists = () => false; // template file does NOT exist

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const linkFails = results.filter(r => r.message.includes('Broken template link'));
    assert.strictEqual(linkFails.length, 1);
    assert.strictEqual(linkFails[0].detail.expected, 'file exists');
    assert.strictEqual(linkFails[0].detail.found, './templates/MISSING.md');
  });

  it('multiple skills — results for each, context.skills has all entries', async () => {
    const fm1 = makeFrontmatter({ name: 'skill-a', description: 'A'.repeat(100) });
    const fm2 = makeFrontmatter({ name: 'skill-b', description: 'B'.repeat(100) });
    let callIndex = 0;

    mockListDirs = () => ['skill-a', 'skill-b'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => {
      const fm = callIndex === 0 ? fm1 : fm2;
      callIndex++;
      return { frontmatter: fm, body: '' };
    };
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const passes = results.filter(r => r.status === 'pass');
    assert.strictEqual(passes.length, 2, `Expected 2 passes, got ${passes.length}`);
    assert.strictEqual(ctx.skills.size, 2);
    assert.ok(ctx.skills.has('skill-a'));
    assert.ok(ctx.skills.has('skill-b'));
  });

  it('all results have category "skills"', async () => {
    const fm = makeFrontmatter({ name: 'wrong-name' });
    mockListDirs = () => ['create-prd'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });
    mockIsDirectory = () => true;

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    for (const r of results) {
      assert.strictEqual(r.category, 'skills', `Result "${r.name}" has wrong category: ${r.category}`);
    }
  });

  it('function never throws — wraps errors in try/catch, returns fail result', async () => {
    let threw = false;
    try {
      const results = await checkSkills(null, {});
      assert.ok(Array.isArray(results));
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Function should never throw');
  });

  // ── Anomaly detection — bare files ──────────────────────────────────────

  describe('Anomaly detection — bare files', () => {

    it('warns on bare files in skills directory', async () => {
      mockListFiles = () => ['create-skill'];
      mockListDirs = () => [];

      const ctx = makeContext();
      const results = await checkSkills('/fake', ctx);

      const warns = results.filter(r => r.status === 'warn');
      assert.ok(warns.length >= 1, 'Expected at least one warn result');

      const csWarn = warns.find(r => r.name === 'create-skill');
      assert.ok(csWarn, 'Expected warn for create-skill');
      assert.ok(csWarn.message.includes('Bare file'), `Message should contain "Bare file", got: ${csWarn.message}`);
      assert.strictEqual(csWarn.detail.expected, 'Skill directory containing SKILL.md');
      assert.strictEqual(csWarn.detail.found, 'Bare file: create-skill');
    });

    it('no warnings when no bare files', async () => {
      mockListFiles = () => [];
      mockListDirs = () => [];

      const ctx = makeContext();
      const results = await checkSkills('/fake', ctx);

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 0);
    });

    it('warns on multiple bare files', async () => {
      mockListFiles = () => ['file-a', 'file-b'];
      mockListDirs = () => [];

      const ctx = makeContext();
      const results = await checkSkills('/fake', ctx);

      const warns = results.filter(r => r.status === 'warn');
      assert.strictEqual(warns.length, 2);

      const names = warns.map(r => r.name).sort();
      assert.deepStrictEqual(names, ['file-a', 'file-b']);
    });

  });

  // ── Category filter — silent prerequisites ─────────────────────────────

  describe('Category filter — silent prerequisites', () => {

    it('populates context.skills map for valid skills', async () => {
      const fm = makeFrontmatter({ name: 'my-skill', description: 'A'.repeat(100) });
      const body = makeBody(['./templates/PRD.md']);

      mockListDirs = () => ['my-skill'];
      mockReadFile = () => 'content';
      mockExtractFrontmatter = () => ({ frontmatter: fm, body });
      mockIsDirectory = () => true;
      mockExists = () => true;

      const ctx = makeContext();
      await checkSkills('/fake', ctx);

      assert.ok(ctx.skills.has('my-skill'), 'context.skills should have my-skill');
      const info = ctx.skills.get('my-skill');
      assert.strictEqual(info.folderName, 'my-skill');
      assert.deepStrictEqual(info.frontmatter, fm);
      assert.strictEqual(info.hasTemplates, true);
      assert.deepStrictEqual(info.templateLinks, ['./templates/PRD.md']);
    });

  });

  // ── Edge case: empty SKILL.md content ───────────────────────────────────

  it('empty SKILL.md content — fail for no frontmatter', async () => {
    mockListDirs = () => ['empty-skill'];
    mockReadFile = () => '';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for no frontmatter');
  });

  // ── Edge case: corrupt frontmatter in SKILL.md ─────────────────────────

  it('corrupt frontmatter in SKILL.md — fail for no valid frontmatter', async () => {
    mockListDirs = () => ['corrupt-skill'];
    mockReadFile = () => '---\n:::broken:::\n---\n';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkSkills('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for corrupt frontmatter');
  });

  // ── Edge case: null basePath — catch block result includes detail ──────

  it('null basePath — catch block result includes detail with expected and found', async () => {
    const ctx = makeContext();
    const results = await checkSkills(null, ctx);

    assert.ok(Array.isArray(results), 'Should return an array');
    assert.ok(results.length >= 1, 'Should have at least one result');
    const fail = results.find(r => r.status === 'fail');
    assert.ok(fail, 'Should have a fail result');
    assert.ok(fail.detail, 'Fail result should have detail object');
    assert.ok(typeof fail.detail.expected === 'string', 'detail.expected should be a string');
    assert.ok(typeof fail.detail.found === 'string', 'detail.found should be a string');
  });
});

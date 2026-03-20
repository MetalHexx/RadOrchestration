'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// ─── Mock Setup ─────────────────────────────────────────────────────────────

// We mock the fs-helpers and frontmatter modules to avoid real file system access.
// node:test mock.module is experimental; instead we'll use a manual approach by
// manipulating the require cache.

let mockListFiles = () => [];
let mockReadFile = () => null;
let mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

// Intercept requires by replacing the module in the cache
const path = require('path');
const fsHelpersPath = require.resolve('../validate/lib/utils/fs-helpers');
const frontmatterPath = require.resolve('../validate/lib/utils/frontmatter');

// Save originals
const origFsHelpers = require(fsHelpersPath);
const origFrontmatter = require(frontmatterPath);

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
const checkAgents = require('../validate/lib/checks/agents');

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
    name: 'TestAgent',
    description: 'A test agent',
    tools: ['read', 'search'],
    agents: [],
    ...overrides,
  };
}

function makeBody(skillNames = []) {
  if (skillNames.length === 0) return '# Test Agent\n\nSome content.';
  const lines = skillNames.map(s => `- **\`${s}\`**: Description for ${s}`);
  return `# Test Agent\n\nSome content.\n\n## Skills\n\n${lines.join('\n')}\n`;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('checkAgents', () => {

  beforeEach(() => {
    // Reset mocks to defaults
    mockListFiles = () => [];
    mockReadFile = () => null;
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });
  });

  it('exports an async function', async () => {
    assert.strictEqual(typeof checkAgents, 'function');
    const result = checkAgents('/fake', makeContext());
    assert.ok(result instanceof Promise);
    await result;
  });

  it('no agents directory — returns empty results, context.agents is empty Map', async () => {
    mockListFiles = () => [];
    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
    assert.ok(ctx.agents instanceof Map);
    assert.strictEqual(ctx.agents.size, 0);
  });

  it('valid agent file — 1 pass result, context.agents populated', async () => {
    const fm = makeFrontmatter();
    const body = makeBody(['create-prd', 'run-tests']);

    mockListFiles = () => ['test.agent.md'];
    mockReadFile = () => 'file content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const passes = results.filter(r => r.status === 'pass');
    assert.strictEqual(passes.length, 1);
    assert.strictEqual(passes[0].category, 'agents');
    assert.strictEqual(passes[0].name, 'test.agent.md');

    // Check context.agents populated
    assert.ok(ctx.agents.has('test.agent.md'));
    const info = ctx.agents.get('test.agent.md');
    assert.strictEqual(info.filename, 'test.agent.md');
    assert.deepStrictEqual(info.tools, ['read', 'search']);
    assert.deepStrictEqual(info.agents, []);
    assert.deepStrictEqual(info.referencedSkills, ['create-prd', 'run-tests']);
  });

  it('missing required fields — 3 fail results', async () => {
    const fm = { 'argument-hint': 'test' }; // missing name, description, tools — agents also missing
    mockListFiles = () => ['bad.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    // name, description, tools, agents = 4 fail results
    assert.ok(fails.length >= 3, `Expected at least 3 fails, got ${fails.length}`);
    const messages = fails.map(r => r.message);
    assert.ok(messages.some(m => m.includes('name')), 'Should fail for missing name');
    assert.ok(messages.some(m => m.includes('description')), 'Should fail for missing description');
    assert.ok(messages.some(m => m.includes('tools')), 'Should fail for missing tools');
  });

  it('empty required fields — fail results for empty name, description, tools', async () => {
    const fm = makeFrontmatter({ name: '', description: '', tools: [] });
    mockListFiles = () => ['empty.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 3, `Expected at least 3 fails, got ${fails.length}`);
    const messages = fails.map(r => r.message);
    assert.ok(messages.some(m => m.includes('name')), 'Should fail for empty name');
    assert.ok(messages.some(m => m.includes('description')), 'Should fail for empty description');
    assert.ok(messages.some(m => m.includes('tools')), 'Should fail for empty tools');
  });

  it('invalid tool name — 1 fail result with detail', async () => {
    const fm = makeFrontmatter({ tools: ['read', 'invalidTool'] });
    mockListFiles = () => ['inv.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1, `Expected 1 fail, got ${fails.length}`);
    assert.ok(fails[0].message.includes('invalidTool'));
    assert.ok(fails[0].detail);
    assert.strictEqual(fails[0].detail.expected, 'a valid toolset or namespaced tool');
    assert.strictEqual(fails[0].detail.found, 'invalidTool');
    assert.ok(fails[0].detail.context.includes('Valid toolsets'));
  });

  it('deprecated tool name — 1 warn result', async () => {
    const fm = makeFrontmatter({ tools: ['read', 'readFile'] });
    mockListFiles = () => ['dep.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const warns = results.filter(r => r.status === 'warn');
    assert.strictEqual(warns.length, 1, `Expected 1 warn, got ${warns.length}`);
    assert.ok(warns[0].message.includes('readFile'));
    assert.ok(warns[0].detail);
    assert.strictEqual(warns[0].detail.expected, 'a current tool name');
    assert.strictEqual(warns[0].detail.found, 'readFile');
  });

  it('namespaced tool — no fail/warn for tools', async () => {
    const fm = makeFrontmatter({ tools: ['read', 'web/fetch'] });
    mockListFiles = () => ['ns.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const toolIssues = results.filter(r =>
      (r.status === 'fail' || r.status === 'warn') && r.message.includes('tool')
    );
    assert.strictEqual(toolIssues.length, 0, `Expected no tool issues, got ${toolIssues.length}`);
  });

  it('non-Orchestrator with non-empty agents — fail', async () => {
    const fm = makeFrontmatter({ name: 'Coder', agents: ['Research'], tools: ['read', 'agent'] });
    mockListFiles = () => ['coder.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Expected at least 1 fail');
    assert.ok(fails.some(r => r.message.includes('Orchestrator')), 'Should mention Orchestrator restriction');
  });

  it('non-empty agents without agent toolset — fail', async () => {
    const fm = makeFrontmatter({ name: 'Orchestrator', agents: ['Research'], tools: ['read', 'search'] });
    mockListFiles = () => ['orchestrator.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Expected at least 1 fail');
    assert.ok(fails.some(r => r.message.includes('agent')), 'Should mention missing agent toolset');
  });

  it('Orchestrator with valid agents — no agents-array fail', async () => {
    const fm = makeFrontmatter({
      name: 'Orchestrator',
      tools: ['read', 'search', 'agent'],
      agents: ['Research', 'Coder']
    });
    mockListFiles = () => ['orchestrator.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const agentFails = results.filter(r =>
      r.status === 'fail' && (r.message.includes('agents') || r.message.includes('Orchestrator'))
    );
    assert.strictEqual(agentFails.length, 0, `Expected no agent-related fails, got ${agentFails.length}`);
  });

  it('malformed file — null content — 1 fail, no crash', async () => {
    mockListFiles = () => ['broken.agent.md'];
    mockReadFile = () => null;

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    assert.ok(results.length >= 1);
    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('Could not read file'));
  });

  it('malformed file — no frontmatter — 1 fail, no crash', async () => {
    mockListFiles = () => ['nofm.agent.md'];
    mockReadFile = () => 'some content without frontmatter';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    assert.ok(results.length >= 1);
    const fails = results.filter(r => r.status === 'fail');
    assert.strictEqual(fails.length, 1);
    assert.ok(fails[0].message.includes('No valid frontmatter'));
  });

  it('skills parsing — extracts skill names from ## Skills section', async () => {
    const fm = makeFrontmatter();
    const body = '# Agent\n\n## Skills\n\n- **`create-prd`**: Creates PRDs\n- **`run-tests`**: Runs tests\n';
    mockListFiles = () => ['skills.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body });

    const ctx = makeContext();
    await checkAgents('/fake', ctx);

    assert.ok(ctx.agents.has('skills.agent.md'));
    const info = ctx.agents.get('skills.agent.md');
    assert.deepStrictEqual(info.referencedSkills, ['create-prd', 'run-tests']);
  });

  it('multiple agents — 2 pass results, context.agents has 2 entries', async () => {
    const fm1 = makeFrontmatter({ name: 'Agent1' });
    const fm2 = makeFrontmatter({ name: 'Agent2' });
    const files = ['agent1.agent.md', 'agent2.agent.md'];
    let callIndex = 0;

    mockListFiles = () => files;
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => {
      const fm = callIndex === 0 ? fm1 : fm2;
      callIndex++;
      return { frontmatter: fm, body: '' };
    };

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const passes = results.filter(r => r.status === 'pass');
    assert.strictEqual(passes.length, 2, `Expected 2 passes, got ${passes.length}`);
    assert.strictEqual(ctx.agents.size, 2);
    assert.ok(ctx.agents.has('agent1.agent.md'));
    assert.ok(ctx.agents.has('agent2.agent.md'));
  });

  it('all results have category "agents"', async () => {
    const fm = makeFrontmatter({ tools: ['read', 'invalidTool'] });
    mockListFiles = () => ['cat.agent.md'];
    mockReadFile = () => 'content';
    mockExtractFrontmatter = () => ({ frontmatter: fm, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    for (const r of results) {
      assert.strictEqual(r.category, 'agents', `Result "${r.name}" has wrong category: ${r.category}`);
    }
  });

  it('never throws — wraps errors in try/catch', async () => {
    let threw = false;
    try {
      const results = await checkAgents(null, {});
      assert.ok(Array.isArray(results));
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Function should never throw');
  });

  // ── Edge case: empty content ──────────────────────────────────────────

  it('empty content (readFile returns empty string) — fail for no frontmatter', async () => {
    mockListFiles = () => ['empty-content.agent.md'];
    mockReadFile = () => '';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for no frontmatter');
  });

  // ── Edge case: corrupt frontmatter ────────────────────────────────────

  it('corrupt frontmatter (garbage YAML) — fail for no valid frontmatter', async () => {
    mockListFiles = () => ['corrupt.agent.md'];
    mockReadFile = () => '---\n:::broken:::\n---\n';
    mockExtractFrontmatter = () => ({ frontmatter: null, body: '' });

    const ctx = makeContext();
    const results = await checkAgents('/fake', ctx);

    const fails = results.filter(r => r.status === 'fail');
    assert.ok(fails.length >= 1, 'Should have at least one fail');
    assert.ok(fails.some(r => r.message.includes('frontmatter')), 'Should fail for corrupt frontmatter');
  });

  // ── Edge case: null basePath — catch block result includes detail ─────

  it('null basePath — catch block result includes detail with expected and found', async () => {
    const ctx = makeContext();
    const results = await checkAgents(null, ctx);

    assert.ok(Array.isArray(results), 'Should return an array');
    assert.ok(results.length >= 1, 'Should have at least one result');
    const fail = results.find(r => r.status === 'fail');
    assert.ok(fail, 'Should have a fail result');
    assert.ok(fail.detail, 'Fail result should have detail object');
    assert.ok(typeof fail.detail.expected === 'string', 'detail.expected should be a string');
    assert.ok(typeof fail.detail.found === 'string', 'detail.found should be a string');
  });
});

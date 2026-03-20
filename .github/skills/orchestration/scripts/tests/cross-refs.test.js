'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// ─── Mock Setup ─────────────────────────────────────────────────────────────

// Mock fs-helpers to avoid real file system access.
// Same cache-replacement pattern as other test files in the project.

let mockExists = () => false;

const path = require('path');
const fsHelpersPath = require.resolve('../validate/lib/utils/fs-helpers');

// Replace with proxy
require.cache[fsHelpersPath] = {
  id: fsHelpersPath,
  filename: fsHelpersPath,
  loaded: true,
  exports: {
    exists: (...args) => mockExists(...args),
    isDirectory: () => false,
    listFiles: () => [],
    listDirs: () => [],
    readFile: () => null,
  }
};

// Now require the module under test — it will pick up the mocked dependencies
const checkCrossRefs = require('../validate/lib/checks/cross-refs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeContext(overrides = {}) {
  return {
    agents: new Map(),
    skills: new Map(),
    config: null,
    instructions: [],
    prompts: [],
    ...overrides,
  };
}

function makeAgentInfo(overrides = {}) {
  return {
    filename: 'test.agent.md',
    frontmatter: { name: 'Test' },
    tools: [],
    agents: [],
    referencedSkills: [],
    ...overrides,
  };
}

function makeSkillInfo(overrides = {}) {
  return {
    folderName: 'test-skill',
    frontmatter: { name: 'test-skill', description: 'A test skill' },
    hasTemplates: false,
    templateLinks: [],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('checkCrossRefs', () => {

  beforeEach(() => {
    mockExists = () => false;
  });

  it('exports an async function', async () => {
    assert.strictEqual(typeof checkCrossRefs, 'function');
    const result = checkCrossRefs('/fake', makeContext());
    assert.ok(result instanceof Promise);
    await result;
  });

  // ── Orchestrator agent refs ──────────────────────────────────────────

  describe('Orchestrator agent refs', () => {

    it('valid refs — Orchestrator agents match discovered agents → pass results', async () => {
      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: ['Research', 'Coder'],
        tools: ['agent'],
      }));
      agents.set('research.agent.md', makeAgentInfo({
        filename: 'research.agent.md',
        frontmatter: { name: 'Research' },
      }));
      agents.set('coder.agent.md', makeAgentInfo({
        filename: 'coder.agent.md',
        frontmatter: { name: 'Coder' },
      }));

      const ctx = makeContext({ agents });
      const results = await checkCrossRefs('/fake', ctx);

      const passes = results.filter(r => r.status === 'pass' && r.message.includes('reference valid'));
      assert.strictEqual(passes.length, 2);
      assert.ok(passes.some(r => r.message.includes('Research')));
      assert.ok(passes.some(r => r.message.includes('Coder')));
      passes.forEach(r => assert.strictEqual(r.category, 'cross-references'));
    });

    it('broken ref — Orchestrator references unknown agent → fail result with detail', async () => {
      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: ['NonExistent'],
        tools: ['agent'],
      }));

      const ctx = makeContext({ agents });
      const results = await checkCrossRefs('/fake', ctx);

      const fails = results.filter(r => r.status === 'fail' && r.message.includes('NonExistent'));
      assert.strictEqual(fails.length, 1);
      assert.strictEqual(fails[0].category, 'cross-references');
      assert.ok(fails[0].detail);
      assert.ok(fails[0].detail.found === 'NonExistent');
    });

    it('no Orchestrator found → warn result', async () => {
      const agents = new Map();
      agents.set('coder.agent.md', makeAgentInfo({
        filename: 'coder.agent.md',
        frontmatter: { name: 'Coder' },
      }));

      const ctx = makeContext({ agents });
      const results = await checkCrossRefs('/fake', ctx);

      const warns = results.filter(r => r.status === 'warn' && r.message.includes('No Orchestrator'));
      assert.strictEqual(warns.length, 1);
      assert.strictEqual(warns[0].category, 'cross-references');
    });

    it('Orchestrator with empty agents array → no agent-ref results', async () => {
      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
        tools: ['agent'],
      }));

      const ctx = makeContext({ agents });
      const results = await checkCrossRefs('/fake', ctx);

      // Should have no agent-ref pass or fail results (only the Orchestrator exists, no refs to check)
      const agentRefResults = results.filter(r => r.message.includes('reference valid') || r.message.includes('unknown agent'));
      assert.strictEqual(agentRefResults.length, 0);
    });
  });

  // ── Agent → skill refs ───────────────────────────────────────────────

  describe('Agent → skill refs', () => {

    it('valid skill ref — agent references known skill → pass result', async () => {
      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
      }));
      agents.set('pm.agent.md', makeAgentInfo({
        filename: 'pm.agent.md',
        frontmatter: { name: 'Product Manager' },
        referencedSkills: ['create-prd'],
      }));

      const skills = new Map();
      skills.set('create-prd', makeSkillInfo({ folderName: 'create-prd' }));

      const ctx = makeContext({ agents, skills });
      const results = await checkCrossRefs('/fake', ctx);

      const passes = results.filter(r => r.status === 'pass' && r.message.includes('create-prd'));
      assert.strictEqual(passes.length, 1);
      assert.strictEqual(passes[0].category, 'cross-references');
    });

    it('broken skill ref — agent references unknown skill → fail result', async () => {
      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
      }));
      agents.set('pm.agent.md', makeAgentInfo({
        filename: 'pm.agent.md',
        frontmatter: { name: 'Product Manager' },
        referencedSkills: ['nonexistent-skill'],
      }));

      const skills = new Map();
      skills.set('create-prd', makeSkillInfo({ folderName: 'create-prd' }));

      const ctx = makeContext({ agents, skills });
      const results = await checkCrossRefs('/fake', ctx);

      const fails = results.filter(r => r.status === 'fail' && r.message.includes('nonexistent-skill'));
      assert.strictEqual(fails.length, 1);
      assert.strictEqual(fails[0].category, 'cross-references');
      assert.ok(fails[0].detail);
    });

    it('agent with empty referencedSkills — no skill-ref results', async () => {
      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
      }));
      agents.set('pm.agent.md', makeAgentInfo({
        filename: 'pm.agent.md',
        frontmatter: { name: 'Product Manager' },
        referencedSkills: [],
      }));

      const ctx = makeContext({ agents });
      const results = await checkCrossRefs('/fake', ctx);

      const skillRefResults = results.filter(r => r.message.includes('skill'));
      assert.strictEqual(skillRefResults.length, 0);
    });
  });

  // ── Config path validation ──────────────────────────────────────────

  describe('Config path validation', () => {

    it('config base_path exists — exists() returns true → pass result', async () => {
      mockExists = () => true;

      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
      }));

      const config = { projects: { base_path: 'custom/project-store/' } };
      const ctx = makeContext({ agents, config });
      const results = await checkCrossRefs('/fake', ctx);

      const passes = results.filter(r => r.status === 'pass' && r.message.includes('base_path'));
      assert.strictEqual(passes.length, 1);
      assert.strictEqual(passes[0].category, 'cross-references');
    });

    it('config base_path missing dir — exists() returns false → warn result', async () => {
      mockExists = () => false;

      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
      }));

      const config = { projects: { base_path: 'custom/project-store/' } };
      const ctx = makeContext({ agents, config });
      const results = await checkCrossRefs('/fake', ctx);

      const warns = results.filter(r => r.status === 'warn' && r.message.includes('base_path'));
      assert.strictEqual(warns.length, 1);
      assert.strictEqual(warns[0].category, 'cross-references');
      assert.ok(warns[0].detail);
    });

    it('absolute config base_path — resolves to absolute path, not concatenated', async () => {
      // Track what path exists() receives
      let receivedPath;
      mockExists = (p) => { receivedPath = p; return true; };

      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
      }));

      const config = { projects: { base_path: '/shared/projects' } };
      const ctx = makeContext({ agents, config });
      const results = await checkCrossRefs('/workspace', ctx);

      const passes = results.filter(r => r.status === 'pass' && r.message.includes('base_path'));
      assert.strictEqual(passes.length, 1);

      // path.resolve('/workspace', '/shared/projects') === '/shared/projects'
      // path.join('/workspace', '/shared/projects') would be '/workspace/shared/projects' (wrong)
      assert.strictEqual(receivedPath, path.resolve('/workspace', '/shared/projects'));
    });

    it('config is null — zero results from config path check', async () => {
      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: [],
      }));

      const ctx = makeContext({ agents, config: null });
      const results = await checkCrossRefs('/fake', ctx);

      const configResults = results.filter(r => r.message.includes('base_path'));
      assert.strictEqual(configResults.length, 0);
    });
  });

  // ── Graceful handling of null/undefined context sections ─────────────

  describe('Graceful context handling', () => {

    it('null context.agents — does not crash, treats as empty Map', async () => {
      const ctx = makeContext({ agents: null });
      const results = await checkCrossRefs('/fake', ctx);
      assert.ok(Array.isArray(results));
      // Should get the "No Orchestrator" warn since agents is empty
      const warns = results.filter(r => r.status === 'warn' && r.message.includes('No Orchestrator'));
      assert.strictEqual(warns.length, 1);
    });

    it('undefined context.agents — does not crash, treats as empty Map', async () => {
      const ctx = makeContext({ agents: undefined });
      const results = await checkCrossRefs('/fake', ctx);
      assert.ok(Array.isArray(results));
    });

    it('null context.skills — does not crash, treats as empty Map', async () => {
      const ctx = makeContext({ skills: null });
      const results = await checkCrossRefs('/fake', ctx);
      assert.ok(Array.isArray(results));
    });

    it('undefined context.skills — does not crash, treats as empty Map', async () => {
      const ctx = makeContext({ skills: undefined });
      const results = await checkCrossRefs('/fake', ctx);
      assert.ok(Array.isArray(results));
    });
  });

  // ── Unexpected error handling ────────────────────────────────────────

  describe('Error handling', () => {

    it('unexpected error — returns fail result instead of throwing', async () => {
      // Provide a context that will cause an error by making agents a non-iterable
      // that isn't null/undefined (so it passes the Map check but fails on iteration)
      const badContext = {
        agents: { [Symbol.iterator]: () => { throw new Error('boom'); } },
        skills: new Map(),
        config: null,
      };
      // agents instanceof Map is false, so it gets replaced with new Map()
      // We need to trick the instanceof check
      const FakeMap = class extends Map {
        [Symbol.iterator]() { throw new Error('boom'); }
        entries() { throw new Error('boom'); }
      };

      const ctx = {
        agents: new FakeMap(),
        skills: new Map(),
        config: null,
      };

      const results = await checkCrossRefs('/fake', ctx);
      assert.ok(Array.isArray(results));
      const fails = results.filter(r => r.status === 'fail');
      assert.ok(fails.length >= 1);
      assert.strictEqual(fails[0].category, 'cross-references');
    });
  });

  // ── Combined / integration-style test ───────────────────────────────

  describe('Multiple cross-reference types together', () => {

    it('combined context produces correct aggregate results', async () => {
      // Set exists() to handle different paths differently
      mockExists = (p) => {
        if (p.includes('PRD.md')) return true;
        if (p.includes('project-store')) return true;
        return false;
      };

      const agents = new Map();
      agents.set('orchestrator.agent.md', makeAgentInfo({
        filename: 'orchestrator.agent.md',
        frontmatter: { name: 'Orchestrator' },
        agents: ['Research', 'Coder', 'Missing'],
        tools: ['agent'],
      }));
      agents.set('research.agent.md', makeAgentInfo({
        filename: 'research.agent.md',
        frontmatter: { name: 'Research' },
        referencedSkills: ['research-codebase'],
      }));
      agents.set('coder.agent.md', makeAgentInfo({
        filename: 'coder.agent.md',
        frontmatter: { name: 'Coder' },
        referencedSkills: ['generate-task-report', 'nonexistent-skill'],
      }));

      const skills = new Map();
      skills.set('research-codebase', makeSkillInfo({
        folderName: 'research-codebase',
        templateLinks: ['./templates/PRD.md'],
      }));
      skills.set('generate-task-report', makeSkillInfo({
        folderName: 'generate-task-report',
        templateLinks: ['./templates/MISSING.md'],
      }));

      const config = { projects: { base_path: 'custom/project-store/' } };
      const ctx = makeContext({ agents, skills, config });

      const results = await checkCrossRefs('/fake', ctx);

      // All results should have the correct category
      results.forEach(r => assert.strictEqual(r.category, 'cross-references'));

      // Orchestrator → Research: pass
      // Orchestrator → Coder: pass
      // Orchestrator → Missing: fail
      const orchAgentPasses = results.filter(r => r.message.includes('reference valid') && r.message.includes('Orchestrator'));
      const orchAgentFails = results.filter(r => r.message.includes('unknown agent'));
      assert.strictEqual(orchAgentPasses.length, 2);
      assert.strictEqual(orchAgentFails.length, 1);

      // research.agent.md → research-codebase: pass
      // coder.agent.md → generate-task-report: pass
      // coder.agent.md → nonexistent-skill: fail
      const skillRefPasses = results.filter(r => r.status === 'pass' && r.message.includes('skill'));
      const skillRefFails = results.filter(r => r.status === 'fail' && r.message.includes('unknown skill'));
      assert.strictEqual(skillRefPasses.length, 2);
      assert.strictEqual(skillRefFails.length, 1);

      // Config base_path: pass (exists = true)
      const configPasses = results.filter(r => r.status === 'pass' && r.message.includes('base_path'));
      assert.strictEqual(configPasses.length, 1);
    });
  });

  // ── Edge case: completely empty context ─────────────────────────────────

  describe('Edge case — empty context', () => {

    it('completely empty context ({}) — returns array without crashing', async () => {
      const results = await checkCrossRefs('/fake', {});
      assert.ok(Array.isArray(results), 'Should return an array');
      // With empty agents map, should get "No Orchestrator" warn
      const warns = results.filter(r => r.status === 'warn');
      assert.ok(warns.length >= 1, 'Should have at least one warn result');
    });

    it('context with agents: null, skills: null, config: null — returns array', async () => {
      const ctx = { agents: null, skills: null, config: null };
      const results = await checkCrossRefs('/fake', ctx);
      assert.ok(Array.isArray(results), 'Should return an array');
    });

    it('null basePath with config base_path — top-level catch returns fail result with detail', async () => {
      const ctx = {
        agents: new Map(),
        skills: new Map(),
        config: { projects: { base_path: 'custom/project-store' } },
      };
      const results = await checkCrossRefs(null, ctx);

      assert.ok(Array.isArray(results), 'Should return an array');
      const fail = results.find(r => r.status === 'fail' && r.name === 'cross-refs');
      assert.ok(fail, 'Should have a fail result from catch block');
      assert.ok(fail.detail, 'Fail result should have detail');
      assert.ok(typeof fail.detail.expected === 'string', 'detail.expected should be a string');
      assert.ok(typeof fail.detail.found === 'string', 'detail.found should be a string');
    });
  });
});

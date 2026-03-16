'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const checkStructure = require('../../../skills/validate-orchestration/scripts/lib/checks/structure');

// ─── Test Helpers ───────────────────────────────────────────────────────────

let tmpDir;
let passed = 0;
let failed = 0;
const results = [];

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'structure-test-'));
}

function setupFullGithub() {
  const ghDir = path.join(tmpDir, '.github');
  fs.mkdirSync(ghDir);
  fs.mkdirSync(path.join(ghDir, 'agents'));
  fs.mkdirSync(path.join(ghDir, 'skills'));
  fs.mkdirSync(path.join(ghDir, 'instructions'));
  fs.mkdirSync(path.join(ghDir, 'prompts'));
  fs.writeFileSync(path.join(ghDir, 'orchestration.yml'), 'projects:\n  base_path: custom/project-store/\n');
  fs.writeFileSync(path.join(ghDir, 'copilot-instructions.md'), '# Instructions\n');
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: 'pass' });
  } catch (err) {
    failed++;
    results.push({ name, status: 'fail', error: err.message });
    console.error(`  FAIL: ${name}\n        ${err.message}`);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function runTests() {
  // --- Module export ---
  await test('Module exports an async function', async () => {
    assert.strictEqual(typeof checkStructure, 'function');
    // Verify it returns a promise
    const result = checkStructure(tmpDir, {});
    assert.ok(result instanceof Promise);
    await result;
  });

  // --- Full structure → all pass ---
  setup();
  setupFullGithub();
  try {
    await test('Full .github/ structure returns 7 CheckResult objects all with status "pass"', async () => {
      const context = {
        agents: new Map(),
        skills: new Map(),
        config: null,
        instructions: [],
        prompts: [],
      };
      const res = await checkStructure(tmpDir, context);
      assert.strictEqual(res.length, 7, `Expected 7 results, got ${res.length}`);
      const allPass = res.every(r => r.status === 'pass');
      assert.ok(allPass, `Not all results passed: ${JSON.stringify(res.filter(r => r.status !== 'pass'))}`);
    });
  } finally {
    teardown();
  }

  // --- Empty directory → fail/warn ---
  setup();
  try {
    await test('Empty directory returns fail for required items and warn for .github/prompts', async () => {
      const context = {};
      const res = await checkStructure(tmpDir, context);
      assert.strictEqual(res.length, 7, `Expected 7 results, got ${res.length}`);

      // .github, .github/agents, .github/skills, .github/instructions should be fail
      const failResults = res.filter(r => r.status === 'fail');
      const warnResults = res.filter(r => r.status === 'warn');
      assert.strictEqual(failResults.length, 6, `Expected 6 fail results, got ${failResults.length}`);
      assert.strictEqual(warnResults.length, 1, `Expected 1 warn result, got ${warnResults.length}`);
      assert.strictEqual(warnResults[0].name, '.github/prompts');
    });

    await test('All results have category "structure"', async () => {
      const res = await checkStructure(tmpDir, {});
      assert.ok(res.every(r => r.category === 'structure'), 'Not all results have category "structure"');
    });

    await test('Fail/warn results include a detail object with expected and found', async () => {
      const res = await checkStructure(tmpDir, {});
      const nonPass = res.filter(r => r.status !== 'pass');
      assert.ok(nonPass.length > 0, 'Expected at least one non-pass result');
      for (const r of nonPass) {
        assert.ok(r.detail, `Result "${r.name}" missing detail object`);
        assert.ok(typeof r.detail.expected === 'string', `Result "${r.name}" detail.expected not a string`);
        assert.ok(typeof r.detail.found === 'string', `Result "${r.name}" detail.found not a string`);
      }
    });

    await test('Pass results do NOT include a detail object', async () => {
      // Need a full structure for pass results
      const tmpFull = fs.mkdtempSync(path.join(os.tmpdir(), 'structure-pass-test-'));
      const ghDir = path.join(tmpFull, '.github');
      fs.mkdirSync(ghDir);
      fs.mkdirSync(path.join(ghDir, 'agents'));
      fs.mkdirSync(path.join(ghDir, 'skills'));
      fs.mkdirSync(path.join(ghDir, 'instructions'));
      fs.mkdirSync(path.join(ghDir, 'prompts'));
      fs.writeFileSync(path.join(ghDir, 'orchestration.yml'), 'config: true\n');
      fs.writeFileSync(path.join(ghDir, 'copilot-instructions.md'), '# Test\n');
      try {
        const res = await checkStructure(tmpFull, {});
        const passResults = res.filter(r => r.status === 'pass');
        assert.ok(passResults.length > 0, 'Expected at least one pass result');
        for (const r of passResults) {
          assert.strictEqual(r.detail, undefined, `Pass result "${r.name}" should not have detail`);
        }
      } finally {
        fs.rmSync(tmpFull, { recursive: true, force: true });
      }
    });
  } finally {
    teardown();
  }

  // --- Never throws ---
  await test('Function never throws — returns a fail result on unexpected error', async () => {
    // Pass null as basePath to provoke an error inside path.join
    let threw = false;
    try {
      const res = await checkStructure(null, {});
      assert.ok(Array.isArray(res), 'Should return an array');
      assert.ok(res.length >= 1, 'Should return at least one result');
      assert.strictEqual(res[0].category, 'structure');
      assert.strictEqual(res[0].name, 'structure-check-error');
      assert.strictEqual(res[0].status, 'fail');
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Function should never throw');
  });

  // --- basePath null — fail result includes detail ---
  await test('basePath is null — fail result includes detail with expected and found', async () => {
    const res = await checkStructure(null, {});
    assert.ok(Array.isArray(res));
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].status, 'fail');
    assert.ok(res[0].detail, 'Fail result should have a detail object');
    assert.ok(typeof res[0].detail.expected === 'string', 'detail.expected should be a string');
    assert.ok(typeof res[0].detail.found === 'string', 'detail.found should be a string');
  });

  // --- context not modified ---
  setup();
  setupFullGithub();
  try {
    await test('Context parameter is accepted but not modified', async () => {
      const context = {
        agents: new Map([['test', { name: 'test' }]]),
        skills: new Map(),
        config: { key: 'value' },
        instructions: [{ path: 'test' }],
        prompts: [],
      };
      const contextBefore = JSON.stringify(context, (key, value) =>
        value instanceof Map ? [...value.entries()] : value
      );
      await checkStructure(tmpDir, context);
      const contextAfter = JSON.stringify(context, (key, value) =>
        value instanceof Map ? [...value.entries()] : value
      );
      assert.strictEqual(contextAfter, contextBefore, 'Context was modified');
    });
  } finally {
    teardown();
  }
}

runTests().then(() => {
  // ─── Report ─────────────────────────────────────────────────────────────────
  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
  results.forEach(r => {
    const icon = r.status === 'pass' ? '✓' : '✗';
    console.log(`  ${icon} ${r.name}`);
  });

  if (failed > 0) {
    process.exit(1);
  }
});

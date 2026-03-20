'use strict';

const assert = require('assert');
const { extractFrontmatter } = require('../validate/lib/utils/frontmatter');

// ─── Test Helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'pass' });
  } catch (err) {
    failed++;
    results.push({ name, status: 'fail', error: err.message });
    console.error(`  FAIL: ${name}\n        ${err.message}`);
  }
}

// ─── Standard --- Frontmatter Tests ─────────────────────────────────────────

test('Standard frontmatter: extracts key-value pairs and returns correct body', () => {
  const input = '---\nproject: VALIDATOR\nphase: 1\ntask: 2\n---\n\n# Title\n\nBody here.\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter, {
    project: 'VALIDATOR',
    phase: 1,
    task: 2
  });
  assert.strictEqual(result.body, '\n# Title\n\nBody here.\n');
});

test('Standard frontmatter: quoted strings have quotes stripped', () => {
  const input = '---\ntitle: "My Title"\ndesc: \'Single quoted\'\n---\nBody\n';
  const result = extractFrontmatter(input);
  assert.strictEqual(result.frontmatter.title, 'My Title');
  assert.strictEqual(result.frontmatter.desc, 'Single quoted');
});

test('Standard frontmatter: integer values parsed as numbers', () => {
  const input = '---\nphase: 1\ntask: 42\n---\nBody\n';
  const result = extractFrontmatter(input);
  assert.strictEqual(result.frontmatter.phase, 1);
  assert.strictEqual(result.frontmatter.task, 42);
  assert.strictEqual(typeof result.frontmatter.phase, 'number');
});

test('Standard frontmatter: boolean values parsed correctly', () => {
  const input = '---\nenabled: true\ndisabled: false\n---\nBody\n';
  const result = extractFrontmatter(input);
  assert.strictEqual(result.frontmatter.enabled, true);
  assert.strictEqual(result.frontmatter.disabled, false);
  assert.strictEqual(typeof result.frontmatter.enabled, 'boolean');
});

test('Standard frontmatter: YAML lists parsed into arrays', () => {
  const input = '---\ntools:\n  - read\n  - search\n  - agent\n---\nBody\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter.tools, ['read', 'search', 'agent']);
});

test('Standard frontmatter: empty array [] parsed as empty JavaScript array', () => {
  const input = '---\nskills_required: []\nskills_optional: []\n---\nBody\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter.skills_required, []);
  assert.deepStrictEqual(result.frontmatter.skills_optional, []);
});

// ─── Fenced Code Block Frontmatter Tests ────────────────────────────────────

test('Fenced ```chatagent frontmatter: extracts frontmatter and body', () => {
  const input = '```chatagent\n---\nname: Orchestrator\ndescription: "Main agent"\n---\n\n# Orchestrator\n\nYou are the coordinator.\n```\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter, {
    name: 'Orchestrator',
    description: 'Main agent'
  });
  assert.strictEqual(result.body, '\n# Orchestrator\n\nYou are the coordinator.');
});

test('Fenced ```instructions frontmatter: extracts frontmatter and body', () => {
  const input = '```instructions\n---\napplyTo: \'custom/project-store/**\'\n---\n\n# Conventions\n\nWhen editing...\n```\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter, {
    applyTo: 'custom/project-store/**'
  });
  assert.strictEqual(result.body, '\n# Conventions\n\nWhen editing...');
});

test('Fenced ```skill frontmatter: extracts frontmatter and body', () => {
  const input = '```skill\n---\nname: create-prd\ndescription: \'Create a PRD from research.\'\n---\n\n# Create PRD\n\nGenerate a PRD.\n```\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter, {
    name: 'create-prd',
    description: 'Create a PRD from research.'
  });
  assert.strictEqual(result.body, '\n# Create PRD\n\nGenerate a PRD.');
});

test('Fenced ```prompt frontmatter: extracts frontmatter and body', () => {
  const input = '```prompt\n---\nmode: agent\ndescription: "Start a new project"\ntools:\n  - read\n  - agent\n---\n\n# Start Project\n\nBegin orchestration.\n```\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter, {
    mode: 'agent',
    description: 'Start a new project',
    tools: ['read', 'agent']
  });
  assert.strictEqual(result.body, '\n# Start Project\n\nBegin orchestration.');
});

test('Fenced frontmatter with list values parsed as arrays', () => {
  const input = '```chatagent\n---\nname: Orchestrator\ntools:\n  - read\n  - search\n  - agent\nagents:\n  - Research\n  - "Product Manager"\n---\n\n# Body\n```\n';
  const result = extractFrontmatter(input);
  assert.deepStrictEqual(result.frontmatter.tools, ['read', 'search', 'agent']);
  assert.deepStrictEqual(result.frontmatter.agents, ['Research', 'Product Manager']);
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

test('No frontmatter: returns null frontmatter and full content as body', () => {
  const input = '# Just a heading\n\nSome content.\n';
  const result = extractFrontmatter(input);
  assert.strictEqual(result.frontmatter, null);
  assert.strictEqual(result.body, input);
});

test('Empty string input: returns null frontmatter and empty body', () => {
  const result = extractFrontmatter('');
  assert.strictEqual(result.frontmatter, null);
  assert.strictEqual(result.body, '');
});

test('Malformed frontmatter (unclosed ---): returns null frontmatter and full content', () => {
  const input = '---\nproject: VALIDATOR\nphase: 1\n# No closing delimiter\nBody content\n';
  const result = extractFrontmatter(input);
  assert.strictEqual(result.frontmatter, null);
  assert.strictEqual(result.body, input);
});

test('Never throws on any input', () => {
  // Test with various problematic inputs
  const inputs = [null, undefined, 42, {}, [], true, '---\n---\n', '```chatagent\n```\n'];
  for (const input of inputs) {
    let threw = false;
    try {
      extractFrontmatter(input);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, `Threw on input: ${JSON.stringify(input)}`);
  }
});

// ─── Report ─────────────────────────────────────────────────────────────────

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
results.forEach(r => {
  const icon = r.status === 'pass' ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}`);
});

if (failed > 0) {
  process.exit(1);
}

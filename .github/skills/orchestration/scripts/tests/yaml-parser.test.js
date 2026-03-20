'use strict';

const assert = require('assert');
const { parseYaml } = require('../validate/lib/utils/yaml-parser');

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

// ─── Reference YAML ─────────────────────────────────────────────────────────

const REFERENCE_YAML = `# .github/orchestration.yml
# Orchestration System Configuration
# -----------------------------------

version: "1.0"

# ─── Project Storage ───────────────────────────────────────────────
projects:
  base_path: ".github/projects"          # Where project folders are created
  naming: "SCREAMING_CASE"               # SCREAMING_CASE | lowercase | numbered

# ─── Pipeline Limits (Scope Guards) ───────────────────────────────
limits:
  max_phases: 10                         # Maximum phases per project
  max_tasks_per_phase: 8                 # Maximum tasks per phase
  max_retries_per_task: 2                # Auto-retries before escalation
  max_consecutive_review_rejections: 3   # Reviewer rejects before human escalation

# ─── Human Gate Defaults ───────────────────────────────────────────
human_gates:
  after_planning: true                   # Always gate after master plan (hard default)
  execution_mode: "ask"                  # ask | phase | task | autonomous
  after_final_review: true               # Always gate after final review (hard default)

# ─── Notes ─────────────────────────────────────────────────────────
# Model selection is configured per-agent in .agent.md frontmatter.
# See .github/agents/*.agent.md → model field.
`;

const EXPECTED = {
  version: '1.0',
  projects: {
    base_path: '.github/projects',
    naming: 'SCREAMING_CASE'
  },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'ask',
    after_final_review: true
  }
};

// ─── Basic Functionality ────────────────────────────────────────────────────

test('parseYaml returns a nested object when given valid YAML', () => {
  const result = parseYaml('key: value\n');
  assert.ok(result !== null && typeof result === 'object');
});

test('Top-level keys parse correctly', () => {
  const result = parseYaml(REFERENCE_YAML);
  assert.ok(result !== null);
  assert.ok('version' in result);
  assert.ok('projects' in result);
  assert.ok('limits' in result);
  assert.ok('human_gates' in result);
});

test('Nested objects parse at multiple depth levels', () => {
  const result = parseYaml(REFERENCE_YAML);
  assert.ok(result !== null);
  assert.strictEqual(result.projects.base_path, '.github/projects');
  assert.strictEqual(result.limits.max_phases, 10);
});

// ─── Type Coercion ──────────────────────────────────────────────────────────

test('String values are JavaScript strings', () => {
  const result = parseYaml(REFERENCE_YAML);
  assert.ok(result !== null);
  assert.strictEqual(result.version, '1.0');
  assert.strictEqual(typeof result.version, 'string');
});

test('Quoted strings have quotes stripped', () => {
  const result = parseYaml(REFERENCE_YAML);
  assert.ok(result !== null);
  assert.strictEqual(result.version, '1.0');
  assert.strictEqual(result.projects.base_path, '.github/projects');
  assert.strictEqual(result.projects.naming, 'SCREAMING_CASE');
});

test('Integer values are JavaScript numbers', () => {
  const result = parseYaml(REFERENCE_YAML);
  assert.ok(result !== null);
  assert.strictEqual(result.limits.max_phases, 10);
  assert.strictEqual(typeof result.limits.max_phases, 'number');
  assert.strictEqual(result.limits.max_tasks_per_phase, 8);
  assert.strictEqual(result.limits.max_retries_per_task, 2);
  assert.strictEqual(result.limits.max_consecutive_review_rejections, 3);
});

test('Boolean values are JavaScript booleans', () => {
  const result = parseYaml(REFERENCE_YAML);
  assert.ok(result !== null);
  assert.strictEqual(result.human_gates.after_planning, true);
  assert.strictEqual(result.human_gates.after_final_review, true);
});

test('Boolean case-sensitivity: quoted "true" is string, unquoted true is boolean', () => {
  const yaml = 'enabled: true\ndisabled: false\nlabel: "true"\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.enabled, true);
  assert.strictEqual(typeof result.enabled, 'boolean');
  assert.strictEqual(result.disabled, false);
  assert.strictEqual(typeof result.disabled, 'boolean');
  assert.strictEqual(result.label, 'true');
  assert.strictEqual(typeof result.label, 'string');
});

// ─── Arrays ─────────────────────────────────────────────────────────────────

test('Array items using - item syntax produce JavaScript arrays', () => {
  const yaml = 'items:\n  - "alpha"\n  - "beta"\n  - "gamma"\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.ok(Array.isArray(result.items));
  assert.deepStrictEqual(result.items, ['alpha', 'beta', 'gamma']);
});

// ─── Comments ───────────────────────────────────────────────────────────────

test('Inline comments are stripped', () => {
  const yaml = 'max_phases: 10    # This is a comment\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.max_phases, 10);
  assert.strictEqual(typeof result.max_phases, 'number');
});

test('Comment-only lines are ignored', () => {
  const yaml = '# Comment\nkey: value\n# Another comment\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.key, 'value');
  assert.strictEqual(Object.keys(result).length, 1);
});

test('Decorative comment lines with special characters are ignored', () => {
  const yaml = '# ─── Section Header ───────────────────────────────\nkey: value\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.key, 'value');
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

test('Empty/null input returns null', () => {
  assert.strictEqual(parseYaml(null), null);
  assert.strictEqual(parseYaml(undefined), null);
  assert.strictEqual(parseYaml(''), null);
  assert.strictEqual(parseYaml('   '), null);
});

test('Malformed input returns null — never throws', () => {
  const inputs = [42, {}, [], true, false, 0];
  for (const input of inputs) {
    let threw = false;
    let result;
    try {
      result = parseYaml(input);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, `Threw on input: ${JSON.stringify(input)}`);
    assert.strictEqual(result, null, `Did not return null for input: ${JSON.stringify(input)}`);
  }
});

test('Comment-only YAML returns null', () => {
  const yaml = '# Just comments\n# Nothing else\n';
  assert.strictEqual(parseYaml(yaml), null);
});

test('Empty value (key with no children) returns empty string', () => {
  const yaml = 'description:\ntitle: Hello\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.description, '');
  assert.strictEqual(result.title, 'Hello');
});

test('Empty value at end of file returns empty string', () => {
  const yaml = 'title: Hello\ndescription:\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.description, '');
});

test('Quoted strings containing special characters preserve content', () => {
  const yaml = 'prefix: "[orch]"\npath: "orch/"\nname: "SCREAMING_CASE"\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.prefix, '[orch]');
  assert.strictEqual(result.path, 'orch/');
  assert.strictEqual(result.name, 'SCREAMING_CASE');
});

test('Single-quoted strings have quotes stripped', () => {
  const yaml = "title: 'My Title'\npath: '.github/projects'\n";
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.strictEqual(result.title, 'My Title');
  assert.strictEqual(result.path, '.github/projects');
});

test('Nested structures at 3 depth levels', () => {
  const yaml = 'level1:\n  level2:\n    level3:\n      - "item_a"\n      - "item_b"\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.deepStrictEqual(result.level1.level2.level3, [
    'item_a',
    'item_b'
  ]);
});

test('Inline empty array [] parsed correctly', () => {
  const yaml = 'skills_required: []\nskills_optional: []\n';
  const result = parseYaml(yaml);
  assert.ok(result !== null);
  assert.deepStrictEqual(result.skills_required, []);
  assert.deepStrictEqual(result.skills_optional, []);
});

// ─── Full Reference YAML ────────────────────────────────────────────────────

test('Reference orchestration.yml parses into expected structure', () => {
  const result = parseYaml(REFERENCE_YAML);
  assert.deepStrictEqual(result, EXPECTED);
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

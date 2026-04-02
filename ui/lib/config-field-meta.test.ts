/**
 * Tests for config-field-meta.
 * Run with: npx tsx ui/lib/config-field-meta.test.ts
 */
import assert from 'node:assert';
import { CONFIG_FIELDS, CONFIG_FIELD_MAP } from './config-field-meta';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

console.log('\nconfig-field-meta tests\n');

// --- CONFIG_FIELDS array ---

test('CONFIG_FIELDS is an array of exactly 14 entries', () => {
  assert.ok(Array.isArray(CONFIG_FIELDS));
  assert.strictEqual(CONFIG_FIELDS.length, 14);
});

test('every entry conforms to FieldMeta interface', () => {
  for (const field of CONFIG_FIELDS) {
    assert.ok(typeof field.key === 'string', `key missing on ${JSON.stringify(field)}`);
    assert.ok(typeof field.label === 'string', `label missing on ${field.key}`);
    assert.ok(typeof field.tooltip === 'string', `tooltip missing on ${field.key}`);
    assert.ok(typeof field.section === 'string', `section missing on ${field.key}`);
    assert.ok(
      ['text', 'number', 'switch', 'toggle-group', 'readonly'].includes(field.controlType),
      `invalid controlType on ${field.key}: ${field.controlType}`,
    );
  }
});

// --- CONFIG_FIELD_MAP ---

test('CONFIG_FIELD_MAP contains exactly 14 keys matching CONFIG_FIELDS', () => {
  const keys = Object.keys(CONFIG_FIELD_MAP);
  assert.strictEqual(keys.length, 14);
  for (const field of CONFIG_FIELDS) {
    assert.ok(keys.includes(field.key), `missing key in map: ${field.key}`);
  }
});

// --- Specific field lookups ---

test('limits.max_phases has correct metadata', () => {
  const f = CONFIG_FIELD_MAP['limits.max_phases'];
  assert.ok(f);
  assert.strictEqual(f.label, 'Max Phases');
  assert.strictEqual(f.controlType, 'number');
  assert.strictEqual(f.min, 1);
});

test('projects.naming has correct toggle-group and options', () => {
  const f = CONFIG_FIELD_MAP['projects.naming'];
  assert.ok(f);
  assert.strictEqual(f.controlType, 'toggle-group');
  assert.deepStrictEqual(f.options, ['SCREAMING_CASE', 'lowercase', 'numbered']);
});

test('human_gates.after_planning is switch with no options or min', () => {
  const f = CONFIG_FIELD_MAP['human_gates.after_planning'];
  assert.ok(f);
  assert.strictEqual(f.controlType, 'switch');
  assert.strictEqual(f.options, undefined);
  assert.strictEqual(f.min, undefined);
});

test('version is readonly with section "version"', () => {
  const f = CONFIG_FIELD_MAP['version'];
  assert.ok(f);
  assert.strictEqual(f.controlType, 'readonly');
  assert.strictEqual(f.section, 'version');
});

test('source_control.provider is readonly with section "source-control"', () => {
  const f = CONFIG_FIELD_MAP['source_control.provider'];
  assert.ok(f);
  assert.strictEqual(f.controlType, 'readonly');
  assert.strictEqual(f.section, 'source-control');
});

// --- Number field min values ---

test('all four number fields have correct min values', () => {
  const expected: Record<string, number> = {
    'limits.max_phases': 1,
    'limits.max_tasks_per_phase': 1,
    'limits.max_retries_per_task': 0,
    'limits.max_consecutive_review_rejections': 1,
  };
  for (const [key, minVal] of Object.entries(expected)) {
    const f = CONFIG_FIELD_MAP[key];
    assert.ok(f, `field ${key} not found`);
    assert.strictEqual(f.min, minVal, `${key} min expected ${minVal}, got ${f.min}`);
  }
});

// --- Toggle-group option values ---

test('all four toggle-group fields have correct options', () => {
  const expected: Record<string, string[]> = {
    'projects.naming': ['SCREAMING_CASE', 'lowercase', 'numbered'],
    'human_gates.execution_mode': ['ask', 'phase', 'task', 'autonomous'],
    'source_control.auto_commit': ['always', 'ask', 'never'],
    'source_control.auto_pr': ['always', 'ask', 'never'],
  };
  for (const [key, opts] of Object.entries(expected)) {
    const f = CONFIG_FIELD_MAP[key];
    assert.ok(f, `field ${key} not found`);
    assert.deepStrictEqual(f.options, opts, `${key} options mismatch`);
  }
});

// --- Mutual exclusion: no field has both options and min ---

test('no field has both options and min defined', () => {
  for (const field of CONFIG_FIELDS) {
    const hasBoth = field.options !== undefined && field.min !== undefined;
    assert.ok(!hasBoth, `${field.key} has both options and min`);
  }
});

// --- Case-sensitive option values ---

test('option values are case-sensitive correct', () => {
  const naming = CONFIG_FIELD_MAP['projects.naming'];
  assert.ok(naming.options!.includes('SCREAMING_CASE'), 'SCREAMING_CASE must be uppercase');
  assert.ok(!naming.options!.includes('screaming_case'), 'screaming_case must not appear');

  const exec = CONFIG_FIELD_MAP['human_gates.execution_mode'];
  assert.ok(exec.options!.includes('ask'), "'ask' must be lowercase");
  assert.ok(!exec.options!.includes('Ask'), "'Ask' must not appear");
});

// --- Summary ---

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

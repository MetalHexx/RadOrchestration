// installer/lib/theme.test.js — Tests for theme.js

import { THEME, FIGLET_FONT, sectionHeader, divider } from './theme.js';
import assert from 'node:assert/strict';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// T1: THEME is a named export and is an object with exactly 15 keys
test('THEME is exported as an object with exactly 15 keys', () => {
  assert.equal(typeof THEME, 'object');
  assert.notEqual(THEME, null);
  assert.equal(Object.keys(THEME).length, 15);
});

// T2: FIGLET_FONT is a named export with value 'Bloody'
test("FIGLET_FONT is 'Bloody'", () => {
  assert.equal(FIGLET_FONT, 'Bloody');
});

// T3: Each of the 14 function tokens is callable
const functionKeys = [
  'banner', 'heading', 'rule',
  'label', 'body', 'secondary', 'hint', 'success', 'warning',
  'error', 'errorDetail', 'command', 'stepNumber', 'disabled',
];

for (const key of functionKeys) {
  test(`THEME.${key} is a function`, () => {
    assert.equal(typeof THEME[key], 'function', `Expected THEME.${key} to be a function`);
  });
}

// T4: THEME.spinner is the string 'green'
test("THEME.spinner === 'green'", () => {
  assert.equal(THEME.spinner, 'green');
});

// T5: Calling THEME.banner('test') returns a string
test("THEME.banner('test') returns a string", () => {
  const result = THEME.banner('test');
  assert.equal(typeof result, 'string');
});

// T6: Calling THEME.errorDetail('test') returns a string (chained modifier works)
test("THEME.errorDetail('test') returns a string", () => {
  const result = THEME.errorDetail('test');
  assert.equal(typeof result, 'string');
});

// ── New helpers: sectionHeader and divider ──────────────────────────────────

// T7: sectionHeader is exported and is a function
test('sectionHeader is exported as a function', () => {
  assert.equal(typeof sectionHeader, 'function');
});

// T8: sectionHeader output contains :: marker and title text
test("sectionHeader('::', 'Getting Started') output contains marker and title", () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    sectionHeader('::', 'Getting Started');
  } finally {
    console.log = originalLog;
  }
  const output = logs.join('\n');
  assert.ok(output.includes('::'), 'output should contain the :: marker');
  assert.ok(output.includes('Getting Started'), 'output should contain the title');
});

// T9: sectionHeader output contains dim rule characters ──
test('sectionHeader output contains ── dim rule characters', () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    sectionHeader('::', 'Getting Started');
  } finally {
    console.log = originalLog;
  }
  const output = logs.join('\n');
  assert.ok(output.includes('──'), 'output should contain ── characters');
});

// T10: divider is exported and is a function
test('divider is exported as a function', () => {
  assert.equal(typeof divider, 'function');
});

// T11: divider output contains ─ characters
test('divider() output contains ─ characters', () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    divider();
  } finally {
    console.log = originalLog;
  }
  const output = logs.join('\n');
  assert.ok(output.includes('─'), 'output should contain ─ characters');
});

console.log('');
console.log(`Results: ${passed}/${passed + failed} passing`);
if (failed > 0) {
  process.exit(1);
}

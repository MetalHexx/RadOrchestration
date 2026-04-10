'use strict';
/**
 * Tests for the updated printHelp() accepting orchRoot as a parameter.
 *
 * Verifies that printHelp() substitutes orchRoot into all 7 hardcoded
 * .github references in the help text, and that backward compatibility
 * is preserved when no argument is passed.
 */

const assert = require('assert');
const { printHelp } = require('../lib/reporter');

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Capture stdout output produced by a synchronous function.
 * @param {Function} fn - Function whose stdout output to capture
 * @returns {string} Accumulated stdout string
 */
function captureStdout(fn) {
  let output = '';
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(description, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL  ${description}`);
    console.error(`          ${err.message}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nreporter printHelp orchRoot unit tests\n');

  // Test 1: custom root appears in usage line; no .github/skills/ present
  await test('printHelp(".agents") — usage line uses ".agents" prefix and no .github reference', async () => {
    const out = captureStdout(() => printHelp('.agents'));
    assert.ok(
      out.includes('node .agents/skills/orchestration/scripts/validate/validate-orchestration.js'),
      `Usage line should contain ".agents/skills/..." but got:\n${out}`
    );
    assert.ok(
      !out.includes('node .github/skills/'),
      `Output should NOT contain "node .github/skills/" but got:\n${out}`
    );
  });

  // Test 2: custom root appears in category description
  await test('printHelp(".agents") — category description uses ".agents/" prefix', async () => {
    const out = captureStdout(() => printHelp('.agents'));
    assert.ok(
      out.includes('.agents/ directory structure and required files'),
      `Category line should contain ".agents/ directory structure..." but got:\n${out}`
    );
  });

  // Test 3: 6 total occurrences (1 usage + 5 example lines) of custom root
  await test('printHelp(".agents") — 6 occurrences of ".agents/skills/orchestration/scripts/validate/validate-orchestration" (1 usage + 5 examples)', async () => {
    const out = captureStdout(() => printHelp('.agents'));
    const count = (out.match(/\.agents\/skills\/orchestration\/scripts\/validate\/validate-orchestration/g) || []).length;
    assert.strictEqual(count, 6,
      `Expected 6 occurrences of ".agents/skills/orchestration/scripts/validate/validate-orchestration" but found ${count}`
    );
  });

  // Test 4: no-argument call uses .github (backward compatibility)
  await test('printHelp() — no argument falls back to ".github" (backward compatibility)', async () => {
    const out = captureStdout(() => printHelp());
    assert.ok(
      out.includes('node .github/skills/orchestration/scripts/validate/validate-orchestration.js'),
      `Usage line should contain ".github/skills/..." but got:\n${out}`
    );
  });

  // Test 5: printHelp(undefined) output identical to printHelp()
  await test('printHelp(undefined) — output identical to printHelp()', async () => {
    const outNoArg = captureStdout(() => printHelp());
    const outUndef  = captureStdout(() => printHelp(undefined));
    assert.strictEqual(outUndef, outNoArg,
      'printHelp(undefined) should produce identical output to printHelp()'
    );
  });

  // Test 6: arbitrary root (.copilot) works
  await test('printHelp(".copilot") — arbitrary root is substituted correctly', async () => {
    const out = captureStdout(() => printHelp('.copilot'));
    assert.ok(
      out.includes('.copilot/skills/orchestration/scripts/validate/validate-orchestration.js'),
      `Output should contain ".copilot/skills/..." but got:\n${out}`
    );
  });

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();

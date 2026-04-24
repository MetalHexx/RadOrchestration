/**
 * Tests for app/not-found — 404 page verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/not-found.test.tsx
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import NotFound from './not-found';

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

// ─── Source text helper ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourceText = readFileSync(join(__dirname, 'not-found.tsx'), 'utf-8');

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('app/not-found — 404 page verification');

  await test('Default export is a function', () => {
    assert.strictEqual(typeof NotFound, 'function', 'Default export should be a function');
  });

  await test('Default export function is named NotFound', () => {
    assert.strictEqual(NotFound.name, 'NotFound', 'Default export should be named NotFound');
  });

  await test('File does NOT contain "use client" directive', () => {
    assert.ok(
      !sourceText.includes('"use client"') && !sourceText.includes("'use client'"),
      'not-found.tsx must not contain a "use client" directive — it must be a server component'
    );
  });

  await test('Source contains a link with href="/"', () => {
    assert.ok(
      sourceText.includes('href="/"') || sourceText.includes("href='/'"),
      'not-found.tsx must contain a Link with href="/" to chain through the root redirect'
    );
  });

  await test('Source contains "Back to Dashboard" text', () => {
    assert.ok(
      sourceText.includes('Back to Dashboard'),
      'not-found.tsx must contain the text "Back to Dashboard"'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

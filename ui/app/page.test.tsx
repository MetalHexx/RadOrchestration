/**
 * Tests for app/page — server redirect component verification.
 * Run with: node --test --import tsx ui/app/page.test.tsx
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import Home from './page';

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
const sourceText = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('app/page — server redirect component');

  await test('Default export is a function', () => {
    assert.strictEqual(typeof Home, 'function', 'Default export should be a function');
  });

  await test('Default export function is named Home', () => {
    assert.strictEqual(Home.name, 'Home', 'Default export should be named Home');
  });

  await test('File does NOT contain "use client" directive', () => {
    assert.ok(
      !sourceText.includes('"use client"') && !sourceText.includes("'use client'"),
      'page.tsx must not contain a "use client" directive — it must be a server component'
    );
  });

  await test('File imports redirect from next/navigation', () => {
    assert.ok(
      sourceText.includes('from "next/navigation"') || sourceText.includes("from 'next/navigation'"),
      'page.tsx must import redirect from next/navigation'
    );
  });

  await test('File calls redirect("/projects-v4")', () => {
    assert.ok(
      sourceText.includes('redirect("/projects-v4")') || sourceText.includes("redirect('/projects-v4')"),
      'page.tsx must call redirect("/projects-v4")'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

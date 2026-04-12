/**
 * Tests for app/layout — root layout server component verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/layout.test.tsx
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

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
const source = readFileSync(join(__dirname, 'layout.tsx'), 'utf-8');

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('app/layout — root layout server component');

  await test('RootLayout is the default export and is a function', () => {
    assert.ok(
      source.includes('export default function RootLayout'),
      'layout.tsx must export RootLayout as a default function'
    );
  });

  await test('Source text imports AppHeaderShell from @/components/layout', () => {
    assert.ok(
      source.includes('import { AppHeaderShell }') ||
        source.includes('import {AppHeaderShell}'),
      'layout.tsx must import AppHeaderShell'
    );
    assert.ok(
      source.includes('@/components/layout'),
      'layout.tsx must import from @/components/layout'
    );
  });

  await test('Source text contains <AppHeaderShell> wrapping {children}', () => {
    assert.ok(
      source.includes('<AppHeaderShell>'),
      'layout.tsx must contain <AppHeaderShell>'
    );
    assert.ok(
      source.includes('</AppHeaderShell>'),
      'layout.tsx must contain </AppHeaderShell>'
    );
    assert.ok(
      source.includes('{children}'),
      'layout.tsx must place {children} inside AppHeaderShell'
    );
  });

  await test('Source text does NOT contain "use client" directive', () => {
    assert.ok(
      !source.includes('"use client"') && !source.includes("'use client'"),
      'layout.tsx must not contain a "use client" directive — it must remain a server component'
    );
  });

  await test('metadata export exists with title "Orchestration Monitor"', () => {
    assert.ok(
      source.includes('export const metadata'),
      'layout.tsx must export a metadata constant'
    );
    assert.ok(
      source.includes('"Orchestration Monitor"') || source.includes("'Orchestration Monitor'"),
      'metadata.title must equal "Orchestration Monitor"'
    );
  });

  await test('skip-to-content link targets #main-content', () => {
    assert.ok(
      source.includes('href="#main-content"'),
      'layout.tsx must contain a skip-to-content link with href="#main-content"'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

/**
 * Tests for projects/page — module exports and dependency verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/projects/page.test.tsx
 */
import assert from 'node:assert';
import ProjectsPage from './page';
import { ProjectsPlaceholderView } from '@/components/layout';

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

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('projects/page — exports and contracts');

  await test('Default export is a function named ProjectsPage', () => {
    assert.strictEqual(typeof ProjectsPage, 'function', 'Default export should be a function');
    assert.strictEqual(ProjectsPage.name, 'ProjectsPage', 'Default export should be named ProjectsPage');
  });

  await test('ProjectsPlaceholderView is importable from @/components/layout', () => {
    assert.strictEqual(typeof ProjectsPlaceholderView, 'function', 'ProjectsPlaceholderView should be a function');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

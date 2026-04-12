/**
 * Tests for projects/page — module exports and dependency verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/projects/page.test.tsx
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import ProjectsPage from './page';
import { ProjectsPlaceholderView } from '@/components/layout';

// ─── Source text helper ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourceText = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');

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

  await test('Source contains id="main-content" attribute', () => {
    assert.ok(
      sourceText.includes('id="main-content"') || sourceText.includes("id='main-content'"),
      'projects/page.tsx must contain id="main-content" on the wrapper div'
    );
  });

  await test('Source contains min-h-[calc(100dvh-3.5rem)] centering class', () => {
    assert.ok(
      sourceText.includes('min-h-[calc(100dvh-3.5rem)]'),
      'projects/page.tsx must contain the min-h-[calc(100dvh-3.5rem)] centering class'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

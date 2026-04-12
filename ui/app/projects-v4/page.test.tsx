/**
 * Tests for ProjectsV4Page — module exports and ConfigClickContext dependency verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/projects-v4/page.test.tsx
 */
import assert from 'node:assert';
import ProjectsV4Page from './page';
import { useConfigClickContext } from '@/hooks/use-config-click-context';

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
  console.log('projects-v4/page — exports and contracts');

  await test('Default export is a function named ProjectsV4Page', () => {
    assert.strictEqual(typeof ProjectsV4Page, 'function', 'Default export should be a function');
    assert.strictEqual(ProjectsV4Page.name, 'ProjectsV4Page', 'Default export should be named ProjectsV4Page');
  });

  await test('useConfigClickContext is importable from @/hooks/use-config-click-context', () => {
    assert.strictEqual(typeof useConfigClickContext, 'function', 'useConfigClickContext should be a function');
  });

  await test('Module does NOT re-export AppHeader', async () => {
    const mod = await import('./page') as Record<string, unknown>;
    const keys = Object.keys(mod);
    assert.ok(
      !keys.includes('AppHeader'),
      `Module should not export AppHeader, but found keys: ${keys.join(', ')}`
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();

/**
 * Tests for projects-v4/loading — module exports and structure verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/projects-v4/loading.test.tsx
 */
import assert from 'node:assert';
import Loading from './loading';

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
  console.log('projects-v4/loading — exports and contracts');

  await test('Default export is a function named Loading', () => {
    assert.strictEqual(typeof Loading, 'function', 'Default export should be a function');
    assert.strictEqual(Loading.name, 'Loading', 'Default export should be named Loading');
  });

  await test('Module imports without errors', async () => {
    const mod = await import('./loading') as Record<string, unknown>;
    assert.ok(mod.default, 'Module should have a default export');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

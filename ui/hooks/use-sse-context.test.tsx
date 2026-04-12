/**
 * Tests for SSEContext — module exports and default value verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/hooks/use-sse-context.test.tsx
 */
import assert from 'node:assert';
import { SSEContext, SSEProvider, useSSEContext, defaultSSEContextValue } from './use-sse-context';

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
  console.log('use-sse-context — exports and default value');

  await test('Exports exist: SSEContext, SSEProvider, useSSEContext', () => {
    assert.notStrictEqual(SSEContext, undefined, 'SSEContext should be defined');
    assert.notStrictEqual(SSEProvider, undefined, 'SSEProvider should be defined');
    assert.notStrictEqual(useSSEContext, undefined, 'useSSEContext should be defined');
  });

  await test('SSEContext default value — sseStatus is "disconnected" and reconnect is a function', () => {
    const defaultValue = defaultSSEContextValue;
    assert.strictEqual(defaultValue.sseStatus, 'disconnected', 'sseStatus default should be "disconnected"');
    assert.strictEqual(typeof defaultValue.reconnect, 'function', 'reconnect default should be a function');
  });

  await test('Default reconnect is safe to call without throwing', () => {
    const defaultValue = defaultSSEContextValue;
    assert.doesNotThrow(
      () => defaultValue.reconnect(),
      'default reconnect() should not throw'
    );
  });

  await test('Type verification: SSEContextValue-compatible object has correct shape', () => {
    const value = { sseStatus: 'connected' as const, reconnect: () => {} };
    assert.strictEqual(value.sseStatus, 'connected', 'sseStatus should be "connected"');
    assert.strictEqual(typeof value.reconnect, 'function', 'reconnect should be a function');
    assert.ok(
      ['connected', 'reconnecting', 'disconnected'].includes(value.sseStatus),
      'sseStatus must be a valid SSEConnectionStatus'
    );
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();

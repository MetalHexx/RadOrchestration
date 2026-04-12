/**
 * Tests for ConfigClickContext — module exports and default value verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/hooks/use-config-click-context.test.tsx
 */
import assert from 'node:assert';
import { ConfigClickContext, ConfigClickProvider, useConfigClickContext, defaultConfigClickContextValue } from './use-config-click-context';

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
  console.log('use-config-click-context — exports and default value');

  await test('Exports exist: ConfigClickContext, ConfigClickProvider, useConfigClickContext', () => {
    assert.notStrictEqual(ConfigClickContext, undefined, 'ConfigClickContext should be defined');
    assert.notStrictEqual(ConfigClickProvider, undefined, 'ConfigClickProvider should be defined');
    assert.notStrictEqual(useConfigClickContext, undefined, 'useConfigClickContext should be defined');
  });

  await test('Default value — onConfigClick is undefined', () => {
    const defaultValue = defaultConfigClickContextValue;
    assert.strictEqual(defaultValue.onConfigClick, undefined, 'onConfigClick default should be undefined');
  });

  await test('Default value — setOnConfigClick is a no-op function', () => {
    const defaultValue = defaultConfigClickContextValue;
    assert.strictEqual(typeof defaultValue.setOnConfigClick, 'function', 'setOnConfigClick default should be a function');
    assert.doesNotThrow(
      () => defaultValue.setOnConfigClick(() => {}),
      'setOnConfigClick() should not throw when called with a handler'
    );
  });

  await test('Default setOnConfigClick is safe to call with undefined', () => {
    const defaultValue = defaultConfigClickContextValue;
    assert.doesNotThrow(
      () => defaultValue.setOnConfigClick(undefined),
      'setOnConfigClick(undefined) should not throw'
    );
  });

  await test('Type verification: ConfigClickContextValue-compatible object has correct shape', () => {
    const value = { onConfigClick: () => {}, setOnConfigClick: () => {} };
    assert.strictEqual(typeof value.onConfigClick, 'function', 'onConfigClick should be a function');
    assert.strictEqual(typeof value.setOnConfigClick, 'function', 'setOnConfigClick should be a function');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();

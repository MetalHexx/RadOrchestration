import assert from 'node:assert';
import { AppHeaderShell } from './app-header-shell';
import * as barrel from './index';

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

async function run() {
  console.log('app-header-shell — exports and structure');

  await test('AppHeaderShell is exported and is a function', () => {
    assert.strictEqual(typeof AppHeaderShell, 'function');
  });

  await test('AppHeaderShell is re-exported from the barrel', () => {
    assert.strictEqual(typeof barrel.AppHeaderShell, 'function');
  });

  await test('AppHeaderShell.name equals "AppHeaderShell"', () => {
    assert.strictEqual(AppHeaderShell.name, 'AppHeaderShell');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();

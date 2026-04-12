import assert from 'node:assert';
import { AppHeader } from './app-header';
import * as barrel from './index';
import type { NavLink } from './app-header';

// NavLink is a TypeScript interface; this import verifies it is exported from the module.
// The type is erased at runtime — its presence here is a compile-time check only.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _NavLinkCheck = NavLink;

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
  console.log('app-header — exports and structure');

  await test('AppHeader is exported and is a function', () => {
    assert.strictEqual(typeof AppHeader, 'function');
  });

  await test('AppHeader is re-exported from the barrel', () => {
    assert.strictEqual(typeof barrel.AppHeader, 'function');
  });

  await test('AppHeader.name equals "AppHeader"', () => {
    assert.strictEqual(AppHeader.name, 'AppHeader');
  });

  await test('NavLink type is exported from app-header.tsx (compile-time verified)', () => {
    // NavLink is a TypeScript interface (erased at runtime).
    // The import type above confirms it is exported; this test asserts the module loaded.
    assert.strictEqual(typeof AppHeader, 'function');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();

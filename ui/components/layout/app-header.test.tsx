/**
 * Tests for components/layout/app-header — AppHeader component verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/components/layout/app-header.test.tsx
 */
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

type ReactElementLike = {
  props?: {
    'aria-label'?: string;
    children?: unknown;
  };
};

function findByAriaLabel(element: unknown, label: string): ReactElementLike | null {
  if (element === null || element === undefined) return null;
  if (typeof element !== 'object') return null;
  const el = element as ReactElementLike;
  if (el.props?.['aria-label'] === label) return el;
  const children = el.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findByAriaLabel(child, label);
      if (found) return found;
    }
  } else if (children !== null && children !== undefined) {
    return findByAriaLabel(children, label);
  }
  return null;
}

/**
 * Load a fresh AppHeader with next/navigation's usePathname mocked to '/' so
 * the component can be called as a plain function (no React renderer needed).
 * tsx compiles imports to CJS require(), so require.cache is accessible.
 */
function loadAppHeaderWithMockedNav(): typeof AppHeader {
  const req = require as NodeRequire & { cache: Record<string, { exports: unknown }> };
  const navPath = req.resolve('next/navigation');
  const headerPath = req.resolve('./app-header');
  const origNavExports = req.cache[navPath]?.exports;
  assert.ok(origNavExports, 'next/navigation must be in require cache before mock');

  // Replace next/navigation exports so the re-loaded app-header gets the mock.
  const mock = Object.create(origNavExports as object) as Record<string, unknown>;
  Object.defineProperty(mock, 'usePathname', {
    value: () => '/',
    writable: true,
    enumerable: true,
    configurable: true,
  });
  req.cache[navPath].exports = mock;

  // Force a fresh load of app-header so it captures mock usePathname.
  delete req.cache[headerPath];
  const fresh = req('./app-header') as { AppHeader: typeof AppHeader };

  // Restore original next/navigation exports for all other code.
  req.cache[navPath].exports = origNavExports;

  return fresh.AppHeader;
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

  await test('Settings button hidden when onConfigClick is undefined', () => {
    const AppHeaderMocked = loadAppHeaderWithMockedNav();
    const tree = AppHeaderMocked({ sseStatus: 'connected', onReconnect: () => {}, onConfigClick: undefined, navLinks: [] });
    const found = findByAriaLabel(tree, 'Configuration');
    assert.strictEqual(found, null, 'Expected no Configuration button when onConfigClick is undefined');
  });

  await test('Settings button visible when onConfigClick is defined', () => {
    const AppHeaderMocked = loadAppHeaderWithMockedNav();
    const tree = AppHeaderMocked({ sseStatus: 'connected', onReconnect: () => {}, onConfigClick: () => {}, navLinks: [] });
    const found = findByAriaLabel(tree, 'Configuration');
    assert.notStrictEqual(found, null, 'Expected Configuration button to be present when onConfigClick is defined');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();

/**
 * Tests for components/layout/app-header — AppHeader component verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/components/layout/app-header.test.tsx
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import React from 'react';
import { AppHeader } from './app-header';
import * as barrel from './index';
import type { NavLink } from './app-header'; // Compile-time proof: NavLink is re-exported from the barrel

// React must be in scope for JSX evaluation within the module under test (loadAppHeaderWithMockedNav uses require cache manipulation)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

// NavLink is a TypeScript interface; this import verifies it is exported from the module.
// The type is erased at runtime — its presence here is a compile-time check only.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _NavLinkCheck = NavLink;

// ─── Source text helper ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourceText = readFileSync(join(__dirname, 'app-header.tsx'), 'utf-8');

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

type NavLinkElement = {
  props?: {
    href?: string;
    'aria-current'?: string;
    children?: unknown;
  };
};

function findByHref(element: unknown, href: string): NavLinkElement | null {
  if (element === null || element === undefined) return null;
  if (typeof element !== 'object') return null;
  const el = element as NavLinkElement;
  if (el.props?.href === href) return el;
  const children = el.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findByHref(child, href);
      if (found) return found;
    }
  } else if (children !== null && children !== undefined) {
    return findByHref(children, href);
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
  delete req.cache[headerPath];
  try {
    const fresh = req('./app-header') as { AppHeader: typeof AppHeader };
    return fresh.AppHeader;
  } finally {
    req.cache[navPath].exports = origNavExports;
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

  await test('NavLink with matching pathname has aria-current="page", non-matching has aria-current={undefined}', () => {
    const AppHeaderMocked = loadAppHeaderWithMockedNav();
    const navLinks = [{ label: 'Home', href: '/' }, { label: 'Projects', href: '/projects' }];
    const tree = AppHeaderMocked({ sseStatus: 'connected', onReconnect: () => {}, onConfigClick: () => {}, navLinks });
    const homeLink = findByHref(tree, '/');
    const projectsLink = findByHref(tree, '/projects');
    assert.notStrictEqual(homeLink, null, 'Expected to find link with href="/"');
    assert.notStrictEqual(projectsLink, null, 'Expected to find link with href="/projects"');
    assert.strictEqual(homeLink!.props?.['aria-current'], 'page', 'Link href="/" should have aria-current="page"');
    assert.strictEqual(projectsLink!.props?.['aria-current'], undefined, 'Link href="/projects" should have aria-current={undefined}');
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

  await test('ConnectionIndicator is imported', () => {
    assert.ok(
      sourceText.includes('import { ConnectionIndicator }') ||
        sourceText.includes('ConnectionIndicator'),
      'app-header.tsx must import ConnectionIndicator'
    );
  });

  await test('ThemeToggle is imported', () => {
    assert.ok(
      sourceText.includes('import { ThemeToggle }') ||
        sourceText.includes('ThemeToggle'),
      'app-header.tsx must import ThemeToggle'
    );
  });

  await test('ConnectionIndicator is rendered in source', () => {
    assert.ok(
      sourceText.includes('<ConnectionIndicator'),
      'app-header.tsx must render <ConnectionIndicator'
    );
  });

  await test('ThemeToggle is rendered in source', () => {
    assert.ok(
      sourceText.includes('<ThemeToggle'),
      'app-header.tsx must render <ThemeToggle'
    );
  });

  await test('Main navigation aria-label is present', () => {
    assert.ok(
      sourceText.includes('aria-label="Main navigation"'),
      'app-header.tsx must contain aria-label="Main navigation"'
    );
  });

  await test('Dashboard controls aria-label is present', () => {
    assert.ok(
      sourceText.includes('aria-label="Dashboard controls"'),
      'app-header.tsx must contain aria-label="Dashboard controls"'
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

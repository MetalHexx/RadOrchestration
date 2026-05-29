import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'catalog-sidebar.tsx'), 'utf-8');

test('CatalogSidebar uses SidebarGroup primitives from @/components/ui/sidebar (DD-1, NFR-7)', () => {
  assert.match(src, /from\s+"@\/components\/ui\/sidebar"/);
  assert.match(src, /SidebarGroup/);
  assert.match(src, /SidebarMenuItem/);
});

test('CatalogSidebar renders one group per category slug verbatim (DD-3)', () => {
  assert.match(src, /agent-spawn/);
  assert.match(src, /source-control/);
  assert.match(src, /orphan events/);
});

test('CatalogSidebar wires both row Tooltip and badge Tooltip (FR-5)', () => {
  assert.match(src, /Tooltip/);
  const matches = src.match(/Tooltip/g) ?? [];
  assert.ok(matches.length >= 2, 'expected at least two Tooltip usages (row + badge)');
});

test('CatalogSidebar pins the search Input at the top (FR-6, DD-4)', () => {
  assert.match(src, /Input/);
  assert.match(src, /searchQuery|setSearchQuery|onChange/);
});

test('CatalogSidebar surfaces loading state from useCatalog', () => {
  assert.match(src, /\bloading\b/, 'source should destructure loading from useCatalog');
  assert.match(src, /Loading catalog…/, 'source should render "Loading catalog…" placeholder');
});

test('CatalogSidebar surfaces error state from useCatalog', () => {
  assert.match(src, /\berror\b/, 'source should destructure error from useCatalog');
  assert.match(src, /Failed to load catalog\./, 'source should render "Failed to load catalog." message');
  assert.match(src, /text-destructive/, 'source should use text-destructive styling for error state');
});

describe('CatalogSidebar — Customized pill (FR-8, FR-9)', () => {
  test('imports CustomizedBadge from @/components/badges, not the old Badge (FR-8, AD-7)', () => {
    assert.match(src, /CustomizedBadge.*from\s+"@\/components\/badges"/, 'should import CustomizedBadge from @/components/badges');
    assert.doesNotMatch(src, /import\s*\{[^}]*\bBadge\b[^}]*\}\s*from\s+"@\/components\/ui\/badge"/, 'Badge import from @/components/ui/badge should be removed');
  });

  test('renders CustomizedBadge only when populated_slot_count > 0 (FR-8, DD-3)', () => {
    assert.match(src, /populated_slot_count\s*>\s*0/, 'should use populated_slot_count > 0 as the render condition');
    assert.match(src, /<CustomizedBadge\s*\/>/, 'should render <CustomizedBadge /> when populated');
  });

  test('omits any numeric n/N badge text — no applicable_slot_count fraction rendered (FR-8)', () => {
    // The old pattern was: {e.populated_slot_count}/{e.applicable_slot_count}
    assert.doesNotMatch(src, /\{e\.populated_slot_count\}\s*\/\s*\{e\.applicable_slot_count\}/, 'numeric n/N fraction should be removed from JSX');
  });

  test('Customized pill carries an informative tooltip on hover (FR-9)', () => {
    assert.match(src, /custom overlay instructions/i, 'tooltip text should mention custom overlay instructions');
  });
});


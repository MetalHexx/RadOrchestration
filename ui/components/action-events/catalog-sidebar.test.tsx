import { test } from 'node:test';
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

test('CatalogSidebar renders an n/N Badge per entry (FR-4, DD-2)', () => {
  assert.match(src, /Badge/);
  assert.match(src, /populated_slot_count/);
  assert.match(src, /applicable_slot_count/);
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

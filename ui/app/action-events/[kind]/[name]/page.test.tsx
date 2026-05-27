import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');

test('pair page imports UnsavedChangesDialog (FR-22)', () => {
  assert.match(src, /UnsavedChangesDialog/);
});
test('pair page wires onNavigateAttempt into CatalogSidebar (FR-22, DD-10)', () => {
  assert.match(src, /onNavigateAttempt/);
});
test('pair page consumes useDirtyCards anyDirty for the guard (FR-22)', () => {
  assert.match(src, /useDirtyCards/);
  assert.match(src, /anyDirty/);
});

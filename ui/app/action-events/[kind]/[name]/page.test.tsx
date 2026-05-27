import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('ActionEventsPairPage wires useDirtyCards and renders UnsavedChangesDialog (FR-22)', () => {
  const src = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');
  assert.match(src, /useDirtyCards/, 'page.tsx should import useDirtyCards');
  assert.match(src, /UnsavedChangesDialog/, 'page.tsx should import UnsavedChangesDialog');
  assert.match(src, /<UnsavedChangesDialog/, 'page.tsx should render <UnsavedChangesDialog');
});

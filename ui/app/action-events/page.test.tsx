import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('action-events root page exists and is a client component default-export (FR-1)', () => {
  const src = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');
  assert.match(src, /export default function/);
});

test('dynamic [kind]/[name] segment exists (AD-9, FR-7)', () => {
  assert.ok(existsSync(join(__dirname, '[kind]', '[name]', 'page.tsx')));
});

test('ActionEventsPage does not include unused unsaved-changes guard on landing page', () => {
  const src = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');
  assert.doesNotMatch(src, /useDirtyCards/, 'landing page.tsx should not import useDirtyCards');
  assert.doesNotMatch(src, /UnsavedChangesDialog/, 'landing page.tsx should not import UnsavedChangesDialog');
});

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const card = readFileSync(join(__dirname, 'editable-card.tsx'), 'utf-8');
const field = readFileSync(join(__dirname, 'field-error.tsx'), 'utf-8');
const notice = readFileSync(join(__dirname, 'form-error-notice.tsx'), 'utf-8');

test('editable card composes the Card primitive with a title + amber-local accent (DD-4, DD-2)', () => {
  assert.match(card, /from\s+["']@\/components\/ui\/card["']/);
  assert.match(card, /title/);
  assert.match(card, /accent|local/);
  assert.match(card, /--color-warning/);
});

test('field error is plain destructive text, no icon, associated to its input (DD-7, NFR-5)', () => {
  assert.match(field, /text-destructive|--destructive/);
  assert.match(field, /id=/);
  assert.doesNotMatch(field, /lucide-react/);
});

test('form notice renders only when a message is present; destructive banner (FR-22, DD-7)', () => {
  assert.match(notice, /destructive/);
  assert.match(notice, /role=["']alert["']/);
  assert.match(notice, /if\s*\(!?message|message\s*\?|return\s+null/);
});

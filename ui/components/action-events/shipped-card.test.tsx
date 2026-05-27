import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'shipped-card.tsx'), 'utf-8');

test('imports MarkdownRenderer (FR-12)', () => {
  assert.match(src, /@\/components\/documents\/markdown-renderer/);
  assert.match(src, /MarkdownRenderer/);
});
test('imports Card primitives (NFR-7, DD-6)', () => {
  assert.match(src, /@\/components\/ui\/card/);
});
test('renders [category] Badge chip for action cards (DD-6)', () => {
  assert.match(src, /category/);
  assert.match(src, /Badge/);
});
test('renders a → completion_event scroll link for action cards (DD-6)', () => {
  assert.match(src, /completion_event|completionEvent/);
  assert.match(src, /→|->/);
});
test('renders synthesized Signal: block at bottom of event card (FR-13, DD-7)', () => {
  assert.match(src, /signal_line|signalLine/);
  assert.match(src, /Composed Signal|font-mono/);
});
test('uses subdued surface to signal inertness (NFR-2)', () => {
  assert.match(src, /bg-muted|muted\/|subdued/);
});

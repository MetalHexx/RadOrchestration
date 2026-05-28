import { test, describe } from 'node:test';
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
test('ActionShipped interface retains category and completion_event fields (DD-6)', () => {
  // The interface fields are preserved for type-safety even though decorations are removed
  assert.match(src, /category/);
  assert.match(src, /completion_event/);
});
test('EventShipped interface retains signal_line field (FR-13, DD-7)', () => {
  assert.match(src, /signal_line/);
});
test('uses subdued surface to signal inertness (NFR-2)', () => {
  assert.match(src, /bg-muted|muted\/|subdued/);
});

describe('ShippedCard — visual cleanup (FR-11, FR-12, FR-13, FR-15)', () => {
  test('no longer imports Badge for decorative shipped · read-only header badge (FR-13)', () => {
    // Badge import only existed to render the top-right "shipped · read-only" chip;
    // after cleanup it should be removed
    assert.doesNotMatch(src, /import.*Badge.*from\s+"@\/components\/ui\/badge"/);
  });

  test('no longer renders [category] Badge chip in CardDescription (FR-11)', () => {
    // category chip: <Badge variant="secondary">[{data.category}]</Badge>
    assert.doesNotMatch(src, /\[.*category.*\]/);
    assert.doesNotMatch(src, /variant="secondary"/);
  });

  test('no longer renders completion_event scroll button (FR-12, DD-10)', () => {
    // old pattern: <button type="button" onClick={onJumpToCompletionEvent}
    assert.doesNotMatch(src, /onJumpToCompletionEvent/);
    assert.doesNotMatch(src, /<button[^>]*onClick/);
  });

  test('no longer renders Composed Signal block for event cards (FR-15)', () => {
    assert.doesNotMatch(src, /Composed Signal/);
  });

  test('no longer has top-right shipped · read-only badge in header (FR-13)', () => {
    assert.doesNotMatch(src, /shipped · read-only/);
  });

  test('CardHeader has data-testid slot-card-header (FR-13, DD-4)', () => {
    assert.match(src, /data-testid="slot-card-header"/);
  });

  test('CardDescription renders title as italic (FR-13)', () => {
    assert.match(src, /italic/);
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { applicableSlotsFor, slotLabelFor } from './pair-view-meta';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'pair-view.tsx'), 'utf-8');

test('applicableSlotsFor returns 5 entries for action with completion_event (FR-8)', () => {
  const slots = applicableSlotsFor({ kind: 'action', name: 'exec', completion_event: 'done' });
  assert.strictEqual(slots.length, 5);
  assert.deepStrictEqual(slots.map((s) => s.role), ['custom-action-pre', 'shipped-action', 'custom-event-pre', 'shipped-event', 'custom-event-post']);
});

test('applicableSlotsFor returns 2 entries for terminal action (FR-9)', () => {
  const slots = applicableSlotsFor({ kind: 'action', name: 'halt', completion_event: null });
  assert.strictEqual(slots.length, 2);
  assert.deepStrictEqual(slots.map((s) => s.role), ['custom-action-pre', 'shipped-action']);
});

test('applicableSlotsFor returns shipped + post slots for an orphan event (FR-9)', () => {
  // Orphan events surface only the shipped body and the post slot. The post
  // content is wired by the engine to prepend the next action's prompt under
  // "## After signaling" when the orphan event fires. Pre stays hidden — there
  // is no specific signalling agent the pre content could address.
  const slots = applicableSlotsFor({ kind: 'event', name: 'lonely', is_orphan: true });
  assert.strictEqual(slots.length, 2);
  assert.deepStrictEqual(slots.map((s) => s.role), ['shipped-event', 'custom-event-post']);
});

test('applicableSlotsFor returns 3 entries for a non-orphan event (FR-9)', () => {
  // Non-orphan events (some action signals them as its completion event) keep
  // the full 3-slot envelope so their pre/post customs can be edited.
  const slots = applicableSlotsFor({ kind: 'event', name: 'final_approved', is_orphan: false });
  assert.strictEqual(slots.length, 3);
  assert.deepStrictEqual(slots.map((s) => s.role), ['custom-event-pre', 'shipped-event', 'custom-event-post']);
});

test('slotLabelFor numbers per FR-8 firing order', () => {
  assert.match(slotLabelFor('custom-action-pre'), /^1\./);
  assert.match(slotLabelFor('shipped-action'), /^2\./);
  assert.match(slotLabelFor('custom-event-pre'), /^3\./);
  assert.match(slotLabelFor('shipped-event'), /^4\./);
  assert.match(slotLabelFor('custom-event-post'), /^5\./);
});

test('PairView renders header arrow for non-terminal actions and italic description (FR-10, DD-8)', () => {
  assert.match(src, /→/);
  assert.match(src, /italic/);
});

test('PairView wires Preview and Help buttons in header right cluster (FR-11, DD-8)', () => {
  assert.match(src, /Preview/);
  assert.match(src, /Help|\?/);
});

test('PairView refreshes catalog after persist (FR-21, AD-8)', () => {
  assert.match(src, /refresh/);
});

test('PairView onOpenPreview receives (overlay, completionEvent) — completion_event threaded through preview seam (FR-24)', () => {
  // 1. The onOpenPreview prop signature must contain a second parameter (completionEvent or completion_event)
  assert.match(src, /onOpenPreview\?\s*:\s*\(overlay\s*:\s*Record<string,\s*string>,\s*completionEvent\s*:\s*string\s*\|\s*null\)\s*=>\s*void/);
  // 2. The call site that invokes onOpenPreview must pass two arguments
  assert.match(src, /onOpenPreview\?\.\(\s*\{[^}]*\}\s*,\s*\w+\s*\)/);
});

describe('PairView — visual cleanup (FR-10..FR-16)', () => {
  test('slot labels render without — custom or — shipped · read-only suffixes (FR-10)', () => {
    // slotLabelFor must not append the old decorative suffixes
    assert.doesNotMatch(slotLabelFor('custom-action-pre'), /—\s*custom/i);
    assert.doesNotMatch(slotLabelFor('shipped-action'), /—\s*shipped/i);
    assert.doesNotMatch(slotLabelFor('custom-event-pre'), /—\s*custom/i);
    assert.doesNotMatch(slotLabelFor('shipped-event'), /—\s*shipped/i);
    assert.doesNotMatch(slotLabelFor('custom-event-post'), /—\s*custom/i);
    // Exact clean labels
    assert.strictEqual(slotLabelFor('custom-action-pre'), '1. Before doing this action');
    assert.strictEqual(slotLabelFor('shipped-action'), '2. Action');
    assert.strictEqual(slotLabelFor('custom-event-pre'), '3. Before signaling');
    assert.strictEqual(slotLabelFor('shipped-event'), '4. When complete');
    assert.strictEqual(slotLabelFor('custom-event-post'), '5. After signaling');
  });

  test('PairView removes card4Ref and onJumpToCompletionEvent wiring (FR-12, DD-9, DD-10)', () => {
    assert.doesNotMatch(src, /card4Ref/);
    assert.doesNotMatch(src, /onJumpToCompletionEvent/);
  });

  test('PairView shipped-event slot renders without wrapping div ref (DD-9)', () => {
    // The old code had: <div key={role} ref={card4Ref}>
    // After cleanup it renders ShippedCard directly (no ref wrapper div)
    assert.doesNotMatch(src, /ref=\{card4Ref\}/);
  });

  test('editable-card placeholders are slimmed — no Save creates custom/ directive (FR-16)', () => {
    assert.doesNotMatch(src, /Save creates custom\//);
  });

  test('page-level header arrow remains (DD-9) but shipped-action slot has no onJumpToCompletionEvent prop', () => {
    // The header still uses → for non-terminal actions
    assert.match(src, /→/);
    // But the prop is removed from the ShippedCard call
    assert.doesNotMatch(src, /onJumpToCompletionEvent/);
  });
});

describe('PairView — is_orphan threading for Preview drawer (FR-18, FR-23, AD-3)', () => {
  test('subject object carries is_orphan from entry (FR-18, AD-3)', () => {
    // PairView must read is_orphan from the catalog entry and include it in the
    // subject object so that applicableSlotsFor and the Preview callback can consume it.
    assert.match(src, /is_orphan.*entry\.is_orphan|entry\.is_orphan.*is_orphan/s,
      'subject construction must include is_orphan from entry');
    assert.match(src, /is_orphan:\s*entry\.is_orphan/, 'subject must set is_orphan: entry.is_orphan');
  });

  test('DrawerMode type admits is_orphan on the preview branch (FR-18)', () => {
    // The DrawerMode type in instruction-drawer.tsx must include is_orphan?: boolean
    // on the preview branch so onOpenPreview callers can pass it.
    const drawerSrc = readFileSync(join(__dirname, 'instruction-drawer.tsx'), 'utf-8');
    assert.match(drawerSrc, /is_orphan\s*\??\s*:\s*boolean/,
      'DrawerMode preview branch must declare is_orphan?: boolean');
  });
});

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listCatalogEntries, readShippedEntry } from './action-events-fs';

function seedRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-fs-'));
  fs.mkdirSync(path.join(root, 'custom'), { recursive: true });
  fs.writeFileSync(path.join(root, 'action.spawn_x.md'),
    '---\nkind: action\nname: spawn_x\ntitle: Spawn X\ndescription: Spawn an X agent.\ncategory: agent-spawn\ncompletion_event: x_done\n---\n\nBody.\n');
  fs.writeFileSync(path.join(root, 'event.x_done.md'),
    '---\nkind: event\nname: x_done\ntitle: X Done\ndescription: X done signal.\nsignal_payload:\n  status:\n    required: true\n    description: outcome\n---\n\nEvent body.\n');
  fs.writeFileSync(path.join(root, 'event.orphan_evt.md'),
    '---\nkind: event\nname: orphan_evt\ntitle: Orphan\ndescription: Orphan event.\nsignal_payload: {}\n---\n\nOrphan body.\n');
  fs.writeFileSync(path.join(root, 'malformed.md'), '---\nkind: action\n---\nincomplete\n');
  fs.writeFileSync(path.join(root, 'custom', 'action.spawn_x.pre.md'), 'custom\n');
  return root;
}

test('listCatalogEntries returns parseable entries with slot counts and signal_line (FR-26, FR-32, AD-11)', () => {
  const root = seedRoot();
  const entries = listCatalogEntries(root);
  const action = entries.find((e) => e.kind === 'action' && e.name === 'spawn_x')!;
  assert.strictEqual(action.applicable_slot_count, 3);
  assert.strictEqual(action.populated_slot_count, 1);
  assert.strictEqual(action.category, 'agent-spawn');
  assert.strictEqual(action.completion_event, 'x_done');
  const evt = entries.find((e) => e.kind === 'event' && e.name === 'x_done')!;
  assert.strictEqual(evt.applicable_slot_count, 2);
  assert.strictEqual(evt.populated_slot_count, 0);
  assert.strictEqual(evt.signal_line, 'Signal: x_done --status <value>');
  const orphan = entries.find((e) => e.kind === 'event' && e.name === 'orphan_evt')!;
  assert.strictEqual(orphan.signal_line, 'Signal: orphan_evt');
  assert.ok(!entries.some((e) => (e as any).name === 'malformed'), 'malformed entry skipped');
});

test('readShippedEntry returns body and frontmatter for a known action (FR-27)', () => {
  const root = seedRoot();
  const res = readShippedEntry(root, 'action', 'spawn_x');
  assert.strictEqual(res?.kind, 'action');
  assert.strictEqual(res?.title, 'Spawn X');
  assert.strictEqual(res?.category, 'agent-spawn');
  assert.strictEqual(res?.completion_event, 'x_done');
  assert.match(res!.body, /Body\./);
});

test('readShippedEntry returns null for missing entry (FR-27)', () => {
  const root = seedRoot();
  assert.strictEqual(readShippedEntry(root, 'action', 'nope'), null);
});

test('listCatalogEntries marks unreferenced events as is_orphan: true and referenced events as is_orphan: false (FR-3)', () => {
  const root = seedRoot();
  const entries = listCatalogEntries(root);
  // x_done is referenced by spawn_x's completion_event → not an orphan
  const referenced = entries.find((e) => e.kind === 'event' && e.name === 'x_done')!;
  assert.strictEqual(referenced.is_orphan, false);
  // orphan_evt is not referenced by any action → is an orphan
  const orphan = entries.find((e) => e.kind === 'event' && e.name === 'orphan_evt')!;
  assert.strictEqual(orphan.is_orphan, true);
  // action entries are never orphans
  const action = entries.find((e) => e.kind === 'action' && e.name === 'spawn_x')!;
  assert.strictEqual(action.is_orphan, false);
});

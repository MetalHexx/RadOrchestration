import { test } from 'node:test';
import assert from 'node:assert';
import { groupCatalog } from './use-catalog';

test('groupCatalog splits actions into four category buckets and an orphan-events bucket (FR-2, FR-3)', () => {
  const entries = [
    { kind: 'action', name: 'a1', category: 'agent-spawn', completion_event: 'e1', applicable_slot_count: 3, populated_slot_count: 0, title: 't', description: 'd' },
    { kind: 'action', name: 'a2', category: 'gate', completion_event: 'e2', applicable_slot_count: 3, populated_slot_count: 0, title: 't', description: 'd' },
    { kind: 'action', name: 'a3', category: 'terminal', completion_event: null, applicable_slot_count: 1, populated_slot_count: 0, title: 't', description: 'd' },
    { kind: 'action', name: 'a4', category: 'source-control', completion_event: 'e4', applicable_slot_count: 3, populated_slot_count: 0, title: 't', description: 'd' },
    { kind: 'event', name: 'e1', is_orphan: false, applicable_slot_count: 0, populated_slot_count: 0, title: 't', description: 'd', signal_line: 'Signal: e1' },
    { kind: 'event', name: 'lonely', is_orphan: true, applicable_slot_count: 2, populated_slot_count: 1, title: 't', description: 'd', signal_line: 'Signal: lonely' },
  ] as any;
  const groups = groupCatalog(entries);
  assert.deepStrictEqual(groups.actions['agent-spawn'].map((e) => e.name), ['a1']);
  assert.deepStrictEqual(groups.actions['gate'].map((e) => e.name), ['a2']);
  assert.deepStrictEqual(groups.actions['terminal'].map((e) => e.name), ['a3']);
  assert.deepStrictEqual(groups.actions['source-control'].map((e) => e.name), ['a4']);
  assert.deepStrictEqual(groups.orphans.map((e) => e.name), ['lonely']);
});

test('groupCatalog routes only is_orphan events to the orphan bucket (FR-3)', () => {
  const entries = [
    { kind: 'event', name: 'orphan_one', is_orphan: true, applicable_slot_count: 2, populated_slot_count: 0, title: 't', description: 'd', signal_line: 'Signal: orphan_one' },
    { kind: 'event', name: 'paired_evt', is_orphan: false, applicable_slot_count: 2, populated_slot_count: 0, title: 't', description: 'd', signal_line: 'Signal: paired_evt' },
  ] as any;
  const groups = groupCatalog(entries);
  assert.deepStrictEqual(groups.orphans.map((e: any) => e.name), ['orphan_one']);
  assert.strictEqual(groups.orphans.some((e: any) => e.name === 'paired_evt'), false);
});

test('groupCatalog applies case-insensitive name-substring filter and hides empty groups (FR-6)', () => {
  const entries = [
    { kind: 'action', name: 'spawn_phase_reviewer', category: 'agent-spawn', completion_event: 'x', applicable_slot_count: 3, populated_slot_count: 0, title: 't', description: 'd' },
    { kind: 'action', name: 'gate_phase', category: 'gate', completion_event: 'y', applicable_slot_count: 3, populated_slot_count: 0, title: 't', description: 'd' },
    { kind: 'event', name: 'lonely', is_orphan: true, applicable_slot_count: 2, populated_slot_count: 0, title: 't', description: 'd', signal_line: 'Signal: lonely' },
  ] as any;
  const groups = groupCatalog(entries, 'SPAWN');
  assert.deepStrictEqual(groups.actions['agent-spawn'].map((e) => e.name), ['spawn_phase_reviewer']);
  assert.strictEqual(groups.actions['gate'].length, 0);
  assert.strictEqual(groups.orphans.length, 0);
});

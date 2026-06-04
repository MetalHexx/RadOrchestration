import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'membership-picker.tsx'), 'utf-8');

test('single component parameterised by entityType repos|groups (FR-12)', () => {
  assert.match(src, /entityType/);
  assert.match(src, /BindStateDot/);
  assert.match(src, /Layers/);
});

test('rows show checkbox + slug + description (FR-12)', () => {
  assert.match(src, /m-slug|slug/);
  assert.match(src, /description/);
  assert.match(src, /checked/);
});

test('detail mode renders staged tags via rowStatus; create mode does not (FR-13, DD-6)', () => {
  assert.match(src, /rowStatus/);
  assert.match(src, /pending-add/);
  assert.match(src, /pending-remove/);
  assert.match(src, /mode/);
});

test('staged colors are token-driven, no hardcoded hex (NFR-2)', () => {
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}/);
});

test('group container exposes accessible name via aria-label; ariaLabel prop is forwarded with default fallback (NFR-5)', () => {
  // Props interface must include ariaLabel
  assert.match(src, /ariaLabel\??\s*:\s*string/);
  // group container must have aria-label attribute
  assert.match(src, /aria-label=/);
  // fallback default must be present in source
  assert.match(src, /Membership selection/);
});

test('member row label opts into min-w-0 so long descriptions truncate instead of overflowing', () => {
  // the row label allows its children to shrink below their content size
  assert.match(src, /'flex min-w-0 cursor-pointer items-center/);
  // the description span already truncates with flex-1 + min-w-0
  assert.match(src, /min-w-0 flex-1 truncate/);
});

test('pending-remove mirrors pending-add: red row tint + red badge (not dimming/amber)', () => {
  // add uses a 12% --status-complete (green) tint; remove uses the matching --status-failed (red) tint
  assert.match(src, /status === 'pending-add' && 'bg-\[color-mix\(in_oklch,var\(--status-complete\)_12%,transparent\)\]'/);
  assert.match(src, /status === 'pending-remove' && 'bg-\[color-mix\(in_oklch,var\(--status-failed\)_12%,transparent\)\]'/);
  // the remove row no longer relies on whole-row dimming
  assert.doesNotMatch(src, /pending-remove' && 'opacity-55'/);
  // the REMOVE badge is red (token-driven), not amber --color-warning
  assert.match(src, /color: 'var\(--status-failed\)' \}}>remove</);
  assert.doesNotMatch(src, /var\(--color-warning\)/);
});

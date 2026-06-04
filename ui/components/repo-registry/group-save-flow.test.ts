import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { validateGroupDraft, validateGroupDraftField, groupDraftFrom } from './group-save-flow';
import type { RepoGroupRead } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pane = readFileSync(join(__dirname, 'group-detail-pane.tsx'), 'utf-8');
const group: RepoGroupRead = { slug: 'g', description: 'd', members: ['a', 'b'] };

test('groupDraftFrom seeds description + members (FR-9)', () => {
  const d = groupDraftFrom(group);
  assert.strictEqual(d.description, 'd');
  assert.deepStrictEqual(d.members, ['a', 'b']);
});

test('client mirror requires a non-empty description with a Proper-Case label (FR-23, FR-21)', () => {
  assert.deepStrictEqual(validateGroupDraft({ description: '  ', members: [] }), { description: 'Description is required.' });
  assert.deepStrictEqual(validateGroupDraft({ description: 'd', members: [] }), {});
});

test('validateGroupDraftField + onBlur wiring on the description input', () => {
  assert.strictEqual(validateGroupDraftField('description', { description: '', members: [] }), 'Description is required.');
  assert.strictEqual(validateGroupDraftField('description', { description: 'd', members: [] }), undefined);
  assert.match(pane, /onBlur=\{\(\) => handleBlur\('description'\)\}/);
});

test('pane saves via PUT, reconciles, deletes via DELETE with "repos stay" copy (FR-18, FR-20, AD-2, AD-3)', () => {
  assert.match(pane, /PUT/);
  assert.match(pane, /\/api\/repo-groups\//);
  assert.match(pane, /DELETE/);
  assert.match(pane, /repos stay|member repos.*stay/i);
  assert.match(pane, /upsertGroup|removeGroup/);
});

test('pane memoizes the draft baseline keyed on the group prop (P07 F-21)', () => {
  assert.match(pane, /useMemo/);
  assert.match(pane, /const baseline = useMemo\(\s*\(\)\s*=>\s*groupDraftFrom\(group\),\s*\[group\]\s*\)/);
});

test('delete-confirm Cancel closes the controlled dialog without nesting buttons (PR #109 review)', () => {
  // the dialog is controlled, so Cancel closes it by setting confirmOpen false
  assert.match(pane, /onClick=\{\(\) => setConfirmOpen\(false\)\}/);
  // DialogClose must not wrap our <Button> — Base UI Close renders its own button (nested buttons)
  assert.doesNotMatch(pane, /DialogClose/);
});

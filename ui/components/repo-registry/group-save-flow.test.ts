import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { validateGroupDraft, groupDraftFrom } from './group-save-flow';
import type { RepoGroupRead } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pane = readFileSync(join(__dirname, 'group-detail-pane.tsx'), 'utf-8');
const group: RepoGroupRead = { slug: 'g', description: 'd', members: ['a', 'b'] };

test('groupDraftFrom seeds description + members (FR-9)', () => {
  const d = groupDraftFrom(group);
  assert.strictEqual(d.description, 'd');
  assert.deepStrictEqual(d.members, ['a', 'b']);
});

test('client mirror requires a non-empty description (FR-23, FR-21)', () => {
  assert.deepStrictEqual(validateGroupDraft({ description: '  ', members: [] }), { description: 'description is required.' });
  assert.deepStrictEqual(validateGroupDraft({ description: 'd', members: [] }), {});
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

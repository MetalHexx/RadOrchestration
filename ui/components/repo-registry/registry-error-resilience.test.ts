import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(__dirname, f), 'utf-8');

const requests = read('registry-requests.ts');
const addRepo = read('add-repo-drawer.tsx');
const addGroup = read('add-group-drawer.tsx');
const repoPane = read('repo-detail-pane.tsx');
const groupPane = read('group-detail-pane.tsx');

test('registry-requests exports a shared network-failure message for catch branches', () => {
  assert.match(requests, /export const NETWORK_ERROR_MESSAGE\s*=/);
});

// A rejected fetch (network error / aborted request) must surface a user-visible
// error instead of silently reverting and becoming an unhandled rejection.
for (const [name, src] of [
  ['add-repo-drawer', addRepo],
  ['add-group-drawer', addGroup],
  ['repo-detail-pane', repoPane],
  ['group-detail-pane', groupPane],
] as const) {
  test(`${name} catches thrown fetch failures and shows NETWORK_ERROR_MESSAGE`, () => {
    assert.match(src, /import\s+\{[^}]*NETWORK_ERROR_MESSAGE[^}]*\}\s+from\s+['"]\.\/registry-requests['"]/);
    assert.match(src, /catch\s*\{[\s\S]*?setFormError\(NETWORK_ERROR_MESSAGE\)/);
  });
}

test('detail panes wire a catch on both the save and the remove/delete handlers', () => {
  // two independent fetch handlers each → two catch branches setting the message
  assert.strictEqual((repoPane.match(/setFormError\(NETWORK_ERROR_MESSAGE\)/g) || []).length, 2);
  assert.strictEqual((groupPane.match(/setFormError\(NETWORK_ERROR_MESSAGE\)/g) || []).length, 2);
});

test('add-repo-drawer trims pasted local paths so trailing whitespace cannot trip PATH_INVALID', () => {
  assert.match(addRepo, /getData\(['"]text['"]\)\.trim\(\)/);
});

test('group description textarea has an accessible name (aria-label)', () => {
  assert.match(groupPane, /<Textarea[\s\S]*?aria-label="Description"[\s\S]*?id="group-description"|id="group-description"[\s\S]*?aria-label="Description"/);
});

test('detail panes use a single-layer px-6 py-4 scroll padding (matches /projects, no double-padding)', () => {
  assert.match(repoPane, /overflow-y-auto px-6 py-4/);
  assert.match(groupPane, /overflow-y-auto px-6 py-4/);
  assert.doesNotMatch(repoPane, /px-7 pt-6/);
  assert.doesNotMatch(groupPane, /px-7 pt-6/);
});

test('add-repo-drawer local path is typeable: not readOnly, onChange wired to form.localPath', () => {
  // the create-repo local path Input accepts typed input
  assert.match(addRepo, /id="create-repo-local-path"[\s\S]*?onChange=\{e => setForm\(prev => \(\{ \.\.\.prev, localPath: e\.target\.value \}\)\)\}/);
  // and must no longer be read-only
  assert.doesNotMatch(addRepo, /id="create-repo-local-path"[\s\S]*?readOnly/);
});

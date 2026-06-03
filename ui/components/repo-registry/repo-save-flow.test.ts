import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { validateRepoDraft, repoDraftFrom } from './repo-save-flow';
import type { RepoRead } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pane = readFileSync(join(__dirname, 'repo-detail-pane.tsx'), 'utf-8');

const repo: RepoRead = {
  slug: 'a', remote: 'github.com/x/a', defaultBranch: 'main',
  description: 'd', groups: ['g'], bind: { state: 'bound', path: 'p' },
};

test('repoDraftFrom seeds the editable draft from a RepoRead, localPath blank for unbound (FR-5)', () => {
  const d = repoDraftFrom(repo);
  assert.strictEqual(d.remote, 'github.com/x/a');
  assert.deepStrictEqual(d.groups, ['g']);
  assert.strictEqual(d.localPath, 'p');
  const unbound = repoDraftFrom({ ...repo, bind: { state: 'unbound', path: null } });
  assert.strictEqual(unbound.localPath, '');
});

test('client mirror flags empty required fields before save (FR-23, FR-21)', () => {
  const errs = validateRepoDraft({ remote: '', defaultBranch: 'main', description: 'd', localPath: '', groups: [] });
  assert.strictEqual(errs.remote, 'remote is required.');
  assert.ok(!('localPath' in errs)); // blank localPath = leave bind unchanged, not an error
});

test('valid draft yields no client errors (FR-23)', () => {
  const errs = validateRepoDraft({ remote: 'r', defaultBranch: 'main', description: 'd', localPath: '', groups: [] });
  assert.deepStrictEqual(errs, {});
});

test('pane saves via PUT, reconciles response, removes via DELETE with cascade copy (FR-17, FR-19, AD-2, AD-3)', () => {
  assert.match(pane, /PUT/);
  assert.match(pane, /`\/api\/repos\/\$\{[^}]+\}`|\/api\/repos\//);
  assert.match(pane, /DELETE/);
  assert.match(pane, /dropped from every group|local binding is removed/i);
  assert.match(pane, /upsertRepo|onSaved/);
});

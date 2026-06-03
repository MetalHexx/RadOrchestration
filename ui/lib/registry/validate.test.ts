import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { RegistryError, statusForCode } from './errors.js';
import {
  validateSlug, validateRequired, validateDirectory,
  validateUniqueName, normalizeRemote,
} from './validate.js';

test('statusForCode maps every code to its HTTP status (AD-5)', () => {
  assert.equal(statusForCode('SLUG_INVALID'), 400);
  assert.equal(statusForCode('NAME_TAKEN'), 409);
  assert.equal(statusForCode('REQUIRED'), 400);
  assert.equal(statusForCode('PATH_INVALID'), 400);
  assert.equal(statusForCode('NOT_FOUND'), 404);
  assert.equal(statusForCode('IMMUTABLE_SLUG'), 400);
});

test('validateSlug throws SLUG_INVALID on field "slug" for bad slug (AD-4, AD-5)', () => {
  let err: RegistryError | undefined;
  try { validateSlug('Bad Slug'); } catch (e) { err = e as RegistryError; }
  assert.ok(err instanceof RegistryError);
  assert.equal(err.code, 'SLUG_INVALID');
  assert.equal(err.field, 'slug');
});

test('validateRequired throws REQUIRED naming the field for empty string (AD-4)', () => {
  let err: RegistryError | undefined;
  try { validateRequired('', 'description'); } catch (e) { err = e as RegistryError; }
  assert.ok(err instanceof RegistryError);
  assert.equal(err.code, 'REQUIRED');
  assert.equal(err.field, 'description');
});

test('validateDirectory passes for an existing dir, throws PATH_INVALID otherwise (AD-4)', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'val-'));
  try {
    assert.doesNotThrow(() => validateDirectory(dir, 'localPath'));
    let err: RegistryError | undefined;
    try { validateDirectory(path.join(dir, 'nope'), 'localPath'); } catch (e) { err = e as RegistryError; }
    assert.ok(err instanceof RegistryError);
    assert.equal(err.code, 'PATH_INVALID');
    assert.equal(err.field, 'localPath');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('validateUniqueName throws NAME_TAKEN across both namespaces (AD-4, AD-5)', () => {
  const reg = { repos: { foo: {} as never }, repoGroups: { bar: {} as never }, localPaths: {} };
  let e1: RegistryError | undefined;
  try { validateUniqueName(reg as never, 'foo'); } catch (e) { e1 = e as RegistryError; }
  assert.ok(e1 instanceof RegistryError);
  assert.equal(e1.code, 'NAME_TAKEN');
  let e2: RegistryError | undefined;
  try { validateUniqueName(reg as never, 'bar'); } catch (e) { e2 = e as RegistryError; }
  assert.ok(e2 instanceof RegistryError);
  assert.equal(e2.code, 'NAME_TAKEN');
  assert.doesNotThrow(() => validateUniqueName(reg as never, 'baz'));
});

test('normalizeRemote strips trailing .git (AD-4)', () => {
  assert.equal(normalizeRemote('github.com/a/b.git'), 'github.com/a/b');
  assert.equal(normalizeRemote('github.com/a/b'), 'github.com/a/b');
});

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  isSlugValid, isRequiredFilled, isLocalPathFilled, previewRemote,
  isRemoteUrlValid, FIELD_LABELS, requiredMessage, SLUG_FORMAT_MESSAGE, REMOTE_URL_MESSAGE,
} from './validation-mirror';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'validation-mirror.ts'), 'utf-8');

test('slug rule matches the server regex (AD-5)', () => {
  assert.strictEqual(isSlugValid('checkout-api'), true);
  assert.strictEqual(isSlugValid('a'), true);
  assert.strictEqual(isSlugValid('Checkout'), false);
  assert.strictEqual(isSlugValid('-x'), false);
  assert.strictEqual(isSlugValid('x-'), false);
  assert.strictEqual(isSlugValid('x--y'), false);
  assert.strictEqual(isSlugValid(''), false);
});

test('required-filled and local-path-filled treat whitespace as empty (AD-5)', () => {
  assert.strictEqual(isRequiredFilled('main'), true);
  assert.strictEqual(isRequiredFilled('   '), false);
  assert.strictEqual(isLocalPathFilled('C:\\dev\\x'), true);
  assert.strictEqual(isLocalPathFilled(''), false);
});

test('remote preview mirrors normalizeRemote: trim, strip one .git, ssh→https (AD-5)', () => {
  assert.strictEqual(previewRemote(' github.com/a/b.git '), 'github.com/a/b');
  assert.strictEqual(previewRemote('git@github.com:a/b.git'), 'https://github.com/a/b');
  assert.strictEqual(previewRemote('http://x/y'), 'http://x/y');
});

test('isRemoteUrlValid accepts real remote forms, incl. scheme-less hosts the registry supports', () => {
  for (const ok of [
    'https://github.com/org/repo',
    'http://github.com/org/repo',
    'https://github.com/org/repo.git',
    'ssh://git@github.com/org/repo',
    'git@github.com:org/repo',          // scp-style ssh
    'git@github.com:org/repo.git',
    'github.com/org/repo',              // scheme-less dotted host (preserved by the registry)
    'github.com',
    'https://gitlab.example.com:8443/team/repo',
    'http://localhost:3000/repo',
    'internalhost/repo',               // dot-less self-hosted host + path
  ]) {
    assert.strictEqual(isRemoteUrlValid(ok), true, `expected valid: ${ok}`);
  }
});

test('isRemoteUrlValid rejects empty / hostless garbage (this is what let hhh through)', () => {
  for (const bad of ["'''", '', '   ', 'r', 'hhh', 'foo bar', 'not a url']) {
    assert.strictEqual(isRemoteUrlValid(bad), false, `expected invalid: ${JSON.stringify(bad)}`);
  }
});

test('field labels are Proper-Case and drive consistent required messages', () => {
  assert.strictEqual(FIELD_LABELS.localPath, 'Local Path');
  assert.strictEqual(FIELD_LABELS.defaultBranch, 'Default Branch');
  assert.strictEqual(requiredMessage('localPath'), 'Local Path is required.');
  assert.strictEqual(requiredMessage('remote'), 'Remote is required.');
  assert.match(SLUG_FORMAT_MESSAGE, /lowercase-kebab/);
  assert.match(REMOTE_URL_MESSAGE, /valid URL/);
});

test('mirror is browser-safe: no node:fs, no library import (NFR-1, AD-5)', () => {
  assert.doesNotMatch(src, /node:fs/);
  assert.doesNotMatch(src, /@rad-orchestration\/repo-registry/);
  assert.doesNotMatch(src, /lib\/registry\/validate/);
});

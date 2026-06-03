import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { isSlugValid, isRequiredFilled, isLocalPathFilled, previewRemote } from './validation-mirror';

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

test('mirror is browser-safe: no node:fs, no library import (NFR-1, AD-5)', () => {
  assert.doesNotMatch(src, /node:fs/);
  assert.doesNotMatch(src, /@rad-orchestration\/repo-registry/);
  assert.doesNotMatch(src, /lib\/registry\/validate/);
});

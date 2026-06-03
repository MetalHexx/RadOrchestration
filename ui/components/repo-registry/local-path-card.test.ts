import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { pathCardCopy } from './local-path-card';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'local-path-card.tsx'), 'utf-8');

test('unbound shows helper copy + placeholder, no warning (FR-7, DD-2)', () => {
  const c = pathCardCopy('unbound');
  assert.ok(c.helper && /this machine/i.test(c.helper));
  assert.strictEqual(c.warning, undefined);
  assert.ok(c.placeholder);
});

test('missing shows the re-point warning + red treatment, no helper (FR-7, DD-2, DD-7)', () => {
  const c = pathCardCopy('missing');
  assert.ok(c.warning && /no longer exists/i.test(c.warning));
  assert.strictEqual(c.isInvalid, true);
});

test('bound shows neither helper nor warning (FR-6)', () => {
  const c = pathCardCopy('bound');
  assert.strictEqual(c.helper, undefined);
  assert.strictEqual(c.warning, undefined);
  assert.strictEqual(c.isInvalid, false);
});

test('card uses EditableCard with the local (amber) accent and a server-error slot (DD-2, DD-7)', () => {
  assert.match(src, /EditableCard/);
  assert.match(src, /accent="local"|accent={'local'}/);
  assert.match(src, /FieldError/);
});

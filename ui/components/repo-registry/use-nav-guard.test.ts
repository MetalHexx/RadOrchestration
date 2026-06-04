import { test } from 'node:test';
import assert from 'node:assert';
import { resolveGuard } from './use-nav-guard';

test('clean pane navigates immediately (FR-26)', () => {
  assert.deepStrictEqual(resolveGuard(false, () => {}), { prompt: false });
});

test('dirty pane defers the intent behind a confirm prompt (FR-26)', () => {
  let ran = false;
  const r = resolveGuard(true, () => { ran = true; });
  assert.strictEqual(r.prompt, true);
  assert.strictEqual(ran, false);
  r.confirm?.();
  assert.strictEqual(ran, true);
});

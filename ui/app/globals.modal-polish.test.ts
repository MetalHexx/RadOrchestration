import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf-8');

test('the size-morph uses a tuned cubic-bezier on a dedicated panel rule', () => {
  const rule = css.slice(css.indexOf('.artifact-modal-panel {'));
  assert.ok(/transition-timing-function:\s*cubic-bezier\(/.test(rule), 'morph uses a custom cubic-bezier');
  assert.ok(/transition-duration:\s*3\d\dms/.test(rule), 'morph duration is tuned longer than 200ms');
});
test('reduced motion still neutralizes the panel transition', () => {
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(rm.includes('.artifact-modal-panel') && rm.includes('transition: none !important'),
    'reduced-motion neutralization preserved');
});

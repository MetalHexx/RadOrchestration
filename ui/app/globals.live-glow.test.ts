import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf-8');

function stageBlock(src: string, header: string): string {
  // Span the WHOLE @keyframes block (brace-match the outermost `{`…`}`),
  // not just the first `}` — the 0%,100% stop closes first, so slicing to
  // the first brace would exclude the 50% stop where the soft glow lives.
  const start = src.indexOf(header);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

test('the animated stage glow keeps the soft layer and drops the hard ring', () => {
  const kf = stageBlock(css, '@keyframes live-pulse-stage-kf');
  assert.ok(kf.includes('inset 0 0 30px 4px'), 'soft glow kept');
  assert.ok(!kf.includes('inset 0 0 0 2px'), 'hard-edged 0-blur ring removed');
});
test('the reduced-motion stage fallback also drops the hard ring', () => {
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  const stage = rm.slice(rm.indexOf('.live-pulse-stage'));
  assert.ok(stage.includes('inset 0 0 26px 4px'), 'reduced-motion soft layer kept');
  assert.ok(!stage.slice(0, stage.indexOf('}')).includes('inset 0 0 0 2px'), 'reduced-motion hard ring removed');
});
test('the filmstrip-cell ring is left unchanged', () => {
  assert.ok(css.includes('0 0 0 3px color-mix(in srgb, var(--live) 50%'), 'live-pulse-frame ring intact');
});

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'instruction-drawer.tsx'), 'utf-8');

test('uses Sheet primitive on the right side (DD-9, NFR-7)', () => {
  assert.match(src, /@\/components\/ui\/sheet/);
  assert.match(src, /side="right"/);
});
test('imports MarkdownRenderer for body rendering (NFR-7, NFR-10)', () => {
  assert.match(src, /MarkdownRenderer/);
});
test('issues a single compose POST on open in preview mode (AD-13)', () => {
  assert.match(src, /\/api\/action-events\/compose/);
  assert.match(src, /method:\s*"POST"/);
});
test('fetches /api/action-events/help/readme in help mode (FR-25, AD-12)', () => {
  assert.match(src, /\/api\/action-events\/help\/readme/);
});

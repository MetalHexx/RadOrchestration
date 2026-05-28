import { test, describe } from 'node:test';
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

describe('InstructionDrawer — width and subtitle (FR-17, FR-22)', () => {
  test('SheetContent uses the /projects document-drawer width className (AD-11)', () => {
    assert.match(src, /!w-full/, 'SheetContent must include !w-full class');
    assert.match(src, /md:!w-\[80vw\]/, 'SheetContent must include md:!w-[80vw] class');
    assert.match(src, /md:!max-w-\[80vw\]/, 'SheetContent must include md:!max-w-[80vw] class');
  });

  test('body uses SheetScrollBody with ScrollArea h-full (DD-8)', () => {
    assert.match(src, /SheetScrollBody/, 'must import and use SheetScrollBody');
    assert.match(src, /data-slot="sheet-scroll-body"|<SheetScrollBody/, 'must render SheetScrollBody');
    assert.match(src, /ScrollArea[^>]*className="h-full"|className="h-full"[^>]*>/, 'ScrollArea must carry h-full className');
  });

  test('subtitle for action Preview keeps the byte-for-byte copy', () => {
    assert.match(src, /Byte-for-byte preview of the envelope/, 'action preview subtitle must contain "Byte-for-byte preview of the envelope"');
  });

  test('subtitle for orphan-event Preview teaches the prepend model (FR-22, DD-7)', () => {
    assert.match(src, /Runtime shape:/, 'orphan subtitle must contain "Runtime shape:"');
    assert.match(src, /prepended above the next action/, 'orphan subtitle must contain "prepended above the next action"');
  });
});

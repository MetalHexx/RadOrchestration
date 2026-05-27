import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'unsaved-changes-dialog.tsx'), 'utf-8');

test('uses Dialog primitive from @/components/ui/dialog (DD-10, NFR-7)', () => {
  assert.match(src, /from\s+"@\/components\/ui\/dialog"/);
  assert.match(src, /Dialog/);
});
test('renders Cancel and Discard and continue actions (DD-10)', () => {
  assert.match(src, /Cancel/);
  assert.match(src, /Discard and continue/);
});
test('title is "Unsaved changes" (DD-10)', () => {
  assert.match(src, /Unsaved changes/);
});

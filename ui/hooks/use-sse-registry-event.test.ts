import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

test('use-sse EVENT_TYPES allowlist includes registry_change (AD-8)', () => {
  const src = readFileSync(path.join(dir, 'use-sse.ts'), 'utf8');
  const block = src.slice(src.indexOf('EVENT_TYPES'), src.indexOf('EVENT_TYPES') + 300);
  assert.match(block, /["']registry_change["']/);
});

test('events.ts declares registry_change in the type union and payload map (AD-8)', () => {
  const src = readFileSync(path.join(dir, '..', 'types', 'events.ts'), 'utf8');
  assert.match(src, /\|\s*['"]registry_change['"]/);
  assert.match(src, /registry_change:\s*Record<string, never>/);
});

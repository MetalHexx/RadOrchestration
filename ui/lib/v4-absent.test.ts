import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
test('v4 surface is fully removed (FR-20, FR-21, NFR-7)', () => {
  const stateSrc = fs.readFileSync(path.resolve(__dirname, '../types/state.ts'), 'utf8');
  assert.ok(!stateSrc.includes("orchestration-state-v4"), 'v4 $schema literal must be gone');
  assert.ok(!/\$schema:\s*'orchestration-state-v4'/.test(stateSrc), 'v4 ProjectState root must be gone');
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../app/projects/page.v4-compat.test.tsx')), false);
});

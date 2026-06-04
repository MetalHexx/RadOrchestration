import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');
const v4dir = join(__dirname, '..', 'projects-v4');

test('the standalone /projects-v4 route is fully deleted (FR-14)', () => {
  assert.ok(!existsSync(join(v4dir, 'page.tsx')), 'projects-v4/page.tsx must be deleted');
  assert.ok(!existsSync(join(v4dir, 'loading.tsx')), 'projects-v4/loading.tsx must be deleted');
  assert.ok(!existsSync(join(v4dir, 'page.test.tsx')), 'projects-v4/page.test.tsx must be deleted');
  assert.ok(!existsSync(join(v4dir, 'loading.test.tsx')), 'projects-v4/loading.test.tsx must be deleted');
});

test('the v4 backward-compat render path is preserved in /projects (FR-15, DD-6)', () => {
  assert.ok(pageSrc.includes('MainDashboard'), '/projects must still render v4 via MainDashboard');
  assert.ok(pageSrc.includes('isV5State'), '/projects must keep the isV5State v4/v5 fork');
  assert.ok(/v4State\s*&&/.test(pageSrc) || pageSrc.includes('v4State'), '/projects must keep a v4State branch');
});

import { expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeRegistrySkeleton, readRegistry } from '../../src/lib/registry.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-reg-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

it('writes a forward-compatible empty skeleton with empty repos and workspaces', async () => {
  const file = path.join(tmp, 'registry.yml');
  await writeRegistrySkeleton(file);
  const reg = await readRegistry(file);
  expect(reg).toEqual({ repos: [], workspaces: [] });
});

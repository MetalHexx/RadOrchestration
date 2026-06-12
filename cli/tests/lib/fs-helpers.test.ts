import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeFileAtomic } from '../../src/lib/fs-helpers.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-fsh-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('writeFileAtomic', () => {
  it('writes content atomically to the target', async () => {
    const file = path.join(tmp, 'out.json');
    await writeFileAtomic(file, 'hello\n');
    expect(await fs.readFile(file, 'utf8')).toBe('hello\n');
  });

  it('cleans up the temp and rethrows when the rename fails (no orphan left behind)', async () => {
    // Make the destination an existing directory so rename(<temp file>, <dir>) fails —
    // the same failure class that orphaned install.json.tmp-* on Windows.
    const dest = path.join(tmp, 'is-a-dir');
    await fs.mkdir(dest);
    await expect(writeFileAtomic(dest, 'x')).rejects.toThrow();
    const orphans = (await fs.readdir(tmp)).filter((n) => n.startsWith('is-a-dir.tmp-'));
    expect(orphans).toEqual([]);
  });
});

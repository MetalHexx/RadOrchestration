import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireBootstrapLock } from '../../../src/lib/upgrade/bootstrap-lock.js';

describe('acquireBootstrapLock', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-lock-')); });

  it('returns a release handle on first call', () => {
    const lockPath = path.join(tmp, 'runtime', 'bootstrap.lock');
    const r = acquireBootstrapLock(lockPath);
    expect(r.acquired).toBe(true);
    expect(fs.existsSync(lockPath)).toBe(true);
    r.release!();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('second concurrent caller gets acquired=false', () => {
    const lockPath = path.join(tmp, 'runtime', 'bootstrap.lock');
    const r1 = acquireBootstrapLock(lockPath);
    const r2 = acquireBootstrapLock(lockPath);
    expect(r2.acquired).toBe(false);
    r1.release!();
  });
});

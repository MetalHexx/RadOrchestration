import fs from 'node:fs';
import path from 'node:path';

export interface LockHandle { acquired: boolean; release?: () => void }

export function acquireBootstrapLock(lockPath: string): LockHandle {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let fd: number;
  try {
    fd = fs.openSync(lockPath, 'wx');
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EEXIST') return { acquired: false };
    throw err;
  }
  fs.writeSync(fd, String(process.pid));
  fs.closeSync(fd);
  return {
    acquired: true,
    release: () => { try { fs.rmSync(lockPath, { force: true }); } catch {} },
  };
}

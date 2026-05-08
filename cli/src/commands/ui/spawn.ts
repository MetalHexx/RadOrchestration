import { createServer } from 'node:net';
import { spawn as nodeSpawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export async function probePortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

export function openLogFd(file: string): number {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return fs.openSync(file, 'a');
}

export const spawn = nodeSpawn;

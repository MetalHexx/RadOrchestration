import fs from 'node:fs/promises';
import { writeFileAtomic, pathExists } from '../../lib/fs-helpers.js';

export interface PidEntry {
  pid: number;
  port: number;
  started_at: string;
}

export async function writePidFile(file: string, entry: PidEntry): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(entry, null, 2) + '\n');
}

export async function readPidFile(file: string): Promise<PidEntry | null> {
  if (!(await pathExists(file))) return null;
  const text = await fs.readFile(file, 'utf8');
  try {
    return JSON.parse(text) as PidEntry;
  } catch {
    return null;
  }
}

export async function removePidFile(file: string): Promise<void> {
  if (await pathExists(file)) await fs.rm(file);
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

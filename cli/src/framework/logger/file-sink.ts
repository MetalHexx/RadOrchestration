import fs from 'node:fs/promises';
import path from 'node:path';
import type { LogEntry, Sink } from './types.js';

export interface FileSinkOptions {
  file: string;
  maxBytes: number;
  maxFiles: number;
  env?: NodeJS.ProcessEnv;
  requireDirExists?: boolean;
}

export function createFileSink(opts: FileSinkOptions): Sink {
  const env = opts.env ?? process.env;
  const disabled = env['RADORCH_NO_LOG'] === '1';

  async function rotateIfNeeded(): Promise<void> {
    let stat;
    try {
      stat = await fs.stat(opts.file);
    } catch {
      return;
    }
    if (stat.size < opts.maxBytes) return;
    // shift cli.log.N → cli.log.N+1; oldest beyond maxFiles is dropped
    for (let i = opts.maxFiles - 1; i >= 1; i--) {
      const src = `${opts.file}.${i}`;
      const dst = `${opts.file}.${i + 1}`;
      try {
        await fs.rename(src, dst);
      } catch {
        // missing intermediate file — fine
      }
    }
    try {
      await fs.rename(opts.file, `${opts.file}.1`);
    } catch {
      // rare race — drop quietly
    }
    // drop anything beyond maxFiles
    try {
      await fs.unlink(`${opts.file}.${opts.maxFiles + 1}`);
    } catch {
      // not present — fine
    }
  }

  return {
    async write(entry: LogEntry): Promise<void> {
      if (disabled) return;
      if (opts.requireDirExists) {
        try {
          await fs.stat(path.dirname(opts.file));
        } catch {
          return;
        }
      } else {
        await fs.mkdir(path.dirname(opts.file), { recursive: true });
      }
      await rotateIfNeeded();
      await fs.appendFile(opts.file, JSON.stringify(entry) + '\n', 'utf8');
    },
    async flush(): Promise<void> {
      // appendFile is synchronous to disk per call; nothing to flush.
    },
  };
}

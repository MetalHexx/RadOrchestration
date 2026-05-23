import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      yield* walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

describe('cli/ encapsulation', () => {
  it('no source file imports from skills/ or installer/', async () => {
    const cliRoot = path.resolve(__dirname, '..', '..', 'src');
    const offenders: string[] = [];
    for await (const file of walk(cliRoot)) {
      const text = await fs.readFile(file, 'utf8');
      if (/from ['"][^'"]*skills\//.test(text) || /from ['"][^'"]*installer\//.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

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
      // AD-5: cli/src/commands/gate/* is the single sanctioned cross-package
      // consumer of the pipeline lib. Every other path under cli/src/ stays
      // banned from importing skills/ or installer/.
      const rel = path.relative(cliRoot, file).replace(/\\/g, '/');
      if (rel.startsWith('commands/gate/')) continue;
      const text = await fs.readFile(file, 'utf8');
      if (/from ['"][^'"]*skills\//.test(text) || /from ['"][^'"]*installer\//.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

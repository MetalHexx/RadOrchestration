import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readInstallJson, writeInstallJson } from '../../src/lib/config.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-cfg-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('install.json', () => {
  it('round-trips the harnesses registry', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      harnesses: {
        claude: {
          version: '0.0.0',
          channel: 'legacy-installer',
          installed_at: '2026-05-08T00:00:00Z',
          last_writer_version: '0.0.0',
        },
      },
    });
    const round = await readInstallJson(file);
    expect(round.harnesses.claude?.version).toBe('0.0.0');
    expect(round.harnesses.claude?.channel).toBe('legacy-installer');
    expect(round.harnesses.claude?.installed_at).toBe('2026-05-08T00:00:00Z');
    expect(round.harnesses.claude?.last_writer_version).toBe('0.0.0');
  });
});

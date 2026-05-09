import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, '..');

describe('next standalone build', () => {
  it('produces .next/standalone, .next/static, and public outputs', async () => {
    await execP('npm', ['run', 'build-standalone'], { cwd: uiRoot, shell: process.platform === 'win32' });
    const standalone = path.join(uiRoot, '.next', 'standalone');
    const staticDir = path.join(uiRoot, '.next', 'static');
    const publicDir = path.join(uiRoot, 'public');
    for (const p of [standalone, staticDir, publicDir]) {
      const stat = await fs.stat(p);
      assert.ok(stat.isDirectory(), `${p} must exist as a directory`);
    }
    const serverJs = path.join(standalone, 'server.js');
    const stat = await fs.stat(serverJs);
    assert.ok(stat.isFile(), 'standalone/server.js must exist');
  });
});

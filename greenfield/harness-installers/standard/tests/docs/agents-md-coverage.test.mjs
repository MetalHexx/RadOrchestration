import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('every new module folder under standard/ carries an AGENTS.md with four sections', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, '../..');
  const required = [
    '',                    // package root
    'lib/install',
    'build-scripts',
    'lib/checks',
  ];
  for (const rel of required) {
    const agentsMd = path.join(root, rel, 'AGENTS.md');
    assert.ok(fs.existsSync(agentsMd), `missing AGENTS.md at ${rel || 'package root'}`);
    const text = fs.readFileSync(agentsMd, 'utf8');
    for (const section of ['## Purpose', '## How it works', '## Coding standards', '## Seams']) {
      assert.ok(text.includes(section), `${rel || 'package root'}/AGENTS.md missing section: ${section}`);
    }
  }
});

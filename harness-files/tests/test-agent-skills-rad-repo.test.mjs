import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const agents = ['orchestrator', 'planner', 'coder', 'coder-junior', 'coder-senior', 'reviewer', 'source-control', 'brainstormer'];
const dir = path.join(process.cwd(), 'harness-files/agents');

for (const name of agents) {
  test(`${name}.md lists /rad-repo in its Skills section`, () => {
    const text = fs.readFileSync(path.join(dir, `${name}.md`), 'utf8');
    assert.match(text, /## Skills[\s\S]*rad-repo/);
  });
}

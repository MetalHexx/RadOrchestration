import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdapterPlugin } from './run-plugin.js';
import { adapter } from './claude/adapter.js';

test('plugin emit ships every canonical skill', async () => {
  const repoRoot = path.resolve('.');
  const canonicalSkills = fs.readdirSync(path.join(repoRoot, 'skills'))
    .filter(d => fs.statSync(path.join(repoRoot, 'skills', d)).isDirectory());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-enum-'));
  await runAdapterPlugin(adapter, { canonicalRoot: repoRoot, outputRoot: tmp, version: '0.0.0' });
  const claudeDist = path.join(tmp, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  for (const skill of canonicalSkills) {
    const skillFile = path.join(claudeDist, 'skills', skill, 'SKILL.md');
    assert.ok(fs.existsSync(skillFile), `plugin emit missing skills/${skill}/SKILL.md`);
  }
});

test('plugin emit ships every canonical agent', async () => {
  const repoRoot = path.resolve('.');
  const canonicalAgents = fs.readdirSync(path.join(repoRoot, 'agents'))
    .filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-agents-'));
  await runAdapterPlugin(adapter, { canonicalRoot: repoRoot, outputRoot: tmp, version: '0.0.0' });
  const claudeDist = path.join(tmp, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  for (const a of canonicalAgents) {
    const agentFile = path.join(claudeDist, 'agents', `${a}.md`);
    assert.ok(fs.existsSync(agentFile), `plugin emit missing agents/${a}.md`);
  }
});

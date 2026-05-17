import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expandTokens } from '../expand-tokens.js';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'expand-tokens-'));
  mkdirSync(join(root, 'in/agents'), { recursive: true });
  mkdirSync(join(root, 'in/skills/rad-x/references'), { recursive: true });
  writeFileSync(join(root, 'in/agents/orchestrator.md'),
    'Spawn **coder** agent.\nSee ${SKILLS_ROOT}/rad-x/SKILL.md.\nUse ${PLUGIN_ROOT}/hooks/.\n');
  writeFileSync(join(root, 'in/skills/rad-x/SKILL.md'),
    'subagent_type: planner\nSee ${SKILLS_ROOT}/rad-x/references/r.md\n');
  writeFileSync(join(root, 'in/skills/rad-x/references/r.md'),
    'Dispatch the coder, planner, and reviewer agents.\n');
  // A non-text file that must be copied verbatim, not corrupted.
  writeFileSync(join(root, 'in/skills/rad-x/binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return root;
}

test('expandTokens substitutes destination tokens and applies agent-namespacing across every text-extension file', async () => {
  const root = makeFixture();
  try {
    await expandTokens({
      source: join(root, 'in'),
      target: join(root, 'out'),
      tokenMap: {
        '${SKILLS_ROOT}': '${CLAUDE_PLUGIN_ROOT}/skills',
        '${PLUGIN_ROOT}': '${CLAUDE_PLUGIN_ROOT}',
      },
      agentNames: ['coder', 'planner', 'reviewer'],
    });
    const orch = readFileSync(join(root, 'out/agents/orchestrator.md'), 'utf8');
    assert.ok(orch.includes('**rad-orchestration:coder**'), 'bold dispatch token namespaced');
    assert.ok(orch.includes('${CLAUDE_PLUGIN_ROOT}/skills/rad-x/SKILL.md'), '${SKILLS_ROOT} substituted');
    assert.ok(orch.includes('${CLAUDE_PLUGIN_ROOT}/hooks/'), '${PLUGIN_ROOT} substituted');
    const skill = readFileSync(join(root, 'out/skills/rad-x/SKILL.md'), 'utf8');
    assert.ok(skill.includes('subagent_type: rad-orchestration:planner'), 'subagent_type namespaced');
    const refs = readFileSync(join(root, 'out/skills/rad-x/references/r.md'), 'utf8');
    assert.ok(refs.includes('rad-orchestration:coder, rad-orchestration:planner, and rad-orchestration:reviewer agents'),
      'comma-list dispatch namespaced');
    const bin = readFileSync(join(root, 'out/skills/rad-x/binary.png'));
    assert.deepStrictEqual([...bin], [0x89, 0x50, 0x4e, 0x47], 'binary file copied verbatim');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('expandTokens leaves unknown ${...} tokens untouched', async () => {
  const root = mkdtempSync(join(tmpdir(), 'expand-tokens-unknown-'));
  try {
    mkdirSync(join(root, 'in'), { recursive: true });
    writeFileSync(join(root, 'in/x.md'), 'Reference ${UNKNOWN_TOKEN}/foo.\n');
    await expandTokens({
      source: join(root, 'in'),
      target: join(root, 'out'),
      tokenMap: { '${SKILLS_ROOT}': '/replaced' },
      agentNames: [],
    });
    const text = readFileSync(join(root, 'out/x.md'), 'utf8');
    assert.ok(text.includes('${UNKNOWN_TOKEN}/foo'), 'unknown token passes through unchanged');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

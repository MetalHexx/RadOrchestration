import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const cases = [
  { folder: 'claude', expected: { name: 'claude', agent: '{name}.md', skill: 'SKILL.md' } },
  { folder: 'copilot-vscode', expected: { name: 'copilot-vscode', agent: '{name}.agent.md', skill: 'SKILL.md' } },
  { folder: 'copilot-cli', expected: { name: 'copilot-cli', agent: '{name}.agent.md', skill: 'SKILL.md' } },
];

for (const { folder, expected } of cases) {
  test(`adapters/${folder}/adapter.js has the canonical three-field shape`, async () => {
    const url = pathToFileURL(resolve(`harness-adapters/adapters/${folder}/adapter.js`)).href;
    const mod = await import(url);
    const keys = Object.keys(mod.adapter).sort();
    assert.deepStrictEqual(keys, ['bodyTokens', 'filenames', 'name'], `${folder} must expose exactly name/filenames/bodyTokens`);
    assert.strictEqual(mod.adapter.name, expected.name, `${folder} name must match folder name`);
    assert.strictEqual(mod.adapter.filenames.agent, expected.agent, `${folder} agent filename template`);
    assert.strictEqual(mod.adapter.filenames.skill, expected.skill, `${folder} skill filename template`);
    assert.deepStrictEqual(mod.adapter.bodyTokens, {}, `${folder} bodyTokens must be empty on day one`);
  });
}

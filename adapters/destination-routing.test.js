import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDestinationPath } from './destination-routing.js';

const cases = [
  // agents/ + skills/ → harness root
  ['agents/coder.md', 'claude',         '${HARNESS_ROOT}/agents/coder.md'],
  ['agents/coder.md', 'copilot-vscode', '${HARNESS_ROOT}/agents/coder.md'],
  ['agents/coder.md', 'copilot-cli',    '${HARNESS_ROOT}/agents/coder.md'],
  ['skills/rad-orchestration/SKILL.md', 'claude', '${HARNESS_ROOT}/skills/rad-orchestration/SKILL.md'],
  ['skills/rad-orchestration/scripts/radorch.mjs', 'claude',
   '${HARNESS_ROOT}/skills/rad-orchestration/scripts/radorch.mjs'],

  // ui/, templates/, orchestration.yml, pipeline.js, etc → rad home
  ['ui/server.js', 'claude',        '${RAD_HOME}/ui/server.js'],
  ['ui/.next/static/x.js', 'claude','${RAD_HOME}/ui/.next/static/x.js'],
  ['templates/foo.md', 'claude',    '${RAD_HOME}/templates/foo.md'],
  ['orchestration.yml', 'claude',   '${RAD_HOME}/orchestration.yml'],

  // Path separators are normalised — Windows backslashes accepted.
  ['skills\\rad-orchestration\\SKILL.md', 'claude',
   '${HARNESS_ROOT}/skills/rad-orchestration/SKILL.md'],
];

test('resolveDestinationPath routes per prefix across harnesses', () => {
  for (const [bundlePath, harness, expected] of cases) {
    assert.equal(
      resolveDestinationPath(bundlePath, harness),
      expected,
      `(${bundlePath}, ${harness})`,
    );
  }
});

test('resolveDestinationPath does not differ by harness for current rules', () => {
  // Sanity: the path-prefix-only routing means same bundlePath maps to the
  // same templated output regardless of harness. Guard so a future change
  // that introduces per-harness routing surfaces deliberately.
  for (const harness of ['claude', 'copilot-vscode', 'copilot-cli']) {
    assert.equal(
      resolveDestinationPath('skills/rad-plan/SKILL.md', harness),
      '${HARNESS_ROOT}/skills/rad-plan/SKILL.md',
    );
    assert.equal(
      resolveDestinationPath('ui/server.js', harness),
      '${RAD_HOME}/ui/server.js',
    );
  }
});

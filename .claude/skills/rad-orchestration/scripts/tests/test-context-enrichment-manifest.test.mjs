import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

describe('context-enrichment manifest contract', () => {
  it('spawn-suffix rendering, agent docs, action-event reference, context-enrichment.ts', () => {
    // Helper: invoke the manifest script as the orchestrator would, then verify
    // the documented inlining contract — the orchestrator emits the JSON array
    // under `## Repository Skills Available` followed by DD-2's orientation sentence,
    // OR omits the heading entirely when the array is empty (FR-9).
    // Windows-safe: fileURLToPath avoids the leading '/' that pathname produces on Windows
    // (mirrors the pattern in sibling tests test-list-repo-skills.test.mjs and test-list-repo-skills-selftest.test.mjs).
    const here = fileURLToPath(new URL('.', import.meta.url));
    const repoRoot = path.resolve(here, '..', '..', '..', '..', '..');
    const scriptPath = path.join(repoRoot, '.claude/skills/rad-orchestration/scripts/list-repo-skills.mjs');

    function renderSpawnSuffix(manifestJson) {
      const arr = JSON.parse(manifestJson);
      if (arr.length === 0) return '';                                                    // FR-9
      return `\n\n## Repository Skills Available\n\n${manifestJson.trim()}\n\n` +         // FR-8, AD-6
             `Entries above are a catalog. Read a listed path **only when** its description matches the work you are about to plan — skip the rest to avoid token waste. Any \`SKILL.md\` you encounter outside this catalog (e.g., via Grep/Glob) was filtered on purpose; do not Read it.\n`; // DD-2
    }

    // Case A — repo with no eligible skills emits no heading.
    const empty = mkdtempSync(path.join(tmpdir(), 'manifest-empty-'));
    let raw = execFileSync(process.execPath, [scriptPath], { cwd: empty, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(raw), [], 'empty repo emits []');
    assert.equal(renderSpawnSuffix(raw), '', 'empty manifest → no heading appears in spawn prompt (FR-9)');
    rmSync(empty, { recursive: true, force: true });

    // Case B — repo with one eligible skill emits the heading + JSON + orientation sentence.
    const populated = mkdtempSync(path.join(tmpdir(), 'manifest-pop-'));
    mkdirSync(path.join(populated, '.claude/skills/eligible'), { recursive: true });
    writeFileSync(path.join(populated, '.claude/skills/eligible/SKILL.md'),
      '---\nname: eligible\ndescription: marker\n---\nbody\n');
    raw = execFileSync(process.execPath, [scriptPath], { cwd: populated, encoding: 'utf8' });
    const suffix = renderSpawnSuffix(raw);
    assert.match(suffix, /^## Repository Skills Available$/m, 'heading must be the exact literal (AD-6)');
    assert.match(suffix, /Entries above are a catalog\. Read a listed path \*\*only when\*\*/, 'orientation sentence must match DD-2 verbatim (read-on-match)');
    assert.match(suffix, /outside this catalog .* was filtered on purpose; do not Read it/, 'orientation sentence must reinforce manifest authority (DD-2)');
    rmSync(populated, { recursive: true, force: true });

    // Case C — orchestrator agent file documents the manifest invocation contract.
    const orchAgent = readFileSync(path.join(repoRoot, '.claude/agents/orchestrator.md'), 'utf8');
    assert.match(orchAgent, /list-repo-skills\.mjs/, 'orchestrator.md must document the manifest script invocation (FR-7)');
    assert.match(orchAgent, /## Repository Skills Available/, 'orchestrator.md must name the literal heading contract (FR-8, AD-6)');

    // Case D — action-event reference teaches manifest invocation in the planner-spawn rows.
    const actionRef = readFileSync(path.join(repoRoot, '.claude/skills/rad-orchestration/references/action-event-reference.md'), 'utf8');
    assert.match(actionRef, /list-repo-skills\.mjs/, 'action-event-reference.md must teach manifest invocation in rows 1 & 2 (FR-7, AD-12)');

    // Case E — context-enrichment.ts emits the repository_skills_block field on planning-spawn enrichment.
    const ctxEnrich = readFileSync(path.join(repoRoot, '.claude/skills/rad-orchestration/scripts/lib/context-enrichment.ts'), 'utf8');
    assert.match(ctxEnrich, /repository_skills_block/, 'context-enrichment.ts must emit a repository_skills_block field (FR-7, NFR-6)');
    assert.match(ctxEnrich, /list-repo-skills\.mjs/, 'context-enrichment.ts must invoke the manifest script (FR-7)');
  });
});

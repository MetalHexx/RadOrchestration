/**
 * Review-Rework Fixtures (Iter 12)
 *
 * Unit-level coverage for the six fixture pairs under
 * `.claude/skills/orchestration/scripts/tests/fixtures/review-rework/`. Each fixture is rehydrated into a
 * synthesized git repo via the git-fixture helper; tests confirm the engine
 * contract (frontmatter validator behaviour + enrichment-level diff shape)
 * matches the fixture's declared outcome.
 *
 * End-to-end reviewer behaviour (does the agent actually author the right
 * verdict?) is out of scope here — that lives in the prompt harness. These
 * tests exercise the engine-level contract: given a fixture's diff + a
 * reviewer-shaped frontmatter payload, does the pre-read validator accept
 * the valid shape and reject the contrived invalid variant?
 */

import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createGitFixture, type GitFixture } from './helpers/git-fixture.js';
import { REVIEW_REWORK_FIXTURES, type ReviewReworkFixture } from './fixtures/review-rework/index.js';
import { validateFrontmatter } from '../lib/frontmatter-validators.js';

const activeFixtures: GitFixture[] = [];

afterEach(() => {
  while (activeFixtures.length > 0) {
    const f = activeFixtures.pop()!;
    f.cleanup();
  }
});

function rehydrate(fixture: ReviewReworkFixture): GitFixture {
  const synth = createGitFixture({
    commits: fixture.commits.map(c => ({ message: c.message, files: c.files })),
  });
  activeFixtures.push(synth);
  return synth;
}

function eventNameFor(scope: ReviewReworkFixture['scope']): string {
  switch (scope) {
    case 'task': return 'code_review_completed';
    case 'phase': return 'phase_review_completed';
    case 'final': return 'final_review_completed';
  }
}

describe('[review-rework] fixture registry sanity', () => {
  it('exports exactly six fixtures (clean + broken per scope)', () => {
    expect(REVIEW_REWORK_FIXTURES).toHaveLength(6);
    const scopes = REVIEW_REWORK_FIXTURES.map(f => f.scope).sort();
    expect(scopes).toEqual(['final', 'final', 'phase', 'phase', 'task', 'task']);
  });

  it('every fixture has a unique id', () => {
    const ids = REVIEW_REWORK_FIXTURES.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(REVIEW_REWORK_FIXTURES)('[review-rework] fixture %#', (fixture: ReviewReworkFixture) => {
  it(`${fixture.id} — rehydrates into a temp repo with the declared commit count`, () => {
    const synth = rehydrate(fixture);
    expect(synth.commits).toHaveLength(fixture.commits.length);
    for (const c of synth.commits) {
      expect(c.sha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it(`${fixture.id} — base..head diff matches the declared file set`, () => {
    const synth = rehydrate(fixture);
    // Compute a scope-appropriate diff range:
    //   task  — head_sha~1..head_sha (only the final commit)
    //   phase — phase_first_sha~1..phase_head_sha (the whole fixture)
    //   final — project_base_sha~1..project_head_sha (the whole fixture)
    const firstSha = synth.commits[0].sha;
    const lastSha = synth.commits[synth.commits.length - 1].sha;
    const range =
      fixture.scope === 'task'
        ? `${lastSha}~1..${lastSha}`
        : `${firstSha}~1..${lastSha}`;
    const rawOutput = execFileSync('git', ['diff', '--name-only', range], {
      cwd: synth.repoPath,
      encoding: 'utf8',
    });
    const changedFiles = new Set(rawOutput.split(/\r?\n/).filter(Boolean));

    // Compute the union of files touched across the in-range commits.
    const inRangeCommits = fixture.scope === 'task'
      ? [fixture.commits[fixture.commits.length - 1]]
      : fixture.commits;
    const expectedFiles = new Set<string>();
    for (const c of inRangeCommits) {
      for (const f of Object.keys(c.files)) expectedFiles.add(f);
    }
    for (const f of expectedFiles) {
      expect(changedFiles.has(f), `expected ${f} to appear in diff range`).toBe(true);
    }
  });

  it(`${fixture.id} — the expected frontmatter matches the pre-read validator's verdict (clean passes, broken rejected with structured error)`, () => {
    const event = eventNameFor(fixture.scope);
    const err = validateFrontmatter(event, fixture.expectedFrontmatter, '/tmp/fixture-review.md');
    // Raw changes_requested frontmatter (pre-mediation shape): the validator
    // requires orchestrator_mediated: true on changes_requested verdicts at
    // task + phase scope. Assert rejection on the missing mediation field.
    if (fixture.scope === 'phase' && fixture.outcome === 'changes_requested') {
      // The reviewer's raw changes_requested verdict requires the
      // orchestrator to supply mediation fields before the validator passes.
      // Our fixture declares the pre-mediation shape; confirm the validator
      // rejects it as expected (structured error on the orchestrator_mediated field).
      expect(err).not.toBeNull();
      expect(err?.event).toBe(event);
      expect(err?.field).toBe('orchestrator_mediated');
    } else if (fixture.scope === 'task' && fixture.outcome === 'changes_requested') {
      // Parallel to phase-scope: iter-10 validator requires mediation
      // fields on raw changes_requested.
      expect(err).not.toBeNull();
      expect(err?.event).toBe(event);
      expect(err?.field).toBe('orchestrator_mediated');
    } else {
      expect(err).toBeNull();
    }
  });

  it(`${fixture.id} — injected typo verdict is rejected by the pre-read validator`, () => {
    const event = eventNameFor(fixture.scope);
    const broken = { ...fixture.expectedFrontmatter, verdict: 'approvd' };
    const err = validateFrontmatter(event, broken, '/tmp/fixture-review.md');
    expect(err).not.toBeNull();
    expect(err?.field).toBe('verdict');
    expect(err?.event).toBe(event);
  });

  it(`${fixture.id} — audit-row declaration matches the declared outcome`, () => {
    // Sanity: broken fixtures must carry at least one non-informational row;
    // clean fixtures must carry only informational rows.
    const rows = fixture.expectedAuditRows;
    expect(rows.length).toBeGreaterThan(0);
    if (fixture.outcome === 'approved') {
      // Clean fixtures: all rows are on-track (task/phase) or met (final).
      const informationalStatuses = fixture.scope === 'final'
        ? new Set(['met'])
        : new Set(['on-track']);
      for (const r of rows) {
        expect(informationalStatuses.has(r.status)).toBe(true);
      }
    } else {
      // Broken fixtures: at least one row declares drift / regression / missing.
      const actionableStatuses = fixture.scope === 'final'
        ? new Set(['missing'])
        : new Set(['drift', 'regression']);
      expect(rows.some(r => actionableStatuses.has(r.status))).toBe(true);
    }
  });
});

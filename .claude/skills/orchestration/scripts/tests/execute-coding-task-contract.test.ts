import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Iter 13 — Executor contract regression guard.
 *
 * `execute-coding-task/SKILL.md` governs the coder agent's read / write /
 * workflow discipline. This test pins the prose anchors that define:
 *   - the upstream-doc prohibition ("DO NOT read"),
 *   - the sole input contract ("task-handoff"),
 *   - the Execution Notes appendix placement ("## Execution Notes"),
 *   - the RED-GREEN TDD shape,
 *   - the full task-type enumeration (code / doc / config / infra),
 *   - the test-quality anti-pattern gate,
 *   - the pre-report self-review dimensions (Completeness / Discipline),
 * and bans the purged executor-read language (Master Plan doc / PRD /
 * Architecture doc / Design doc). Mirrors the grep-pattern precedent in
 * `static-compliance.test.ts`.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKILL_PATH = path.resolve(
  __dirname,
  '../../../execute-coding-task/SKILL.md',
);

describe('execute-coding-task/SKILL.md — executor contract anchors', () => {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');

  it('is readable and non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  // ── Required anchors — must be present ───────────────────────────────────

  const requiredAnchors: string[] = [
    'DO NOT read',       // upstream-doc prohibition
    'task-handoff',       // input contract
    '## Execution Notes', // appendix heading — exact
    'RED-GREEN',          // TDD shape
    '`code`',             // task-type enumeration
    '`doc`',              // task-type enumeration
    '`config`',           // task-type enumeration
    '`infra`',            // task-type enumeration
    'test-only methods',  // anti-pattern gate
    'mock behavior',      // anti-pattern gate
    'Completeness',       // pre-report self-review dimension
    'Discipline',         // pre-report self-review dimension
  ];

  for (const anchor of requiredAnchors) {
    it(`contains required anchor: ${anchor}`, () => {
      expect(
        content.includes(anchor),
        `SKILL.md missing required anchor string "${anchor}"`,
      ).toBe(true);
    });
  }

  // ── Prohibited strings — must be absent ──────────────────────────────────
  // These name upstream planning docs as executor read-targets. The pipeline
  // removed upstream-doc reads in iters 3, 7, 9. The executor must not
  // re-reference them even prohibitively by name.

  const prohibitedStrings: string[] = [
    'Master Plan doc',
    'PRD',
    'Architecture doc',
    'Design doc',
  ];

  for (const banned of prohibitedStrings) {
    it(`does not contain prohibited string: ${banned}`, () => {
      expect(
        content.includes(banned),
        `SKILL.md contains prohibited executor-read-target string "${banned}"`,
      ).toBe(false);
    });
  }
});

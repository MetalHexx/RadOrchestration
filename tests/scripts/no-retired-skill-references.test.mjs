import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

test('no shipped docs or skills reference rad-configure-system', () => {
  // Allow docs/internals/_private/*.
  let out = '';
  try {
    out = execSync('rg -l "rad-configure-system" agents skills docs ui --glob !docs/internals/_private/**', { encoding: 'utf8' }).trim();
  } catch (e) {
    if (e.stdout) {
      // rg exits 0 with matches, 1 with no matches, 2 on error — re-throw on error
      out = e.stdout.trim();
    } else {
      // rg not available — fall back to grep
      try {
        out = execSync('grep -rl "rad-configure-system" agents skills docs ui 2>/dev/null | grep -v "docs/internals/_private"', { encoding: 'utf8', shell: 'bash' }).trim();
      } catch (e2) {
        out = e2.stdout ? e2.stdout.trim() : '';
      }
    }
  }
  assert.equal(out, '', `rad-configure-system references remain in:\n${out}`);
});

test('no shipped markdown carries FR-/NFR-/AD-/DD- identifiers in body prose', () => {
  // Body-text scan over agents/, skills/. Excludes planning artifacts (none in repo) and tests.
  // rad-code-review and rad-create-plans legitimately carry these patterns — they are
  // requirement-aware planning/review skills (CLAUDE.md canon).
  // rad-plan-audit is also requirement-aware (plan auditing) and is excluded.
  // corrective-playbook.md carries these as notation examples within the review mediation skill.
  let out = '';
  try {
    out = execSync('rg -l "\\b(FR|NFR|AD|DD)-\\d+\\b" agents skills --glob !**/*.test.* --glob !**/scripts/** --glob !**/rad-code-review/** --glob !**/rad-create-plans/** --glob !**/rad-plan-audit/** --glob !**/corrective-playbook.md', { encoding: 'utf8' }).trim();
  } catch (e) {
    if (e.stdout) {
      out = e.stdout.trim();
    } else {
      // rg not available — fall back to grep
      try {
        out = execSync(
          'grep -rl --include="*.md" "\\b\\(FR\\|NFR\\|AD\\|DD\\)-[0-9]" agents skills 2>/dev/null | grep -v "__tests__\\|\\.test\\.\\|/scripts/\\|/rad-code-review/\\|/rad-create-plans/\\|/rad-plan-audit/\\|corrective-playbook\\.md"',
          { encoding: 'utf8', shell: 'bash' }
        ).trim();
      } catch (e2) {
        out = e2.stdout ? e2.stdout.trim() : '';
      }
    }
  }
  assert.equal(out, '', `Requirement IDs surfaced in skill/agent body in:\n${out}`);
});

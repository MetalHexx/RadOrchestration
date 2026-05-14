import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The previous `rad-build-harness SKILL.md describes the installer-wrapper flow`
// shape test was deleted (2026-05-13). It pinned a phrase-by-phrase vocabulary
// against the SKILL.md body — exactly the brittle markdown-shape pattern that
// CLAUDE.md's "DO NOT Write Markdown-Shape Tests Without Explicit Instruction"
// rule warns against. The SKILL.md has since evolved past the pinned terms
// (e.g., the installer's retired `--force`, retired `doctor` subcommand, retired
// `npm uninstall -g` path), and every prose edit risked re-breaking it. Skill
// content correctness lives in the workflow text itself; the in-skill smoke
// flow (rad-test-release.prompt.md) is the actionable regression catcher.

test('rad-test-release prompt is available in .agents/prompts/', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, '.agents', 'prompts', 'rad-test-release.prompt.md')));
});

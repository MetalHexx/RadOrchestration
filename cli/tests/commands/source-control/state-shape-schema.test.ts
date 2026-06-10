import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { Ajv } from 'ajv';
import { buildSourceControlState } from '../../../src/commands/source-control/state-shape.js';

/**
 * Regression guard for the schema↔builder desync found dogfooding a fresh
 * side-project (MR-TEST-1): `buildSourceControlState` emits the v6 `repos[]`
 * shape (worktree_name + repos[] + compat worktree_path/branch/base_branch,
 * no top-level remote_url/compare_url/pr_url), but the v6 SourceControlState
 * schema must accept it. `state-shape.test.ts` only asserts the builder's
 * *shape* — nothing previously validated that output against the JSON schema
 * the pipeline gates on, so the divergence shipped untested and the pipeline
 * halted at the first state-validating signal for every fresh init.
 *
 * This compiles the exact `definitions.SourceControlState` subschema the
 * production validator (schema-validator.ts) references and asserts the
 * builder's output validates clean across all init modes — plus a
 * backward-compat guard that the legacy single-repo shape still validates.
 *
 * Loaded via fs + JSON.parse (not a JSON import) so it is robust across the
 * test runner and OS-agnostic (path.resolve + fileURLToPath).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(
  __dirname,
  '../../../src/lib/pipeline-engine/schemas/orchestration-state-v6.schema.json',
);
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as {
  definitions: Record<string, object>;
};

describe('buildSourceControlState output validates against the v6 SourceControlState schema', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateSourceControl = ajv.compile(schema.definitions.SourceControlState);

  const modes: Record<string, Parameters<typeof buildSourceControlState>[0]> = {
    'standard (registered repo, real remote)': {
      worktreeName: 'MR-X',
      autoCommit: 'always',
      autoPr: 'never',
      worktreePath: '/wt/MR-X/rad-orc-source',
      repos: [
        {
          name: 'rad-orc-source',
          branch: 'radorch/p',
          base_branch: 'main',
          remote_url: 'https://github.com/o/r',
          compare_url: 'https://github.com/o/r/compare/main...radorch/p',
          pr_url: null,
        },
      ],
    },
    'side-project (no remote)': {
      worktreeName: 'MR-TEST-1',
      autoCommit: 'always',
      autoPr: 'never',
      worktreePath: '/sp/MR-TEST-1',
      repos: [
        {
          name: 'MR-TEST-1',
          branch: 'main',
          base_branch: 'main',
          remote_url: null,
          compare_url: null,
          pr_url: null,
        },
      ],
    },
    'in-place (single main clone)': {
      worktreeName: 'MR-X',
      autoCommit: 'always',
      autoPr: 'never',
      worktreePath: '/clone/rad-orc-source',
      repos: [
        {
          name: 'rad-orc-source',
          branch: 'feature-x',
          base_branch: 'main',
          remote_url: 'https://github.com/o/r',
          compare_url: null,
          pr_url: null,
          in_place: true,
        },
      ],
    },
  };

  for (const [label, opts] of Object.entries(modes)) {
    it(`validates clean: ${label}`, () => {
      const sc = buildSourceControlState(opts);
      const ok = validateSourceControl(sc);
      expect(validateSourceControl.errors ?? []).toEqual([]);
      expect(ok).toBe(true);
    });
  }

  it('still accepts the legacy single-repo shape (top-level URLs, no repos[]) — backward-compat guard', () => {
    const legacy = {
      branch: 'feature',
      base_branch: 'main',
      worktree_path: '/wt/legacy/rad-orc-source',
      auto_commit: 'always',
      auto_pr: 'never',
      remote_url: 'https://github.com/o/r',
      compare_url: 'https://github.com/o/r/compare/main...feature',
      pr_url: null,
    };
    const ok = validateSourceControl(legacy);
    expect(validateSourceControl.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });
});

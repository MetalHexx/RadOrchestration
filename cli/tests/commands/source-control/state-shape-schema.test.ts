import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { Ajv } from 'ajv';
import { buildSourceControlState } from '../../../src/commands/source-control/state-shape.js';

/**
 * Regression guard for the schema↔builder desync: `buildSourceControlState`
 * emits the v6 `repos[]` shape (worktree_name + repos[] + auto_commit + auto_pr,
 * no compat top-level fields), but the v6 SourceControlState schema must accept
 * it. `state-shape.test.ts` only asserts the builder's *shape* — nothing
 * previously validated that output against the JSON schema the pipeline gates on.
 *
 * This compiles the exact `definitions.SourceControlState` subschema the
 * production validator (schema-validator.ts) references and asserts the
 * builder's output validates clean across all init modes.
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

  // Backward-compat inversion (FR-20): the shim-only shape (old worktree_path +
  // top-level branch/base_branch mirror fields, no repos[]) must now REJECT
  // under the tightened v6 schema (additionalProperties: false + required repos[]).
  it('rejects the legacy shim-only shape (FR-20): worktree_path + top-level branch/base_branch, no repos[]', () => {
    const legacyShimOnly = {
      worktree_path: '/home/user/worktrees/MR-X/rad-orc-source',
      branch: 'radorch/p',
      base_branch: 'main',
      auto_commit: 'always',
      auto_pr: 'never',
    };
    expect(validateSourceControl(legacyShimOnly)).toBe(false);
    expect(validateSourceControl.errors).not.toBeNull();
    expect((validateSourceControl.errors ?? []).length).toBeGreaterThan(0);
  });

  // Positive counterpart: the v6 builder output (repos[] + worktree_name) validates.
  it('accepts the v6 repos[] builder output as the valid shape', () => {
    const sc = buildSourceControlState({
      worktreeName: 'MR-X',
      autoCommit: 'always',
      autoPr: 'never',
      repos: [
        {
          name: 'fake-api',
          branch: 'radorch/p',
          base_branch: 'main',
          remote_url: null,
          compare_url: null,
          pr_url: null,
        },
        {
          name: 'fake-ui',
          branch: 'radorch/p',
          base_branch: 'main',
          remote_url: null,
          compare_url: null,
          pr_url: null,
        },
      ],
    });
    expect(validateSourceControl(sc)).toBe(true);
    expect(validateSourceControl.errors ?? []).toEqual([]);
  });

});

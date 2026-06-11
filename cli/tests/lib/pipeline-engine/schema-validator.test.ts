import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { Ajv } from 'ajv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '../../../src/lib/pipeline-engine/schemas/orchestration-state-v6.schema.json');
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as { definitions: Record<string, object> };

describe('v6 SourceControlState schema — tightened to require repos[] (AD-6)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema.definitions.SourceControlState);

  it('rejects a shim-only state with top-level branch/worktree_path and no repos[]', () => {
    const legacy = { branch: 'feature', base_branch: 'main', worktree_path: '/wt', auto_commit: 'always', auto_pr: 'never' };
    expect(validate(legacy)).toBe(false);
  });

  it('accepts the v6 repos[] state with worktree_name', () => {
    const v6 = {
      worktree_name: 'MR-5', auto_commit: 'always', auto_pr: 'never',
      repos: [{ name: 'rad-orc-source', branch: 'radorch/p', base_branch: 'main', remote_url: null, compare_url: null, pr_url: null }],
    };
    expect(validate(v6)).toBe(true);
  });

  it('drops ask from the pipeline source_control.auto_commit enum', () => {
    const withAsk = {
      worktree_name: 'MR-5', auto_commit: 'ask', auto_pr: 'never',
      repos: [{ name: 'r', branch: 'b', base_branch: 'main', remote_url: null, compare_url: null, pr_url: null }],
    };
    expect(validate(withAsk)).toBe(false);
  });
});

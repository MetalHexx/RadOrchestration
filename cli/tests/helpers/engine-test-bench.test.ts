import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { makeBench } from './engine-test-bench.js';

describe('makeBench defaults break action/node-id collision (FR-10)', () => {
  it('default node id and default action name are distinct strings', () => {
    const bench = makeBench();
    const stateYaml = String((bench as { templateBody?: string }).templateBody ?? '');
    // Tolerate either inspection surface: a fixture-introspection field, or
    // by parsing the seeded template file from disk.
    const tplPath = path.join(bench.projectDir, 'test-template.yml');
    const body = fs.existsSync(tplPath) ? fs.readFileSync(tplPath, 'utf8') : stateYaml;
    const nodeIdMatch = /\n  - id:\s*(\S+)/.exec(body);
    const actionMatch = /\n    action:\s*(\S+)/.exec(body);
    expect(nodeIdMatch).not.toBeNull();
    expect(actionMatch).not.toBeNull();
    expect(nodeIdMatch![1]).not.toBe(actionMatch![1]);
  });

  it('explicit firstAction option keeps existing callers working (NFR-3)', () => {
    const bench = makeBench({ firstAction: 'spawn_planner', firstNodeId: 'planner_step' });
    // The bench accepts both options without throwing; the constructed
    // template uses the explicit values rather than the new defaults.
    const body = fs.readFileSync(path.join(bench.projectDir, 'test-template.yml'), 'utf8');
    expect(body).toMatch(/\n  - id:\s*planner_step/);
    expect(body).toMatch(/\n    action:\s*spawn_planner/);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  'cli/src/lib/pipeline-engine',
  'runtime-config/templates',
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && (p.endsWith('.ts') || p.endsWith('.yml') || p.endsWith('.json'))) acc.push(p);
  }
  return acc;
}

// FR-12 keeps the literal status value `not_started` in the codebase — node
// statuses still include it. The regex below uses a negative lookahead on
// `not_` so the scanner targets only the eight deleted event identifiers
// (e.g. `explosion_started`, `master_plan_started`, `commit_started`) and
// never trips on `not_started`.
const STARTED_EVENT_RE = /\b(?!not_)\w+_started\b/;

describe('no _started events remain anywhere in pipeline source or shipped templates', () => {
  it('finds no _started event identifiers (excluding the not_started status literal)', () => {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const offenders: string[] = [];
    for (const r of ROOTS) {
      const abs = path.join(repoRoot, r);
      for (const f of walk(abs)) {
        const txt = fs.readFileSync(f, 'utf8');
        if (STARTED_EVENT_RE.test(txt)) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('processEvent rejects any _started event as unknown', () => {
  it('returns an "Unknown event" error envelope for explosion_started', async () => {
    const { processEvent } = await import('../../../src/lib/pipeline-engine/engine.js');
    const { makeBench } = await import('../../helpers/engine-test-bench.js');
    const bench = makeBench({ firstAction: 'spawn_planner', firstNodeId: 'planner_step' });
    // Seed initial state so we're past the null-state guard.
    processEvent('start', bench.projectDir, {}, bench.io, bench.pathContext);
    const out = processEvent('explosion_started', bench.projectDir, {}, bench.io, bench.pathContext);
    expect(out.error?.message).toMatch(/Unknown event/);
  });
});

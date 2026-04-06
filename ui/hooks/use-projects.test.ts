/**
 * Tests for SSE state_change lastUpdated patching logic in use-projects hook.
 * Run with: npx tsx ui/hooks/use-projects.test.ts
 */
import assert from 'node:assert';

// Inline types matching ui/types/components.ts and ui/types/state.ts
type PipelineTier = 'planning' | 'execution' | 'complete';
type PlanningStatus = 'not_started' | 'in_progress' | 'complete';
type ExecutionStatus = 'not_started' | 'in_progress' | 'complete';

interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
  planningStatus?: PlanningStatus;
  executionStatus?: ExecutionStatus;
  lastUpdated?: string;
}

// The SSE state_change mapping logic replicated from ui/hooks/use-projects.ts
function applyStateChange(
  p: ProjectSummary,
  payload: {
    projectName: string;
    state: {
      pipeline: { current_tier: PipelineTier };
      planning?: { status?: PlanningStatus };
      execution?: { status?: ExecutionStatus };
      project?: { name: string; created: string; updated: string };
    };
  }
): ProjectSummary {
  if (p.name !== payload.projectName) return p;
  return {
    ...p,
    tier: payload.state.pipeline.current_tier,
    planningStatus: payload.state.planning?.status,
    executionStatus: payload.state.execution?.status,
    lastUpdated: payload.state.project?.updated,
  };
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('use-projects — SSE state_change lastUpdated patching');

  await test('(d) matching project — lastUpdated equals payload.state.project.updated', async () => {
    const p: ProjectSummary = {
      name: 'test',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
      lastUpdated: undefined,
    };
    const payload = {
      projectName: 'test',
      state: {
        pipeline: { current_tier: 'execution' as PipelineTier },
        planning: { status: 'complete' as PlanningStatus },
        execution: { status: 'in_progress' as ExecutionStatus },
        project: {
          name: 'test',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-04-06T14:30:00.000Z',
        },
      },
    };
    const result = applyStateChange(p, payload);
    assert.strictEqual(result.lastUpdated, '2026-04-06T14:30:00.000Z');
  });

  await test('(d) non-matching project — original object returned unchanged', async () => {
    const p: ProjectSummary = {
      name: 'other-project',
      tier: 'planning',
      hasState: true,
      hasMalformedState: false,
      lastUpdated: '2026-01-01T00:00:00.000Z',
    };
    const payload = {
      projectName: 'test',
      state: {
        pipeline: { current_tier: 'execution' as PipelineTier },
        planning: { status: 'complete' as PlanningStatus },
        execution: { status: 'in_progress' as ExecutionStatus },
        project: {
          name: 'test',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-04-06T14:30:00.000Z',
        },
      },
    };
    const result = applyStateChange(p, payload);
    assert.strictEqual(result, p);
    assert.strictEqual(result.lastUpdated, '2026-01-01T00:00:00.000Z');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { processEvent } from '../lib/engine.js';
import {
  createScaffoldedState,
  createMockIO,
  seedDoc,
  completePlanningSteps,
  DOC_STORE,
  PROJECT_DIR,
} from './fixtures/parity-states.js';
import type {
  PipelineState,
  StepNodeState,
  GateNodeState,
  PipelineResult,
} from '../lib/types.js';

// ── [PARITY] v4:resolvePlanning ───────────────────────────────────────────────

describe('[PARITY] v4:resolvePlanning', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  // ── _completed → next spawn action (one per step) ─────────────────────────

  it('[PARITY] v4:resolvePlanning — research_completed → spawn_prd', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0] complete, [1] not complete → spawn_prd
    const state = createScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'research.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    expect(result.context).toEqual({ step: 'prd' });
  });

  it('[PARITY] v4:resolvePlanning — prd_completed → spawn_design', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0..1] complete, [2] not complete → spawn_design
    const state = createScaffoldedState();
    completePlanningSteps(state, 'research');
    (state.graph.nodes['prd'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'prd.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('prd_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    expect(result.context).toEqual({ step: 'design' });
  });

  it('[PARITY] v4:resolvePlanning — design_completed → spawn_architecture', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0..2] complete, [3] not complete → spawn_architecture
    const state = createScaffoldedState();
    completePlanningSteps(state, 'prd');
    (state.graph.nodes['design'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'design.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('design_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    expect(result.context).toEqual({ step: 'architecture' });
  });

  it('[PARITY] v4:resolvePlanning — architecture_completed → spawn_master_plan', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0..3] complete, [4] not complete → spawn_master_plan
    const state = createScaffoldedState();
    completePlanningSteps(state, 'design');
    (state.graph.nodes['architecture'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'architecture.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('architecture_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
  });

  it('[PARITY] v4:resolvePlanning — master_plan_completed → request_plan_approval', () => {
    // v4: resolver.js resolvePlanning() — all PLANNING_STEP_ORDER complete, !human_approved → request_plan_approval
    const state = createScaffoldedState();
    completePlanningSteps(state, 'architecture');
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'master-plan.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('request_plan_approval');
    expect(result.context).toEqual({});
  });

  // ── _started → in_progress + echo action (one per step) ───────────────────

  it('[PARITY] v4:resolvePlanning — research_started sets in_progress and echoes spawn_research', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0] not complete → spawn_research
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('research_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_research');
    expect(result.context).toEqual({ step: 'research' });
    const n = io.currentState!.graph.nodes['research'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolvePlanning — prd_started sets in_progress and echoes spawn_prd', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[1] not complete → spawn_prd
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('prd_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    expect(result.context).toEqual({ step: 'prd' });
    const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolvePlanning — design_started sets in_progress and echoes spawn_design', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[2] not complete → spawn_design
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('design_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    expect(result.context).toEqual({ step: 'design' });
    const n = io.currentState!.graph.nodes['design'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolvePlanning — architecture_started sets in_progress and echoes spawn_architecture', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[3] not complete → spawn_architecture
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('architecture_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    expect(result.context).toEqual({ step: 'architecture' });
    const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolvePlanning — master_plan_started sets in_progress and echoes spawn_master_plan', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[4] not complete → spawn_master_plan
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
    const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  // ── _completed events store doc_path ──────────────────────────────────────

  it('[PARITY] v4:resolvePlanning — research_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'research.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['research'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — prd_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'research');
    (state.graph.nodes['prd'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'prd.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('prd_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — design_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'prd');
    (state.graph.nodes['design'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'design.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('design_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['design'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — architecture_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'design');
    (state.graph.nodes['architecture'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'architecture.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('architecture_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — master_plan_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'architecture');
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'master-plan.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('master_plan_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  // ── plan_approved → gate completion ───────────────────────────────────────

  it('[PARITY] v4:resolvePlanning — plan_approved completes gate with gate_active: true', () => {
    // v4: resolver.js resolvePlanning() — plan_approved → gate completes, tier transition to execution
    const state = createScaffoldedState();
    completePlanningSteps(state, 'master_plan');
    const io = createMockIO(state);

    const result = processEvent('plan_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    const g = io.currentState!.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(g.status).toBe('completed');
    expect(g.gate_active).toBe(true);
    // Without a seeded master plan doc, the walker cannot expand for_each_phase
    expect(result.action).toBeNull();
  });

  // ── plan_approved with seeded master plan → tier transition ───────────────

  it('[PARITY] v4:resolvePlanning — plan_approved with seeded master plan doc → create_phase_plan tier transition', () => {
    // v4: resolver.js resolvePlanning() → resolveExecution() — plan_approved sets current_tier = 'execution',
    //   next call returns create_phase_plan for phase 1
    const state = createScaffoldedState();
    completePlanningSteps(state, 'master_plan');
    // Seed the master plan doc at the doc_path stored on the master_plan node
    const masterPlanDocPath = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(masterPlanDocPath, { total_phases: 2 });
    const io = createMockIO(state);

    const result = processEvent('plan_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    // v5 step context comes from template definition (no phase_number field defined on plan_phase step)
    expect(result.context).toEqual({});
  });

  // ── Unknown event → error ─────────────────────────────────────────────────

  it('[PARITY] v4:resolvePlanning — unknown event returns success: false with error containing event name', () => {
    // v4: resolver.js resolveNextAction() — unknown event → error response
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('bogus_nonexistent_event', PROJECT_DIR, {}, io);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('bogus_nonexistent_event');
    expect(result.error!.event).toBe('bogus_nonexistent_event');
  });
});

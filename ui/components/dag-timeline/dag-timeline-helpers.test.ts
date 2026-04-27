/**
 * Tests for dag-timeline-helpers utility functions.
 * Run with: npx tsx ui/components/dag-timeline/dag-timeline-helpers.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 */
import assert from "node:assert";
import { getCommitLinkData, deriveRepoBaseUrl, formatNodeId, getDisplayName, parsePhaseNameFromDocPath, parseTaskNameFromDocPath, groupNodesBySection, deriveCurrentPhase, derivePhaseProgress, getRowButtonDescriptor, NODE_SECTION_MAP } from './dag-timeline-helpers';
import type { GateNodeState, NodeStatus } from '@/types/state';
import { compoundNodeIds, stepNode, gateNode, forEachPhaseNode } from './__fixtures__';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

console.log("\ndag-timeline-helpers tests\n");

test("valid commit hash with valid repoBaseUrl returns real commit URL and 7-char label", () => {
  const result = getCommitLinkData("abc1234def", "https://github.com/user/repo");
  assert.deepStrictEqual(result, { href: "https://github.com/user/repo/commit/abc1234def", label: "abc1234" });
});

test("valid commit hash with null repoBaseUrl returns null href and 7-char label", () => {
  const result = getCommitLinkData("abc1234def", null);
  assert.deepStrictEqual(result, { href: null, label: "abc1234" });
});

test("null commitHash with valid repoBaseUrl returns null", () => {
  const result = getCommitLinkData(null, "https://github.com/user/repo");
  assert.strictEqual(result, null);
});

test("null commitHash with null repoBaseUrl returns null", () => {
  const result = getCommitLinkData(null, null);
  assert.strictEqual(result, null);
});

test("undefined commitHash returns null without throwing", () => {
  const result = getCommitLinkData(undefined, null);
  assert.strictEqual(result, null);
});

test("empty string commitHash returns null", () => {
  const result = getCommitLinkData("", null);
  assert.strictEqual(result, null);
});

test("short hash (fewer than 7 chars) with null repoBaseUrl returns null href and full hash as label", () => {
  const result = getCommitLinkData("abc", null);
  assert.deepStrictEqual(result, { href: null, label: "abc" });
});

console.log("\nderiveRepoBaseUrl tests\n");

test("valid compare URL returns repo base URL", () => {
  const result = deriveRepoBaseUrl("https://github.com/user/repo/compare/main...branch");
  assert.strictEqual(result, "https://github.com/user/repo");
});

test("null input returns null", () => {
  const result = deriveRepoBaseUrl(null);
  assert.strictEqual(result, null);
});

test("URL without /compare/ segment returns null", () => {
  const result = deriveRepoBaseUrl("https://github.com/user/repo");
  assert.strictEqual(result, null);
});

test("URL with /compare/ followed by trailing slash returns repo base URL", () => {
  const result = deriveRepoBaseUrl("https://github.com/user/repo/compare/");
  assert.strictEqual(result, "https://github.com/user/repo");
});

console.log("\nformatNodeId tests\n");

test("phase_planning returns Phase Planning", () => {
  assert.strictEqual(formatNodeId("phase_planning"), "Phase Planning");
});

test("code_review returns Code Review", () => {
  assert.strictEqual(formatNodeId("code_review"), "Code Review");
});

test("commit (single word) returns Commit", () => {
  assert.strictEqual(formatNodeId("commit"), "Commit");
});

console.log("\ngetDisplayName tests\n");

test("simple ID with no dot passes through to formatNodeId", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.simple), "Phase Planning");
});

test("two-segment ID extracts leaf after dot", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.twoSegment), "Phase Planning");
});

test("three-segment ID extracts leaf after last dot", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.threeSegment), "Phase Planning");
});

test("deeply nested ID extracts leaf", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.deeplyNested), "Code Review");
});

test("loop node ID extracts leaf", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.loopNode), "Task Loop");
});

test("single word with no dot and no underscore returns capitalized", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.singleWord), "Commit");
});

test("DISPLAY_NAME_OVERRIDES restores acronym capitalization for final_pr", () => {
  assert.strictEqual(getDisplayName("final_pr"), "Final PR");
});

test("DISPLAY_NAME_OVERRIDES restores acronym capitalization for pr_gate", () => {
  assert.strictEqual(getDisplayName("pr_gate"), "PR Gate");
});

test("DISPLAY_NAME_OVERRIDES applies after compound-id leaf extraction", () => {
  assert.strictEqual(getDisplayName("phase_loop.iter0.final_pr"), "Final PR");
});

console.log("\nparsePhaseNameFromDocPath tests\n");

test("multi-word all-caps title is title-cased (FR-6)", () => {
  const result = parsePhaseNameFromDocPath("phases/MY-PROJECT-PHASE-02-CORE-RESEARCH-BRANCH.md", 1);
  assert.strictEqual(result, "Phase 2 \u2014 Core Research Branch");
});

test("null doc path returns fallback Phase N", () => {
  const result = parsePhaseNameFromDocPath(null, 0);
  assert.strictEqual(result, "Phase 1");
});

test("non-matching doc path returns fallback Phase N", () => {
  const result = parsePhaseNameFromDocPath("some/random/file.md", 2);
  assert.strictEqual(result, "Phase 3");
});

test("single-word all-caps title is title-cased (FR-6)", () => {
  const result = parsePhaseNameFromDocPath("phases/FOO-PHASE-01-SETUP.md", 0);
  assert.strictEqual(result, "Phase 1 \u2014 Setup");
});

test("case-insensitive: lowercase -phase- segment parses correctly", () => {
  const result = parsePhaseNameFromDocPath("phases/foo-phase-01-setup.md", 0);
  assert.strictEqual(result, "Phase 1 \u2014 Setup");
});

console.log("\nparseTaskNameFromDocPath tests\n");

test("task single-word all-caps title is title-cased (FR-6)", () => {
  const result = parseTaskNameFromDocPath("tasks/MY-PROJECT-TASK-P01-T03-WORKFLOW.md", 2);
  assert.strictEqual(result, "Task 3 \u2014 Workflow");
});

test("null doc path returns fallback Task N", () => {
  const result = parseTaskNameFromDocPath(null, 0);
  assert.strictEqual(result, "Task 1");
});

test("non-matching doc path returns fallback Task N", () => {
  const result = parseTaskNameFromDocPath("some/random/file.md", 4);
  assert.strictEqual(result, "Task 5");
});

test("task multi-word all-caps title is title-cased (FR-6)", () => {
  const result = parseTaskNameFromDocPath("tasks/X-TASK-P02-T01-UI-COMPONENT-SETUP.md", 0);
  assert.strictEqual(result, "Task 1 \u2014 Ui Component Setup");
});

test("case-insensitive: lowercase -task- segment parses correctly", () => {
  const result = parseTaskNameFromDocPath("tasks/x-task-p02-t01-ui-component-setup.md", 0);
  assert.strictEqual(result, "Task 1 \u2014 Ui Component Setup");
});

test("DD-12: phaseN/taskN prefix preserved exactly", () => {
  const phase = parsePhaseNameFromDocPath("phases/X-PHASE-05-FOO.md", 4);
  assert.ok(phase.startsWith("Phase 5 \u2014 "), `prefix preserved: ${phase}`);
  const task = parseTaskNameFromDocPath("tasks/X-TASK-P02-T03-FOO.md", 2);
  assert.ok(task.startsWith("Task 3 \u2014 "), `prefix preserved: ${task}`);
});

console.log("\ngroupNodesBySection tests\n");

test("NODE_SECTION_MAP reroutes plan_approval_gate to Planning (FR-13, AD-3)", () => {
  assert.strictEqual(NODE_SECTION_MAP.plan_approval_gate, "Planning");
  assert.strictEqual(NODE_SECTION_MAP.gate_mode_selection, "Planning");
});

test("NODE_SECTION_MAP routes final_pr to Completion", () => {
  assert.strictEqual(NODE_SECTION_MAP.final_pr, "Completion");
});

test("groupNodesBySection emits no Gates group (FR-13, AD-3)", () => {
  const result = groupNodesBySection({
    prd: stepNode,
    plan_approval_gate: gateNode,
    gate_mode_selection: gateNode,
    phase_loop: forEachPhaseNode,
    final_review: stepNode,
  });
  const labels = result.map(g => g.label);
  assert.deepStrictEqual(labels, ["Planning", "Execution", "Completion"]);
  const planning = result.find(g => g.label === "Planning")!;
  const planningIds = planning.entries.map(([id]) => id);
  assert.ok(planningIds.includes("plan_approval_gate"));
  assert.ok(planningIds.includes("gate_mode_selection"));
});

test("section order is Planning → Execution → Completion regardless of insertion (AD-3)", () => {
  const result = groupNodesBySection({
    final_approval_gate: gateNode,
    prd: stepNode,
    phase_loop: forEachPhaseNode,
    plan_approval_gate: gateNode,
  });
  assert.deepStrictEqual(result.map(g => g.label), ["Planning", "Execution", "Completion"]);
});

test("empty NodesRecord returns empty array", () => {
  const result = groupNodesBySection({});
  assert.deepStrictEqual(result, []);
});

test("only Planning keys returns single-element array with label Planning", () => {
  const result = groupNodesBySection({ prd: stepNode, design: stepNode });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].label, "Planning");
  assert.strictEqual(result[0].entries.length, 2);
});

test("unknown node IDs are silently excluded from all groups", () => {
  const result = groupNodesBySection({ unknown_step: stepNode, another_unknown: gateNode });
  assert.deepStrictEqual(result, []);
});

test("partial template (requirements + master_plan + plan_approval_gate) groups correctly — all 3 in Planning section", () => {
  // Simulates a fresh project scaffolded from default.yml: 2 planning steps + 1 gate.
  // groupNodesBySection preserves insertion order of the input NodesRecord within each section,
  // and default.yml declares `requirements` before `master_plan`. plan_approval_gate now
  // routes to Planning (FR-13), so all 3 appear in Planning without a separate Gates group.
  const result = groupNodesBySection({
    requirements: stepNode,
    master_plan: stepNode,
    plan_approval_gate: gateNode,
  });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].label, "Planning");
  assert.strictEqual(result[0].entries.length, 3);
  assert.strictEqual(result[0].entries[0][0], "requirements");
  assert.strictEqual(result[0].entries[1][0], "master_plan");
  assert.strictEqual(result[0].entries[2][0], "plan_approval_gate");
});

test("in_progress requirements node renders under Planning with in_progress status", () => {
  const inProgressStep = { ...stepNode, status: "in_progress" as const };
  const result = groupNodesBySection({
    requirements: inProgressStep,
    master_plan: stepNode,
    plan_approval_gate: gateNode,
  });
  const planningSection = result.find((g) => g.label === "Planning")!;
  const [reqId, reqNode] = planningSection.entries[0];
  assert.strictEqual(reqId, "requirements");
  assert.strictEqual(reqNode.status, "in_progress");
});

test("legacy full.yml state (no requirements node) still groups correctly — no crashes, gates in Planning", () => {
  // A pre-Iter-4 state.json scaffolded from full.yml does NOT contain a `requirements` node.
  // groupNodesBySection must render cleanly without the new node.
  // plan_approval_gate and gate_mode_selection now route to Planning (FR-13).
  const legacyNodes = {
    prd: stepNode,
    research: stepNode,
    design: stepNode,
    architecture: stepNode,
    master_plan: stepNode,
    plan_approval_gate: gateNode,
    gate_mode_selection: gateNode,
    phase_loop: forEachPhaseNode,
    final_review: stepNode,
    pr_gate: gateNode,
    final_approval_gate: gateNode,
  };
  const result = groupNodesBySection(legacyNodes);
  assert.strictEqual(result.length, 3);
  // Planning section: all 5 legacy steps + 2 planning gates = 7 total
  const planningSection = result.find((g) => g.label === "Planning")!;
  const planningIds = planningSection.entries.map(([id]) => id);
  assert.strictEqual(planningSection.entries.length, 7);
  assert.ok(!planningIds.includes("requirements"), "legacy state should not have requirements");
  assert.ok(planningIds.includes("master_plan"), "legacy state must still have master_plan");
  assert.ok(planningIds.includes("plan_approval_gate"), "plan_approval_gate now in Planning");
  assert.ok(planningIds.includes("gate_mode_selection"), "gate_mode_selection now in Planning");
});

test("default.yml partial template (requirements + master_plan + explode_master_plan + plan_approval_gate) groups correctly — all 4 in Planning", () => {
  // Simulates a fresh project scaffolded from default.yml post-Iter-5: 3 planning steps + 1 gate.
  // plan_approval_gate now routes to Planning (FR-13), so all 4 appear in single Planning section.
  const result = groupNodesBySection({
    requirements: stepNode,
    master_plan: stepNode,
    explode_master_plan: stepNode,
    plan_approval_gate: gateNode,
  });
  assert.strictEqual(result.length, 1);
  const planningSection = result[0];
  assert.strictEqual(planningSection.label, "Planning");
  assert.strictEqual(planningSection.entries.length, 4);
  assert.strictEqual(planningSection.entries[0][0], "requirements");
  assert.strictEqual(planningSection.entries[1][0], "master_plan");
  assert.strictEqual(planningSection.entries[2][0], "explode_master_plan");
  assert.strictEqual(planningSection.entries[3][0], "plan_approval_gate");
});

test("pre-seeded iterations — phase_loop node with explode_master_plan completed + iterations carrying phase_planning child nodes with doc_path populated still groups correctly", () => {
  // After explosion completes, explode_master_plan.status=completed and each phase iteration
  // carries a pre-seeded `phase_planning` child step node with doc_path populated (not on the
  // iteration itself — IterationEntry has no doc_path field).
  // Rendering must not crash on iterations whose nodes contain only these pre-seeded child steps.
  // plan_approval_gate now routes to Planning (FR-13).
  const seededPhaseLoop = {
    ...forEachPhaseNode,
    status: "not_started" as const,
    iterations: [
      { index: 0, status: "not_started" as const, nodes: { phase_planning: { kind: "step" as const, status: "completed" as const, doc_path: "phases/MYAPP-PHASE-01-SETUP.md", retries: 0 } }, corrective_tasks: [], commit_hash: null },
      { index: 1, status: "not_started" as const, nodes: { phase_planning: { kind: "step" as const, status: "completed" as const, doc_path: "phases/MYAPP-PHASE-02-CORE.md", retries: 0 } }, corrective_tasks: [], commit_hash: null },
    ],
  };
  // Iter 5 mutation intentionally keeps explode_master_plan.doc_path null to avoid a spurious
  // Doc link in the UI — the "document" for this step is the child phase-plan files, not a
  // Master Plan copy. Fixture mirrors that semantic so any regression that sets doc_path on
  // the completed explode node will be caught here rather than masked by drift.
  const completedExplode = { ...stepNode, status: "completed" as const, doc_path: null };
  const result = groupNodesBySection({
    requirements: stepNode,
    master_plan: stepNode,
    explode_master_plan: completedExplode,
    plan_approval_gate: gateNode,
    phase_loop: seededPhaseLoop,
  });
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].label, "Planning");
  assert.strictEqual(result[0].entries.length, 4);
  assert.strictEqual(result[1].label, "Execution");
  // Confirm the completed explode node is present with status completed.
  const explodeEntry = result[0].entries.find(([id]) => id === "explode_master_plan");
  assert.ok(explodeEntry, "explode_master_plan must be in Planning section");
  assert.strictEqual(explodeEntry![1].status, "completed");
});

test("legacy state.json (no explode_master_plan + no pre-seeded phase_planning child) still groups cleanly", () => {
  // Pre-Iter-5 state.json must keep rendering without the explode node and without the
  // pre-seeded phase_planning child step nodes that Iter 5's explosion script now emits.
  // plan_approval_gate now routes to Planning (FR-13).
  const legacyPhaseLoop = {
    ...forEachPhaseNode,
    iterations: [
      { index: 0, status: "not_started" as const, nodes: {}, corrective_tasks: [] },
    ],
  };
  const legacyNodes = {
    requirements: stepNode,
    master_plan: stepNode,
    plan_approval_gate: gateNode,
    phase_loop: legacyPhaseLoop,
  };
  const result = groupNodesBySection(legacyNodes);
  const planningIds = result.find(g => g.label === "Planning")!.entries.map(([id]) => id);
  assert.ok(!planningIds.includes("explode_master_plan"), "legacy state should not carry explode_master_plan");
  assert.ok(planningIds.includes("master_plan"), "legacy state must still carry master_plan");
  assert.ok(planningIds.includes("plan_approval_gate"), "plan_approval_gate now routes to Planning");
});


console.log("\nderiveCurrentPhase tests\n");

test("undefined phaseLoopNode returns null", () => {
  const result = deriveCurrentPhase(undefined);
  assert.strictEqual(result, null);
});

test("phase loop with no iterations returns null", () => {
  const result = deriveCurrentPhase({ ...forEachPhaseNode, iterations: [] });
  assert.strictEqual(result, null);
});

test("phase loop with all completed iterations returns null", () => {
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "completed",
    iterations: [
      { index: 0, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "completed", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.strictEqual(result, null);
});

test("phase loop with in_progress iteration and doc_path returns parsed phase name", () => {
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      {
        index: 0,
        status: "in_progress",
        nodes: {
          phase_planning: { kind: "step", status: "in_progress", doc_path: "phases/MY-PROJECT-PHASE-01-CORE-SETUP.md", retries: 0 },
        },
        corrective_tasks: [],
      },
    ],
  });
  assert.strictEqual(result, "Phase 1 \u2014 Core Setup");
});

test("phase loop with in_progress iteration using new shape (iteration.doc_path set, empty nodes) returns parsed phase name", () => {
  // Post-explode-scaffold-unify shape: the iteration itself carries doc_path and
  // has no synthetic phase_planning child node. deriveCurrentPhase must read
  // iteration.doc_path first before falling back to the legacy phase_planning node.
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      {
        index: 0,
        status: "in_progress",
        doc_path: "phases/MY-PROJECT-PHASE-01-CORE-SETUP.md",
        nodes: {},
        corrective_tasks: [],
      },
    ],
  });
  assert.strictEqual(result, "Phase 1 — Core Setup");
});

test("phase loop with in_progress iteration carrying BOTH iteration.doc_path and legacy phase_planning prefers iteration.doc_path", () => {
  // Mixed-shape edge case (shouldn't happen in practice but precedence must be deterministic).
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      {
        index: 0,
        status: "in_progress",
        doc_path: "phases/MY-PROJECT-PHASE-01-NEW-SHAPE.md",
        nodes: {
          phase_planning: { kind: "step", status: "completed", doc_path: "phases/MY-PROJECT-PHASE-01-LEGACY-SHAPE.md", retries: 0 },
        },
        corrective_tasks: [],
      },
    ],
  });
  assert.strictEqual(result, "Phase 1 — New Shape");
});

test("phase loop with in_progress iteration and null doc_path returns fallback Phase N", () => {
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      {
        index: 1,
        status: "in_progress",
        nodes: {
          phase_planning: { kind: "step", status: "in_progress", doc_path: null, retries: 0 },
        },
        corrective_tasks: [],
      },
    ],
  });
  assert.strictEqual(result, "Phase 2");
});

console.log("\nderivePhaseProgress tests\n");

test("undefined phaseLoopNode returns null", () => {
  const result = derivePhaseProgress(undefined);
  assert.strictEqual(result, null);
});

test("phase loop with no iterations returns null", () => {
  const result = derivePhaseProgress({ ...forEachPhaseNode, iterations: [] });
  assert.strictEqual(result, null);
});

test("3 iterations (2 completed, 1 in_progress) returns {completed:2, total:3}", () => {
  const result = derivePhaseProgress({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      { index: 0, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 2, status: "in_progress", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.deepStrictEqual(result, { completed: 2, total: 3 });
});

test("all iterations completed returns {completed:N, total:N}", () => {
  const result = derivePhaseProgress({
    ...forEachPhaseNode,
    status: "completed",
    iterations: [
      { index: 0, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "completed", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.deepStrictEqual(result, { completed: 2, total: 2 });
});

test("no completed iterations returns {completed:0, total:N}", () => {
  const result = derivePhaseProgress({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      { index: 0, status: "in_progress", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "not_started", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.deepStrictEqual(result, { completed: 0, total: 2 });
});

// ─── Tests: getRowButtonDescriptor (FR-1, FR-2, FR-3, AD-1, AD-2) ───────────

const gateNotActive: GateNodeState = { kind: 'gate', status: 'not_started', gate_active: false };
const gateActive: GateNodeState   = { kind: 'gate', status: 'not_started', gate_active: true  };
const gateCompleted: GateNodeState = { kind: 'gate', status: 'completed',  gate_active: true  };

console.log('\ngetRowButtonDescriptor tests\n');

test("plan_approval_gate: gate_active=false → kind='none' (FR-1 regression: no premature Approve Plan)", () => {
  const desc = getRowButtonDescriptor('plan_approval_gate', gateNotActive, 'not_started');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("plan_approval_gate: gate_active=true → kind='approve' with plan_approved event (FR-1)", () => {
  const desc = getRowButtonDescriptor('plan_approval_gate', gateActive, 'not_started');
  assert.deepStrictEqual(desc, { kind: 'approve', event: 'plan_approved', label: 'Approve Plan' });
});

test("plan_approval_gate compound id with gate_active=true resolves leaf (FR-1, AD-1)", () => {
  const desc = getRowButtonDescriptor('some.prefix.plan_approval_gate', gateActive, 'not_started');
  assert.strictEqual(desc.kind, 'approve');
});

test("final_approval_gate: gate_active=false → kind='none' (FR-1)", () => {
  const desc = getRowButtonDescriptor('final_approval_gate', gateNotActive, 'not_started');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("final_approval_gate: gate_active=true → kind='approve' with final_approved event (FR-1)", () => {
  const desc = getRowButtonDescriptor('final_approval_gate', gateActive, 'not_started');
  assert.deepStrictEqual(desc, { kind: 'approve', event: 'final_approved', label: 'Approve Final Review' });
});

test("plan_approval_gate completed AND phase_loop not_started → kind='execute' (FR-2, AD-2)", () => {
  const desc = getRowButtonDescriptor('plan_approval_gate', gateCompleted, 'not_started');
  assert.deepStrictEqual(desc, { kind: 'execute', label: 'Execute Plan' });
});

test("plan_approval_gate completed AND phase_loop in_progress → kind='none' (FR-2: hides post-launch)", () => {
  const desc = getRowButtonDescriptor('plan_approval_gate', gateCompleted, 'in_progress');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("plan_approval_gate completed AND phase_loop completed → kind='none' (FR-2)", () => {
  const desc = getRowButtonDescriptor('plan_approval_gate', gateCompleted, 'completed');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("plan_approval_gate completed AND phase_loop undefined → kind='none' (FR-2 defensive)", () => {
  const desc = getRowButtonDescriptor('plan_approval_gate', gateCompleted, undefined);
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("final_approval_gate completed never yields kind='execute' regardless of phase_loop (FR-2: plan-row only)", () => {
  const desc = getRowButtonDescriptor('final_approval_gate', gateCompleted, 'not_started');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("non-gate-config leaf (task_gate) returns kind='none' regardless of input (FR-7)", () => {
  const desc = getRowButtonDescriptor('phase_loop.iter0.task_gate', gateActive, 'not_started');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("FR-3 mutex: at no phase_loop status do both buttons render simultaneously", () => {
  const statuses: Array<NodeStatus | undefined> = ['not_started', 'in_progress', 'completed', 'failed', 'halted', 'skipped', undefined];
  for (const s of statuses) {
    const a = getRowButtonDescriptor('plan_approval_gate', gateActive, s);
    const c = getRowButtonDescriptor('plan_approval_gate', gateCompleted, s);
    // Distinct calls model distinct moments in time; mutex is that no
    // single (gate, phase_loop) tuple yields both kinds.
    assert.ok(a.kind !== 'execute', 'gate_active state never produces execute');
    assert.ok(c.kind !== 'approve', 'completed-gate state never produces approve');
  }
});

// ─── Tests: getRowButtonDescriptor — FR-7 non-regression invariants ──────────

test("compound id 'phase_loop.iter0.final_approval_gate' with gate_active=true → approve (FR-7, AD-1)", () => {
  const desc = getRowButtonDescriptor(
    'phase_loop.iter0.final_approval_gate',
    gateActive,
    'in_progress'
  );
  assert.deepStrictEqual(desc, { kind: 'approve', event: 'final_approved', label: 'Approve Final Review' });
});

test("compound id 'phase_loop.iter0.task_gate' returns kind='none' (FR-7: task gates never render row buttons)", () => {
  const desc = getRowButtonDescriptor('phase_loop.iter0.task_gate', gateActive, 'in_progress');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("pr_gate leaf returns kind='none' (FR-7)", () => {
  const desc = getRowButtonDescriptor('pr_gate', gateActive, 'in_progress');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

test("gate_mode_selection leaf returns kind='none' (FR-7)", () => {
  const desc = getRowButtonDescriptor('gate_mode_selection', gateActive, 'in_progress');
  assert.deepStrictEqual(desc, { kind: 'none' });
});

// ─── Tests: phase_loop.status pass-through invariant (AD-2) ──────────────────

test("AD-2: descriptor receives phase_loop.status straight from nodes record (no derived fetch)", () => {
  // Build a minimal nodes record matching v5 shape. The descriptor is
  // computed against `nodes.phase_loop.status` directly — proving the
  // page can pass the raw status without a side-channel.
  const nodes = {
    plan_approval_gate: { kind: 'gate', status: 'completed', gate_active: true } as const,
    phase_loop: { kind: 'for_each_phase', status: 'not_started', iterations: [] } as const,
  };
  const phaseLoopStatus = nodes.phase_loop.status;
  const desc = getRowButtonDescriptor('plan_approval_gate', nodes.plan_approval_gate, phaseLoopStatus);
  assert.strictEqual(desc.kind, 'execute');
});

test("AD-2: phase_loop missing → undefined → descriptor 'none' for FR-2 (defensive)", () => {
  const node = { kind: 'gate', status: 'completed', gate_active: true } as const;
  const desc = getRowButtonDescriptor('plan_approval_gate', node, undefined);
  assert.strictEqual(desc.kind, 'none');
});

import {
  buildIterationItemValue,
  buildCorrectiveItemValue,
  isLoopNode,
} from './dag-timeline-helpers';

console.log("\niteration key builders\n");

test('buildIterationItemValue("phase_loop", 0) returns "iter-phase_loop-0"', () => {
  assert.strictEqual(buildIterationItemValue("phase_loop", 0), "iter-phase_loop-0");
});

test('buildIterationItemValue("phase_loop.iter0.task_loop", 2) returns "iter-phase_loop.iter0.task_loop-2"', () => {
  assert.strictEqual(
    buildIterationItemValue("phase_loop.iter0.task_loop", 2),
    "iter-phase_loop.iter0.task_loop-2"
  );
});

test('buildCorrectiveItemValue("iter-phase_loop.iter0.task_loop-1", 1) returns "ct-iter-phase_loop.iter0.task_loop-1-1"', () => {
  assert.strictEqual(
    buildCorrectiveItemValue("iter-phase_loop.iter0.task_loop-1", 1),
    "ct-iter-phase_loop.iter0.task_loop-1-1"
  );
});

test('isLoopNode is re-exported from dag-timeline-helpers', () => {
  assert.strictEqual(typeof isLoopNode, 'function');
});

import { deriveIterationTaskProgress } from './dag-timeline-helpers';
import type { IterationEntry } from '@/types/state';

console.log("\nderiveIterationTaskProgress tests\n");

test('returns null when iteration has no task_loop child', () => {
  const iter: IterationEntry = {
    index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: { phase_planning: { kind: 'step', status: 'completed', doc_path: null, retries: 0 } },
  };
  assert.strictEqual(deriveIterationTaskProgress(iter), null);
});

test('returns { completed: 0, total: 0 } when task_loop has no iterations (FR-8)', () => {
  const iter: IterationEntry = {
    index: 0, status: 'not_started', corrective_tasks: [], commit_hash: null,
    nodes: { task_loop: { kind: 'for_each_task', status: 'not_started', iterations: [] } },
  };
  assert.deepStrictEqual(deriveIterationTaskProgress(iter), { completed: 0, total: 0 });
});

test('counts only iterations whose status === "completed" (AD-4, FR-7)', () => {
  const iter: IterationEntry = {
    index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: {
      task_loop: {
        kind: 'for_each_task', status: 'in_progress',
        iterations: [
          { index: 0, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
          { index: 1, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
          { index: 2, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
          { index: 3, status: 'not_started', nodes: {}, corrective_tasks: [], commit_hash: null },
        ],
      },
    },
  };
  assert.deepStrictEqual(deriveIterationTaskProgress(iter), { completed: 2, total: 4 });
});

test('keeps reporting full progress after iteration completes (FR-7 — "stays full and visible")', () => {
  const iter: IterationEntry = {
    index: 0, status: 'completed', corrective_tasks: [], commit_hash: null,
    nodes: {
      task_loop: {
        kind: 'for_each_task', status: 'completed',
        iterations: [
          { index: 0, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
          { index: 1, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
        ],
      },
    },
  };
  assert.deepStrictEqual(deriveIterationTaskProgress(iter), { completed: 2, total: 2 });
});

import { deriveIterationBadgeLabel, deriveGateBadgeStatusAndLabel } from './dag-timeline-helpers';

console.log("\nderiveIterationBadgeLabel tests\n");

test("FR-3 task_executor in_progress → Executing", () => {
  const iter: IterationEntry = { index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: { task_executor: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } } };
  assert.deepStrictEqual(deriveIterationBadgeLabel(iter), { status: 'in_progress', label: 'Executing' });
});

test("FR-3 code_review in_progress → Reviewing", () => {
  const iter: IterationEntry = { index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: { code_review: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } } };
  assert.deepStrictEqual(deriveIterationBadgeLabel(iter), { status: 'in_progress', label: 'Reviewing' });
});

test("FR-3 commit in_progress → Committing", () => {
  const iter: IterationEntry = { index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: { commit: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } } };
  assert.deepStrictEqual(deriveIterationBadgeLabel(iter), { status: 'in_progress', label: 'Committing' });
});

test("FR-3 phase_review in_progress → Reviewing", () => {
  const iter: IterationEntry = { index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: { phase_review: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } } };
  assert.deepStrictEqual(deriveIterationBadgeLabel(iter), { status: 'in_progress', label: 'Reviewing' });
});

test("FR-3 phase iteration inherits from in-flight task iteration (Reviewing)", () => {
  const iter: IterationEntry = { index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: { task_loop: { kind: 'for_each_task', status: 'in_progress', iterations: [
      { index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
        nodes: { code_review: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } } },
    ] } } };
  assert.deepStrictEqual(deriveIterationBadgeLabel(iter), { status: 'in_progress', label: 'Reviewing' });
});

test("FR-3 fallback: in_progress with no in-flight substep → Executing", () => {
  const iter: IterationEntry = { index: 0, status: 'in_progress', corrective_tasks: [], commit_hash: null,
    nodes: { task_executor: { kind: 'step', status: 'completed', doc_path: null, retries: 0 } } };
  assert.deepStrictEqual(deriveIterationBadgeLabel(iter), { status: 'in_progress', label: 'Executing' });
});

test("DD-2 completed iteration → Completed (icon-only label)", () => {
  const iter: IterationEntry = { index: 0, status: 'completed', corrective_tasks: [], commit_hash: null, nodes: {} };
  assert.deepStrictEqual(deriveIterationBadgeLabel(iter), { status: 'completed', label: 'Completed' });
});

console.log("\nderiveGateBadgeStatusAndLabel tests\n");

test("FR-4 gate_active=true overrides to Not Started (DD-3)", () => {
  const node: GateNodeState = { kind: 'gate', status: 'in_progress', gate_active: true };
  assert.deepStrictEqual(deriveGateBadgeStatusAndLabel(node), { status: 'not_started', label: 'Not Started' });
});

test("FR-4 gate_active=false uses underlying status default", () => {
  const node: GateNodeState = { kind: 'gate', status: 'completed', gate_active: false };
  assert.deepStrictEqual(deriveGateBadgeStatusAndLabel(node), { status: 'completed', label: 'Completed' });
});

import { getDocLinkLabel } from './dag-timeline-helpers';

console.log("\ngetDocLinkLabel tests\n");

test("planning artifact steps bucket to 'Document'", () => {
  assert.strictEqual(getDocLinkLabel('research'), 'Document');
  assert.strictEqual(getDocLinkLabel('prd'), 'Document');
  assert.strictEqual(getDocLinkLabel('design'), 'Document');
  assert.strictEqual(getDocLinkLabel('architecture'), 'Document');
  assert.strictEqual(getDocLinkLabel('requirements'), 'Document');
  assert.strictEqual(getDocLinkLabel('master_plan'), 'Document');
});

test("review/report steps bucket to 'Report'", () => {
  assert.strictEqual(getDocLinkLabel('code_review'), 'Report');
  assert.strictEqual(getDocLinkLabel('phase_report'), 'Report');
  assert.strictEqual(getDocLinkLabel('phase_review'), 'Report');
  assert.strictEqual(getDocLinkLabel('final_review'), 'Report');
});

test("AD-6 compound id resolves leaf to bucketed label", () => {
  assert.strictEqual(getDocLinkLabel('phase_loop.iter0.task_loop.iter1.code_review'), 'Report');
});

test("unknown leaf falls back to getDisplayName", () => {
  assert.strictEqual(getDocLinkLabel('something_custom'), 'Something Custom');
});

test("getDocLinkLabel returns the correct bucket for every bucketed id", () => {
  const documentIds = ['research','prd','design','architecture','requirements','master_plan'];
  const reportIds = ['code_review','phase_report','phase_review','final_review'];
  for (const id of documentIds) assert.strictEqual(getDocLinkLabel(id), 'Document');
  for (const id of reportIds) assert.strictEqual(getDocLinkLabel(id), 'Report');
});

import { shouldRenderTimelineRow } from './dag-timeline-helpers';
import type { RowVisibilityContext } from './dag-timeline-helpers';

console.log("\nshouldRenderTimelineRow tests\n");

const emptyCtx: RowVisibilityContext = { commitHash: null, prUrl: null };
const ctxWithCommit: RowVisibilityContext = { commitHash: 'abc123', prUrl: null };
const ctxWithPr: RowVisibilityContext = { prUrl: 'https://github.com/user/repo/pull/1', commitHash: null };

test("commit_gate always hidden regardless of context", () => {
  const node: import('@/types/state').ConditionalNodeState = { kind: 'conditional', status: 'completed', branch_taken: 'true' };
  assert.strictEqual(shouldRenderTimelineRow('commit_gate', node, emptyCtx), false);
  assert.strictEqual(shouldRenderTimelineRow('commit_gate', node, ctxWithCommit), false);
  assert.strictEqual(shouldRenderTimelineRow('commit_gate', node, ctxWithPr), false);
});

test("pr_gate always hidden", () => {
  const node: import('@/types/state').GateNodeState = { kind: 'gate', status: 'completed', gate_active: false };
  assert.strictEqual(shouldRenderTimelineRow('pr_gate', node, emptyCtx), false);
  assert.strictEqual(shouldRenderTimelineRow('pr_gate', node, ctxWithPr), false);
});

test("task_gate with gate_active: false returns false", () => {
  const node: import('@/types/state').GateNodeState = { kind: 'gate', status: 'completed', gate_active: false };
  assert.strictEqual(shouldRenderTimelineRow('task_gate', node, emptyCtx), false);
});

test("task_gate with gate_active: true returns true", () => {
  const node: import('@/types/state').GateNodeState = { kind: 'gate', status: 'not_started', gate_active: true };
  assert.strictEqual(shouldRenderTimelineRow('task_gate', node, emptyCtx), true);
});

test("phase_gate with gate_active: false returns false", () => {
  const node: import('@/types/state').GateNodeState = { kind: 'gate', status: 'completed', gate_active: false };
  assert.strictEqual(shouldRenderTimelineRow('phase_gate', node, emptyCtx), false);
});

test("phase_gate with gate_active: true returns true", () => {
  const node: import('@/types/state').GateNodeState = { kind: 'gate', status: 'not_started', gate_active: true };
  assert.strictEqual(shouldRenderTimelineRow('phase_gate', node, emptyCtx), true);
});

test("commit with commitHash: null returns false", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'completed', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('commit', node, { commitHash: null, prUrl: null }), false);
});

test("commit with commitHash: '' returns false", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'completed', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('commit', node, { commitHash: '', prUrl: null }), false);
});

test("commit with commitHash: 'abc123' returns true", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'completed', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('commit', node, { commitHash: 'abc123', prUrl: null }), true);
});

test("final_pr with prUrl: null returns false", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'completed', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('final_pr', node, { commitHash: null, prUrl: null }), false);
});

test("final_pr with prUrl: '' returns false", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'completed', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('final_pr', node, { commitHash: null, prUrl: '' }), false);
});

test("final_pr with prUrl: 'https://github.com/user/repo/pull/1' returns true", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'completed', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('final_pr', node, { commitHash: null, prUrl: 'https://github.com/user/repo/pull/1' }), true);
});

test("unrelated node 'requirements' (kind: 'step') always returns true", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'completed', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('requirements', node, emptyCtx), true);
});

test("unrelated node 'master_plan' always returns true", () => {
  const node: import('@/types/state').StepNodeState = { kind: 'step', status: 'not_started', doc_path: null, retries: 0 };
  assert.strictEqual(shouldRenderTimelineRow('master_plan', node, emptyCtx), true);
});

import { derivePlanningStepLabel } from './dag-timeline-helpers';

console.log("\nderivePlanningStepLabel (FR-5) tests\n");

test("FR-5 in_progress planning steps derive label 'Executing'", () => {
  for (const id of ['research','prd','design','architecture','requirements','master_plan','explode_master_plan']) {
    assert.strictEqual(derivePlanningStepLabel(id, 'in_progress'), 'Executing', `${id} in_progress`);
  }
});

test("FR-5 non-in_progress planning steps return undefined (falls through to STATUS_MAP default)", () => {
  for (const status of ['not_started','completed','failed','halted','skipped'] as const) {
    assert.strictEqual(derivePlanningStepLabel('research', status), undefined);
  }
});

test("FR-5 non-planning step ids return undefined even when in_progress", () => {
  assert.strictEqual(derivePlanningStepLabel('task_executor', 'in_progress'), undefined);
  assert.strictEqual(derivePlanningStepLabel('phase_loop', 'in_progress'), undefined);
  assert.strictEqual(derivePlanningStepLabel('something_else', 'in_progress'), undefined);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

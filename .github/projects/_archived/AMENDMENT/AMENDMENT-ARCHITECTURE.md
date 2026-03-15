---
project: "AMENDMENT"
status: "draft"
author: "architect-agent"
created: "2026-03-13T00:00:00Z"
---

# AMENDMENT — Architecture

## Technical Overview

The amendment capability extends the existing event-mutation-validate-resolve pipeline with backward tier transitions, a new `state.amendment` block, three new mutation handlers, amendment-aware resolver routing, additive validator invariants (V16–V19), and a shared `amend-plan` skill. All changes follow the post-PIPELINE-HOTFIX baseline: mutations stay pure, I/O stays in the engine, the `EXTERNAL_ACTIONS` set gates all external routing, and the bounded re-resolve loop handles internal actions. Zero new external dependencies — CommonJS + Node.js built-ins only.

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Layer (Presentation)                                     │
│  Orchestrator, Product Manager, UX Designer, Architect agents   │
│  — action routing, agent spawning, askQuestions interviews       │
├─────────────────────────────────────────────────────────────────┤
│  Skill Layer (Application)                                      │
│  amend-plan skill — cascade analysis, document amendment        │
│  workflow, structured output (sections_changed, cascade_flags)  │
├─────────────────────────────────────────────────────────────────┤
│  Pipeline Engine Layer (Domain)                                 │
│  pipeline-engine.js — event pre-reads, internal action handling │
│  mutations.js — plan_amendment_requested, amendment_approved,   │
│                 amendment_cancelled handlers                    │
│  resolver.js — amendment-aware tier routing                     │
│  state-validator.js — V16–V19 invariants                        │
│  constants.js — new NEXT_ACTIONS, AMENDMENT_STATUSES enum       │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                           │
│  state-io.js (unchanged), triage-engine.js (unchanged),         │
│  orchestration.yml (minor addition)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `constants` | Domain | `.github/orchestration/scripts/lib/constants.js` | New `AMENDMENT_STATUSES` enum, 7 new `NEXT_ACTIONS` entries |
| `mutations` | Domain | `.github/orchestration/scripts/lib/mutations.js` | 3 new handlers: `handlePlanAmendmentRequested`, `handleAmendmentApproved`, `handleAmendmentCancelled` |
| `resolver` | Domain | `.github/orchestration/scripts/lib/resolver.js` | New `resolveAmendment()` function, amendment check before standard tier routing |
| `state-validator` | Domain | `.github/orchestration/scripts/lib/state-validator.js` | 4 new invariants: V16 (amendment block consistency), V17 (amendment approval gate), V18 (backward tier transition guard), V19 (completed phase immutability) |
| `pipeline-engine` | Domain | `.github/orchestration/scripts/lib/pipeline-engine.js` | Amendment pre-read, tier guard, `EXTERNAL_ACTIONS` additions, `scaffoldInitialState` update, internal action handling for `resume_from_amendment` |
| `amend-plan` skill | Application | `.github/skills/amend-plan/SKILL.md` | Cascade analysis algorithm, document amendment workflow, structured output contract |
| `orchestrator` agent | Agent | `.github/agents/orchestrator.agent.md` | 7 new action routing table entries, 7 new events, amendment flow documentation |
| `product-manager` agent | Agent | `.github/agents/product-manager.agent.md` | `amend-plan` skill added to skill inventory |
| `ux-designer` agent | Agent | `.github/agents/ux-designer.agent.md` | `amend-plan` skill added to skill inventory |
| `architect` agent | Agent | `.github/agents/architect.agent.md` | `amend-plan` skill added to skill inventory |
| `orchestration.yml` | Infrastructure | `.github/orchestration.yml` | Optional `amendments.max_per_project` limit |

## Contracts & Interfaces

### State Amendment Block Schema

```javascript
// In state.json — new top-level sibling alongside project, pipeline, planning, execution, etc.
// When no amendment is active: state.amendment = null (not an empty object)

/**
 * @typedef {Object|null} AmendmentBlock
 * @property {'pending'|'in_progress'|'awaiting_approval'} status
 * @property {'execution'|'complete'} source_tier - Tier from which amendment was triggered
 * @property {AmendmentScope} scope - What documents to amend and how
 * @property {string[]} affected_docs - Document types flagged by cascade analysis (e.g., ["Design", "Architecture", "Master Plan"])
 * @property {string[]} completed_docs - Document types already amended in this cycle
 * @property {boolean} human_approved - Re-approval gate flag
 * @property {AmendmentResumePoint|null} resume_point - Execution position to return to (null for complete-tier amendments)
 */

/**
 * @typedef {Object} AmendmentScope
 * @property {'PRD'|'Design'|'Architecture'|'Master Plan'} primary_document - The document the human wants to amend
 * @property {string} description - Human's description of the desired change
 * @property {boolean} cascade - Whether downstream documents should also be amended
 * @property {string[]} cascade_targets - Specific downstream docs to amend (empty if cascade is false)
 */

/**
 * @typedef {Object} AmendmentResumePoint
 * @property {number} phase_index - 0-based index of the phase to resume at
 * @property {number} task_index - 0-based index of the task to resume at
 */
```

### Amendment Statuses Enum (constants.js)

```javascript
// .github/orchestration/scripts/lib/constants.js

/**
 * @type {Readonly<{PENDING: 'pending', IN_PROGRESS: 'in_progress', AWAITING_APPROVAL: 'awaiting_approval'}>}
 */
const AMENDMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  AWAITING_APPROVAL: 'awaiting_approval'
});
```

### New NEXT_ACTIONS Entries (constants.js)

```javascript
// Additions to the NEXT_ACTIONS frozen enum in constants.js
// Total grows from 35 to 42

  SPAWN_AMEND_PRD: 'spawn_amend_prd',
  SPAWN_AMEND_DESIGN: 'spawn_amend_design',
  SPAWN_AMEND_ARCHITECTURE: 'spawn_amend_architecture',
  SPAWN_AMEND_MASTER_PLAN: 'spawn_amend_master_plan',
  REQUEST_AMENDMENT_APPROVAL: 'request_amendment_approval',
  RESUME_FROM_AMENDMENT: 'resume_from_amendment',
  CANCEL_AMENDMENT: 'cancel_amendment',
```

### Mutation Handler Interfaces (mutations.js)

```javascript
// .github/orchestration/scripts/lib/mutations.js

/**
 * Handler 19: plan_amendment_requested
 * Sets state.amendment block, records source tier, records resume point.
 * Backward tier transition: current_tier → 'planning'.
 *
 * @param {Object} state - Current state (mutated in place)
 * @param {Object} context
 * @param {string} context.primary_document - "PRD"|"Design"|"Architecture"|"Master Plan"
 * @param {string} context.description - Human's amendment description
 * @param {boolean} context.cascade - Whether cascade is enabled
 * @param {string[]} context.cascade_targets - Downstream doc types to amend
 * @returns {MutationResult}
 */
function handlePlanAmendmentRequested(state, context);

/**
 * Handler 20: amendment_approved
 * Clears amendment block, transitions back to execution tier.
 * If source_tier === 'execution': resumes at resume_point, resets triage_attempts.
 * If source_tier === 'complete': re-initializes execution for new phases.
 * Requires pre-read of amended Master Plan for total_phases (context.total_phases).
 *
 * @param {Object} state - Current state (mutated in place)
 * @param {Object} context
 * @param {number} context.total_phases - From amended Master Plan frontmatter pre-read
 * @returns {MutationResult}
 */
function handleAmendmentApproved(state, context);

/**
 * Handler 21: amendment_cancelled
 * Clears amendment block, restores tier to source_tier.
 * If source_tier === 'execution': restores execution tier, resumes at resume_point.
 * If source_tier === 'complete': restores complete tier.
 *
 * @param {Object} state - Current state (mutated in place)
 * @param {Object} context - Empty (no additional context needed)
 * @returns {MutationResult}
 */
function handleAmendmentCancelled(state, context);
```

### Mutation Handler Logic (mutations.js)

```javascript
// Handler 19 — plan_amendment_requested
function handlePlanAmendmentRequested(state, context) {
  const mutations = [];
  const sourceTier = state.pipeline.current_tier;

  // Build the cascade targets list based on primary document and cascade flag
  const CASCADE_MAP = {
    'PRD':           ['Design', 'Architecture', 'Master Plan'],
    'Design':        ['Architecture', 'Master Plan'],
    'Architecture':  ['Master Plan'],
    'Master Plan':   []
  };
  const allCascadeTargets = CASCADE_MAP[context.primary_document] || [];
  const cascadeTargets = context.cascade
    ? (context.cascade_targets.length > 0 ? context.cascade_targets : allCascadeTargets)
    : [];

  // Build affected_docs: primary + cascade targets
  const affectedDocs = [context.primary_document, ...cascadeTargets];

  // Record resume point (execution tier only)
  const resumePoint = sourceTier === PIPELINE_TIERS.EXECUTION
    ? { phase_index: state.execution.current_phase, task_index: currentPhase(state).current_task }
    : null;

  state.amendment = {
    status: AMENDMENT_STATUSES.PENDING,
    source_tier: sourceTier,
    scope: {
      primary_document: context.primary_document,
      description: context.description,
      cascade: context.cascade,
      cascade_targets: cascadeTargets
    },
    affected_docs: affectedDocs,
    completed_docs: [],
    human_approved: false,
    resume_point: resumePoint
  };

  state.pipeline.current_tier = PIPELINE_TIERS.PLANNING;

  mutations.push(
    `amendment.status → pending`,
    `amendment.source_tier → ${sourceTier}`,
    `amendment.scope.primary_document → ${context.primary_document}`,
    `amendment.affected_docs → [${affectedDocs.join(', ')}]`,
    `pipeline.current_tier → planning`
  );
  if (resumePoint) {
    mutations.push(`amendment.resume_point → phase ${resumePoint.phase_index}, task ${resumePoint.task_index}`);
  }

  return { state, mutations_applied: mutations };
}

// Handler 20 — amendment_approved
function handleAmendmentApproved(state, context) {
  const mutations = [];
  const sourceTier = state.amendment.source_tier;
  const resumePoint = state.amendment.resume_point;

  if (sourceTier === PIPELINE_TIERS.EXECUTION) {
    // Resume at the current execution position
    state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
    state.execution.triage_attempts = 0;
    mutations.push(
      'pipeline.current_tier → execution',
      'execution.triage_attempts → 0'
    );

    // If total_phases changed from amendment, extend phases array
    if (context.total_phases > state.execution.phases.length) {
      const newCount = context.total_phases - state.execution.phases.length;
      for (let i = 0; i < newCount; i++) {
        state.execution.phases.push({
          status: PHASE_STATUSES.NOT_STARTED,
          tasks: [],
          current_task: 0,
          phase_doc: null,
          phase_report: null,
          phase_review: null,
          phase_review_verdict: null,
          phase_review_action: null,
          triage_attempts: 0,
          human_approved: false
        });
      }
      state.execution.total_phases = context.total_phases;
      mutations.push(`execution.phases extended by ${newCount} new phases`);
      mutations.push(`execution.total_phases → ${context.total_phases}`);
    }
  } else if (sourceTier === PIPELINE_TIERS.COMPLETE) {
    // Append new phases, restart execution at first new phase
    const previousPhaseCount = state.execution.phases.length;
    const newPhaseCount = context.total_phases - previousPhaseCount;

    for (let i = 0; i < newPhaseCount; i++) {
      state.execution.phases.push({
        status: PHASE_STATUSES.NOT_STARTED,
        tasks: [],
        current_task: 0,
        phase_doc: null,
        phase_report: null,
        phase_review: null,
        phase_review_verdict: null,
        phase_review_action: null,
        triage_attempts: 0,
        human_approved: false
      });
    }

    state.execution.total_phases = context.total_phases;
    state.execution.current_phase = previousPhaseCount; // First new phase
    state.execution.status = 'in_progress';
    state.execution.triage_attempts = 0;
    state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;

    mutations.push(
      `execution.phases appended ${newPhaseCount} new phases`,
      `execution.total_phases → ${context.total_phases}`,
      `execution.current_phase → ${previousPhaseCount}`,
      'execution.status → in_progress',
      'execution.triage_attempts → 0',
      'pipeline.current_tier → execution'
    );
  }

  // Clear amendment block
  state.amendment = null;
  mutations.push('amendment → null');

  return { state, mutations_applied: mutations };
}

// Handler 21 — amendment_cancelled
function handleAmendmentCancelled(state, context) {
  const mutations = [];
  const sourceTier = state.amendment.source_tier;

  if (sourceTier === PIPELINE_TIERS.EXECUTION) {
    state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
    mutations.push('pipeline.current_tier → execution');
  } else if (sourceTier === PIPELINE_TIERS.COMPLETE) {
    state.pipeline.current_tier = PIPELINE_TIERS.COMPLETE;
    mutations.push('pipeline.current_tier → complete');
  }

  state.amendment = null;
  mutations.push('amendment → null');

  return { state, mutations_applied: mutations };
}
```

### MUTATIONS Table Additions (mutations.js)

```javascript
// Additions to the MUTATIONS record in mutations.js (after final_rejected entry)
  plan_amendment_requested: handlePlanAmendmentRequested,
  amendment_approved:       handleAmendmentApproved,
  amendment_cancelled:      handleAmendmentCancelled,
```

### Resolver Amendment Routing (resolver.js)

```javascript
// .github/orchestration/scripts/lib/resolver.js

/**
 * Document type → planning step key → spawn action mapping for amendments.
 * @type {ReadonlyArray<{doc: string, stepKey: string, action: string}>}
 */
const AMENDMENT_DOC_ORDER = [
  { doc: 'PRD',           stepKey: 'prd',          action: NEXT_ACTIONS.SPAWN_AMEND_PRD },
  { doc: 'Design',        stepKey: 'design',       action: NEXT_ACTIONS.SPAWN_AMEND_DESIGN },
  { doc: 'Architecture',  stepKey: 'architecture', action: NEXT_ACTIONS.SPAWN_AMEND_ARCHITECTURE },
  { doc: 'Master Plan',   stepKey: 'master_plan',  action: NEXT_ACTIONS.SPAWN_AMEND_MASTER_PLAN }
];

/**
 * Resolve the next action when an amendment is active.
 * Routes through amendment lifecycle: pending docs → awaiting approval → resume.
 *
 * @param {Object} state - Parsed state.json with active state.amendment
 * @returns {NextActionResult}
 */
function resolveAmendment(state) {
  const amendment = state.amendment;

  // Find the next document that needs amending (in cascade order)
  for (const entry of AMENDMENT_DOC_ORDER) {
    if (amendment.affected_docs.includes(entry.doc) && !amendment.completed_docs.includes(entry.doc)) {
      return makeResult(entry.action, {
        tier: PIPELINE_TIERS.PLANNING,
        details: `Amendment active: spawning agent to amend ${entry.doc}`
      });
    }
  }

  // All docs amended — check re-approval gate
  if (!amendment.human_approved) {
    return makeResult(NEXT_ACTIONS.REQUEST_AMENDMENT_APPROVAL, {
      tier: PIPELINE_TIERS.PLANNING,
      details: 'All amendment documents complete; awaiting human re-approval'
    });
  }

  // Approved — resume (this path is reached only if amendment block wasn't cleared yet)
  return makeResult(NEXT_ACTIONS.RESUME_FROM_AMENDMENT, {
    tier: PIPELINE_TIERS.PLANNING,
    details: 'Amendment approved; resuming from ' + amendment.source_tier
  });
}
```

### Resolver Integration Point (resolver.js)

```javascript
// In resolveNextAction(), BEFORE the existing tier routing chain:

function resolveNextAction(state, config) {
  // 0a: No state → init project
  if (state == null) {
    return makeResult(NEXT_ACTIONS.INIT_PROJECT, {
      details: 'No state.json provided; initializing new project'
    });
  }

  const tier = state.pipeline.current_tier;

  // 0b: Halted
  if (tier === PIPELINE_TIERS.HALTED) {
    return makeResult(NEXT_ACTIONS.DISPLAY_HALTED, {
      tier: PIPELINE_TIERS.HALTED,
      details: 'Pipeline is halted; displaying blockers'
    });
  }

  // ── NEW: Amendment check (before standard tier routing) ──
  if (state.amendment) {
    return resolveAmendment(state);
  }

  // 0c: Complete
  if (tier === PIPELINE_TIERS.COMPLETE) {
    // ... existing code unchanged
  }

  // ... rest of existing tier routing unchanged
}
```

### Validator Invariants (state-validator.js)

```javascript
// .github/orchestration/scripts/lib/state-validator.js

/**
 * V16 — Amendment block field consistency
 * If state.amendment is not null, required fields must be present and valid.
 * @param {Object} proposed
 * @returns {InvariantError[]}
 */
function checkV16(proposed) {
  const errors = [];
  if (proposed.amendment == null) return errors;

  const a = proposed.amendment;
  const validStatuses = ['pending', 'in_progress', 'awaiting_approval'];
  if (!validStatuses.includes(a.status)) {
    errors.push(makeError('V16', `amendment.status '${a.status}' is not one of: ${validStatuses.join(', ')}`));
  }

  const validSourceTiers = ['execution', 'complete'];
  if (!validSourceTiers.includes(a.source_tier)) {
    errors.push(makeError('V16', `amendment.source_tier '${a.source_tier}' is not one of: ${validSourceTiers.join(', ')}`));
  }

  if (a.scope == null || typeof a.scope.primary_document !== 'string') {
    errors.push(makeError('V16', 'amendment.scope.primary_document is missing or not a string'));
  }

  if (!Array.isArray(a.affected_docs) || a.affected_docs.length === 0) {
    errors.push(makeError('V16', 'amendment.affected_docs must be a non-empty array'));
  }

  if (!Array.isArray(a.completed_docs)) {
    errors.push(makeError('V16', 'amendment.completed_docs must be an array'));
  }

  if (a.source_tier === 'execution' && a.resume_point == null) {
    errors.push(makeError('V16', 'amendment.resume_point is required when source_tier is execution'));
  }

  return errors;
}

/**
 * V17 — Amendment approval gate
 * If an active amendment exists and is not approved, current_tier cannot be 'execution'.
 * Prevents premature resume before re-approval.
 * @param {Object} proposed
 * @returns {InvariantError[]}
 */
function checkV17(proposed) {
  const errors = [];
  if (proposed.amendment != null && !proposed.amendment.human_approved &&
      proposed.pipeline.current_tier === PIPELINE_TIERS.EXECUTION) {
    errors.push(makeError('V17', "active amendment exists with human_approved=false but current_tier is 'execution' (amendment re-approval gate violated)"));
  }
  return errors;
}

/**
 * V18 — Backward tier transition guard
 * execution → planning and complete → planning transitions are only valid
 * when an active amendment exists in proposed state.
 * @param {Object} current
 * @param {Object} proposed
 * @returns {InvariantError[]}
 */
function checkV18(current, proposed) {
  const errors = [];
  const from = current.pipeline.current_tier;
  const to = proposed.pipeline.current_tier;

  // execution → planning
  if (from === PIPELINE_TIERS.EXECUTION && to === PIPELINE_TIERS.PLANNING) {
    if (proposed.amendment == null) {
      errors.push(makeError('V18', "backward tier transition execution → planning without active amendment"));
    }
  }

  // complete → planning
  if (from === PIPELINE_TIERS.COMPLETE && to === PIPELINE_TIERS.PLANNING) {
    if (proposed.amendment == null) {
      errors.push(makeError('V18', "backward tier transition complete → planning without active amendment"));
    }
  }

  return errors;
}

/**
 * V19 — Completed phase immutability during amendment
 * Completed phases must not have their status, tasks, or review fields modified.
 * @param {Object} current
 * @param {Object} proposed
 * @returns {InvariantError[]}
 */
function checkV19(current, proposed) {
  const errors = [];
  const currentPhases = current.execution.phases || [];
  const proposedPhases = proposed.execution.phases || [];

  // Only enforce when an amendment is active (or was just cleared)
  // Check each phase that was complete in current state
  for (let i = 0; i < Math.min(currentPhases.length, proposedPhases.length); i++) {
    if (currentPhases[i].status === PHASE_STATUSES.COMPLETE) {
      const cur = currentPhases[i];
      const prop = proposedPhases[i];
      if (prop.status !== PHASE_STATUSES.COMPLETE) {
        errors.push(makeError('V19', `Phase ${i} was complete but proposed status is '${prop.status}' (completed phase immutability)`));
      }
    }
  }

  return errors;
}
```

### Validator Integration (state-validator.js)

```javascript
// In validateTransition(), after V15 checks:

  allErrors.push(...checkV16(proposed));
  allErrors.push(...checkV17(proposed));

  // V18 requires current state
  // (runs after currentGuardErrors check alongside V11–V15)
  allErrors.push(...checkV18(current, proposed));
  allErrors.push(...checkV19(current, proposed));

// Update invariants_checked count: 15 → 19
// return { valid: true/false, invariants_checked: 19, ... }
```

### Pipeline Engine Changes (pipeline-engine.js)

```javascript
// 1. EXTERNAL_ACTIONS additions (module scope, after existing entries)
const EXTERNAL_ACTIONS = new Set([
  // ... existing 18 entries ...
  NEXT_ACTIONS.SPAWN_AMEND_PRD,
  NEXT_ACTIONS.SPAWN_AMEND_DESIGN,
  NEXT_ACTIONS.SPAWN_AMEND_ARCHITECTURE,
  NEXT_ACTIONS.SPAWN_AMEND_MASTER_PLAN,
  NEXT_ACTIONS.REQUEST_AMENDMENT_APPROVAL,
  NEXT_ACTIONS.CANCEL_AMENDMENT,
  // Note: RESUME_FROM_AMENDMENT is internal — handled by engine, NOT in EXTERNAL_ACTIONS
]);

// 2. scaffoldInitialState() addition
function scaffoldInitialState(config, projectDir) {
  return {
    // ... existing fields ...
    amendment: null,   // ← NEW: initialized as null
    // ... existing fields (errors, limits) ...
  };
}

// 3. Amendment pre-read (in executePipeline, after task report pre-read, before mutation call)
  // Amendment tier guard: reject plan_amendment_requested during review
  if (event === 'plan_amendment_requested') {
    if (state.pipeline.current_tier === PIPELINE_TIERS.REVIEW) {
      return makeErrorResult(
        'Amendments are not accepted during final review. Complete the review first, then amend from the completed state.',
        event, [], null, null
      );
    }
    if (state.pipeline.current_tier !== PIPELINE_TIERS.EXECUTION &&
        state.pipeline.current_tier !== PIPELINE_TIERS.COMPLETE) {
      return makeErrorResult(
        `Amendments can only be requested from execution or complete tiers, current tier: '${state.pipeline.current_tier}'`,
        event, [], null, null
      );
    }
  }

  // Amendment approval pre-read: re-read Master Plan for updated total_phases
  if (event === 'amendment_approved') {
    const masterPlanPath = state.planning.steps.master_plan.output;
    if (!masterPlanPath) {
      return makeErrorResult(
        'Master plan path not found in state.planning.steps.master_plan.output',
        event, [], null, null
      );
    }
    try {
      const masterPlanDoc = io.readDocument(masterPlanPath);
      if (!masterPlanDoc) {
        return makeErrorResult(
          `Failed to read master plan at '${masterPlanPath}': document not found`,
          event, [], null, null
        );
      }
      const fm = masterPlanDoc.frontmatter || {};
      const totalPhases = parseInt(fm.total_phases, 10);
      if (!Number.isInteger(totalPhases) || totalPhases <= 0) {
        return makeErrorResult(
          `Master plan total_phases must be a positive integer, got '${fm.total_phases}'`,
          event, [], null, null
        );
      }
      context.total_phases = totalPhases;
    } catch (err) {
      return makeErrorResult(
        `Failed to read master plan at '${masterPlanPath}': ${err.message}`,
        event, [], null, null
      );
    }
  }

// 4. Internal action handling for resume_from_amendment (after advance_phase block)
  if (resolved.action === NEXT_ACTIONS.RESUME_FROM_AMENDMENT) {
    // Amendment already approved — clear the block and resume
    // (This path handles the edge case where amendment_approved mutation
    //  didn't clear the block before resolve ran)
    if (state.amendment) {
      state.amendment = null;
      allMutationsApplied.push('amendment → null (internal clear)');
    }

    // Re-validate
    const preResumeState = deepClone(proposedState);
    proposedState.project.updated = new Date().toISOString();
    const resumeValidation = validateTransition(preResumeState, proposedState);
    if (!resumeValidation.valid) {
      const firstError = resumeValidation.errors[0];
      return makeErrorResult(
        `Validation failed after resume_from_amendment: [${firstError.invariant}] ${firstError.message}`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        false
      );
    }

    io.writeState(projectDir, proposedState);

    // Re-resolve to get external action
    resolved = resolveNextAction(proposedState, config);

    if (!EXTERNAL_ACTIONS.has(resolved.action)) {
      return makeErrorResult(
        `Internal re-resolve produced unmapped action '${resolved.action}' after handling 'resume_from_amendment'. Max internal iterations (1) exceeded.`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        true
      );
    }
  }
```

### Amendment Completion Mutation (mutations.js)

```javascript
// New event handlers for when each planning agent finishes amending a document.
// These update state.amendment.completed_docs and advance status.

/**
 * Handler 22–25: amend_*_completed events
 * Marks the document type as completed in the amendment block.
 * Advances amendment.status to 'awaiting_approval' when all docs are done.
 *
 * @param {Object} state
 * @param {Object} context
 * @param {string} context.doc_path - Path to amended document
 * @param {string} docType - "PRD"|"Design"|"Architecture"|"Master Plan"
 * @returns {MutationResult}
 */
function handleAmendDocCompleted(state, context, docType) {
  const mutations = [];

  // Update the planning step output path to the amended document
  const STEP_KEY_MAP = {
    'PRD': 'prd',
    'Design': 'design',
    'Architecture': 'architecture',
    'Master Plan': 'master_plan'
  };
  const stepKey = STEP_KEY_MAP[docType];
  if (stepKey && context.doc_path) {
    state.planning.steps[stepKey].output = context.doc_path;
    mutations.push(`planning.steps.${stepKey}.output → ${context.doc_path}`);
  }

  // Mark document as completed in amendment tracking
  if (!state.amendment.completed_docs.includes(docType)) {
    state.amendment.completed_docs.push(docType);
    mutations.push(`amendment.completed_docs ← ${docType}`);
  }

  // Advance status if all docs are now complete
  const allDone = state.amendment.affected_docs.every(
    doc => state.amendment.completed_docs.includes(doc)
  );
  if (allDone) {
    state.amendment.status = AMENDMENT_STATUSES.AWAITING_APPROVAL;
    mutations.push('amendment.status → awaiting_approval');
  } else {
    state.amendment.status = AMENDMENT_STATUSES.IN_PROGRESS;
    mutations.push('amendment.status → in_progress');
  }

  return { state, mutations_applied: mutations };
}

function handleAmendPrdCompleted(state, context) {
  return handleAmendDocCompleted(state, context, 'PRD');
}
function handleAmendDesignCompleted(state, context) {
  return handleAmendDocCompleted(state, context, 'Design');
}
function handleAmendArchitectureCompleted(state, context) {
  return handleAmendDocCompleted(state, context, 'Architecture');
}
function handleAmendMasterPlanCompleted(state, context) {
  return handleAmendDocCompleted(state, context, 'Master Plan');
}
```

### MUTATIONS Table — Complete Additions (mutations.js)

```javascript
// Full additions to the MUTATIONS record
  plan_amendment_requested:    handlePlanAmendmentRequested,    // Handler 19
  amendment_approved:          handleAmendmentApproved,         // Handler 20
  amendment_cancelled:         handleAmendmentCancelled,        // Handler 21
  amend_prd_completed:         handleAmendPrdCompleted,         // Handler 22
  amend_design_completed:      handleAmendDesignCompleted,      // Handler 23
  amend_architecture_completed: handleAmendArchitectureCompleted, // Handler 24
  amend_master_plan_completed: handleAmendMasterPlanCompleted,  // Handler 25
```

### amend-plan Skill Interface

```markdown
# amend-plan Skill — Input/Output Contract

## Inputs (provided by invoking agent)

| Input | Type | Description |
|-------|------|-------------|
| `existing_document_path` | string | Path to the current version of the document |
| `amendment_description` | string | Human's description of the change |
| `cascade_context` | string or null | Summary of upstream changes (if cascade-triggered) |
| `document_type` | "PRD" \| "Design" \| "Architecture" \| "Master Plan" | Type of document being amended |
| `project_dir` | string | Project directory path |

## Outputs (returned by skill)

| Output | Type | Description |
|--------|------|-------------|
| `amended_document_path` | string | Path to the saved amended document |
| `sections_changed` | string[] | Identifiers of sections modified (e.g., "FR-12", "Flow 3") |
| `cascade_flags` | string[] | Downstream document types that need amendment |

## Cascade Analysis Algorithm

The cascade map is deterministic based on document type:

  PRD          → [Design, Architecture, Master Plan]
  Design       → [Architecture, Master Plan]
  Architecture → [Master Plan]
  Master Plan  → [] (terminal)

The skill:
1. Reads the existing document
2. Identifies sections affected by the amendment description
3. Applies targeted changes (preserves unaffected sections)
4. Evaluates which downstream document types would be impacted
5. If document_type === "Master Plan": updates total_phases frontmatter if phases added/removed
6. Returns structured output
```

### Orchestrator Action Routing Table Additions

```markdown
| # | `result.action` | Category | Orchestrator Operation | Event to Signal on Completion |
|---|-----------------|----------|----------------------|-------------------------------|
| 19 | `spawn_amend_prd` | Agent spawn | Spawn **Product Manager** with amendment context (existing PRD path, amendment description, cascade context). Agent invokes `amend-plan` skill. | `amend_prd_completed` with `{ "doc_path": "<output-path>" }` |
| 20 | `spawn_amend_design` | Agent spawn | Spawn **UX Designer** with amendment context (existing Design path, amendment description, cascade context). Agent invokes `amend-plan` skill. | `amend_design_completed` with `{ "doc_path": "<output-path>" }` |
| 21 | `spawn_amend_architecture` | Agent spawn | Spawn **Architect** with amendment context (existing Architecture path, amendment description, cascade context). Agent invokes `amend-plan` skill. | `amend_architecture_completed` with `{ "doc_path": "<output-path>" }` |
| 22 | `spawn_amend_master_plan` | Agent spawn | Spawn **Architect** with amendment context (existing Master Plan path, amendment description, cascade context). Agent invokes `amend-plan` skill. | `amend_master_plan_completed` with `{ "doc_path": "<output-path>" }` |
| 23 | `request_amendment_approval` | Human gate | Present amendment summary (documents amended, sections changed, cascade path, execution impact) to the human. Ask human to approve, reject, or skip re-approval. | `amendment_approved` (if approved/skipped) or `amendment_cancelled` (if rejected/cancelled) |
| 24 | `cancel_amendment` | Terminal | Display cancellation confirmation. Signal pipeline to restore pre-amendment state. | `amendment_cancelled` |
| 25 | `resume_from_amendment` | Internal | *(Handled internally by engine — never reaches Orchestrator routing table)* | *(N/A — internal action)* |
```

### Orchestrator Event Signaling Additions

```markdown
| Event | Context Payload | When to Signal |
|-------|----------------|----------------|
| `plan_amendment_requested` | `{ "primary_document": "PRD\|Design\|Architecture\|Master Plan", "description": "<text>", "cascade": true\|false, "cascade_targets": ["Design", ...] }` | After human confirms amendment scope via askQuestions interview |
| `amend_prd_completed` | `{ "doc_path": "<path>" }` | After Product Manager finishes amending PRD |
| `amend_design_completed` | `{ "doc_path": "<path>" }` | After UX Designer finishes amending Design |
| `amend_architecture_completed` | `{ "doc_path": "<path>" }` | After Architect finishes amending Architecture |
| `amend_master_plan_completed` | `{ "doc_path": "<path>" }` | After Architect finishes amending Master Plan |
| `amendment_approved` | `{}` | After human approves the amendment (or skips re-approval) |
| `amendment_cancelled` | `{}` | After human cancels the amendment |
```

## Dependencies

### External Dependencies

None. Zero new external dependencies. All changes use CommonJS + Node.js built-ins only (per NFR-6 and PIPELINE-HOTFIX baseline).

### Internal Dependencies (module → module)

```
amend-plan skill
  ├── (invoked by) Product Manager agent
  ├── (invoked by) UX Designer agent
  └── (invoked by) Architect agent

pipeline-engine.js
  ├── mutations.js (7 new handlers)
  ├── state-validator.js (V16–V19)
  ├── resolver.js (resolveAmendment)
  ├── constants.js (AMENDMENT_STATUSES, 7 NEXT_ACTIONS)
  └── state-io.js (unchanged — readDocument for pre-reads)

resolver.js
  └── constants.js (NEXT_ACTIONS, PIPELINE_TIERS, AMENDMENT_STATUSES)

mutations.js
  └── constants.js (PIPELINE_TIERS, PHASE_STATUSES, AMENDMENT_STATUSES)

state-validator.js
  └── constants.js (PIPELINE_TIERS, PHASE_STATUSES)

orchestrator.agent.md
  └── pipeline.js CLI (unchanged interface)
```

### Dependency Change Summary

| File | Imports From | New Imports |
|------|-------------|-------------|
| `mutations.js` | `constants.js` | `AMENDMENT_STATUSES` |
| `resolver.js` | `constants.js` | `AMENDMENT_STATUSES` (for status checks if needed) |
| `state-validator.js` | `constants.js` | `PHASE_STATUSES` (for V19 completed phase check) |
| `pipeline-engine.js` | `constants.js` | (already imports `NEXT_ACTIONS`, `PHASE_STATUSES`, `PIPELINE_TIERS` — no new imports needed) |

## File Structure

### New Files

```
.github/
├── skills/
│   └── amend-plan/
│       ├── SKILL.md                    # Skill definition with cascade analysis workflow
│       └── templates/
│           └── AMENDMENT-SUMMARY.md    # Template for amendment summary output (optional)
```

### Modified Files — Pipeline Engine

```
.github/orchestration/scripts/lib/
├── constants.js              # + AMENDMENT_STATUSES enum, + 7 NEXT_ACTIONS entries
├── mutations.js              # + 7 new handlers (19–25), + 7 MUTATIONS table entries, + handleAmendDocCompleted helper
├── resolver.js               # + resolveAmendment() function, + AMENDMENT_DOC_ORDER mapping, + amendment check in resolveNextAction()
├── state-validator.js        # + checkV16(), checkV17(), checkV18(), checkV19(), invariants_checked 15 → 19
└── pipeline-engine.js        # + 6 EXTERNAL_ACTIONS entries, + amendment: null in scaffoldInitialState(),
                              #   + amendment tier guard, + amendment_approved pre-read,
                              #   + resume_from_amendment internal action handling
```

### Modified Files — Agents

```
.github/agents/
├── orchestrator.agent.md     # + 7 action routing entries (19–25), + 7 event entries, + amendment flow section
├── product-manager.agent.md  # + amend-plan skill reference, + amendment mode instructions
├── ux-designer.agent.md      # + amend-plan skill reference, + amendment mode instructions
└── architect.agent.md        # + amend-plan skill reference, + amendment mode instructions
```

### Modified Files — Tests

```
.github/orchestration/scripts/lib/
├── mutations.test.js         # + tests for all 7 new handlers
├── resolver.test.js          # + tests for resolveAmendment(), amendment routing in resolveNextAction()
├── state-validator.test.js   # + tests for V16, V17, V18, V19
└── pipeline-engine.test.js   # + tests for amendment tier guard, pre-reads, resume_from_amendment internal action,
                              #   EXTERNAL_ACTIONS membership, scaffoldInitialState amendment field
```

### Modified Files — Configuration & Documentation

```
.github/
├── orchestration.yml                      # + amendments.max_per_project (optional)
├── copilot-instructions.md                # + amendment reference in pipeline description
├── instructions/
│   └── state-management.instructions.md   # + backward tier transitions, + amendment invariants
│
docs/
├── pipeline.md               # + Amendment Pipeline section, + backward tier transitions, + sequence diagram
├── skills.md                 # + amend-plan entry, + updated agent-skill composition table
├── configuration.md          # + amendment configuration keys
├── scripts.md                # + new events, + new actions in vocabularies
└── agents.md                 # + amendment capabilities for planning agents
│
README.md                     # + Plan Amendment in Key Features, + amendment loop in pipeline flowchart
```

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Error handling** | Amendment mutation failures return `makeErrorResult()` with descriptive messages. Tier guard rejects amendments from invalid tiers with human-readable messages. All new failure conditions produce exit code 1 (hard error). Error results are compatible with the `log-error` skill flow (HOTFIX FR-16). |
| **State validation** | 4 new additive invariants (V16–V19). Existing V1–V15 are unmodified. V7 (`human_approved` before execution) is unaffected by backward transitions because `planning.human_approved` remains `true` from original approval. V12 (task status transitions) is unaffected because amendment doesn't change task statuses. |
| **Backward tier transitions** | Only valid with active `state.amendment` block (V18). Two valid paths: `execution → planning` (mid-execution amendment) and `complete → planning` (post-completion extension). All other backward transitions are blocked. |
| **Amendment cancellation** | `handleAmendmentCancelled` restores `pipeline.current_tier` to `source_tier` and sets `amendment` to `null`. Document files amended during the cycle are not automatically reverted (documents are saved by agents; the Orchestrator can instruct agents not to commit, or the human can use git to revert). |
| **State consistency** | `state.amendment` is either `null` (no amendment) or a fully-formed block (V16 validates). No empty objects. No partial states between `null` and complete. `resume_point` is required for execution-tier amendments (V16). |
| **Triage reset** | `triage_attempts` resets to 0 when execution resumes after amendment (in `handleAmendmentApproved`). Prevents stale loop detection. |
| **Completed phase immutability** | V19 prevents completed phases from having their status changed. Amendment-appended phases start as `not_started` — never modifying completed ones. |
| **Pre-read pattern** | `amendment_approved` reuses the master plan pre-read pattern from `plan_approved` (reads `total_phases` from frontmatter). Consistent with HOTFIX baseline. |
| **Internal action pattern** | `resume_from_amendment` follows the same bounded re-resolve loop as `advance_phase`: apply changes → re-validate → re-resolve → check `EXTERNAL_ACTIONS`. Max 1 internal iteration. |
| **Single in-progress task (V6)** | The design requires the current task to finish before amendment begins. The Orchestrator enforces this conversationally — it waits for the task to complete, then signals `plan_amendment_requested`. V6 is preserved because no task becomes in-progress during the amendment planning flow. |

## Phasing Recommendations

The following phasing is advisory — the Tactical Planner makes final decisions.

### Phase 1: Pipeline Engine Core — State Schema, Constants, Mutations, Validator

**Goal**: Implement the foundational pipeline machinery for amendments — state schema changes, new constants, mutation handlers, and validator invariants.

**Scope**:
- `constants.js`: Add `AMENDMENT_STATUSES` enum and 7 new `NEXT_ACTIONS` entries
- `mutations.js`: Implement all 7 new handlers (19–25), add `MUTATIONS` table entries, add `handleAmendDocCompleted` shared helper
- `state-validator.js`: Implement `checkV16()`, `checkV17()`, `checkV18()`, `checkV19()`, update `validateTransition()` to include V16–V19, update `invariants_checked` from 15 to 19
- `pipeline-engine.js`: Add `amendment: null` to `scaffoldInitialState()`, add amendment tier guard for `plan_amendment_requested`, add `amendment_approved` pre-read block, add 6 entries to `EXTERNAL_ACTIONS` set, add `resume_from_amendment` internal action handler
- Tests: Full test coverage for all new mutations, validator invariants, pipeline engine changes

**Exit Criteria**:
- All existing test suites pass unmodified
- All new mutation handlers produce correct state transitions
- V16–V19 invariants correctly validate and reject invalid states
- Tier guard rejects amendments from review/planning/halted tiers
- `amendment_approved` pre-read correctly loads `total_phases`
- `EXTERNAL_ACTIONS` includes all new amendment actions
- `scaffoldInitialState` includes `amendment: null`

### Phase 2: Resolver & Skill — Amendment Routing and amend-plan Skill

**Goal**: Implement amendment-aware resolver routing and the `amend-plan` skill that planning agents use to amend documents.

**Scope**:
- `resolver.js`: Implement `resolveAmendment()`, add `AMENDMENT_DOC_ORDER` mapping, add amendment check to `resolveNextAction()` (before standard tier routing)
- `amend-plan` skill: Create `.github/skills/amend-plan/SKILL.md` with cascade analysis algorithm, input/output contracts, document amendment workflow, `Master Plan` frontmatter update instructions
- Tests: Resolver tests for all amendment routing paths (pending → spawn agents → awaiting approval → resume)

**Exit Criteria**:
- Resolver correctly routes through amendment lifecycle
- Amendment check takes priority over standard tier routing
- `resolveAmendment()` returns correct spawn actions for each document type in cascade order
- `amend-plan` SKILL.md contains complete instructions for document-agnostic amendment
- All existing resolver tests pass unmodified

### Phase 3: Agent Updates — Orchestrator, Planning Agents

**Goal**: Update all agent definitions to support the amendment flow — new routing entries, events, skill references, and amendment mode instructions.

**Scope**:
- `orchestrator.agent.md`: Add 7 new action routing entries (19–25), 7 new event signaling entries, amendment flow documentation section, askQuestions interview instructions for scope classification
- `product-manager.agent.md`: Add `amend-plan` skill to skill inventory, add brief amendment mode instructions
- `ux-designer.agent.md`: Add `amend-plan` skill to skill inventory, add brief amendment mode instructions
- `architect.agent.md`: Add `amend-plan` skill to skill inventory, add brief amendment mode instructions

**Exit Criteria**:
- Orchestrator routing table covers all amendment actions
- Orchestrator event reference covers all amendment events
- All three planning agents reference the `amend-plan` skill
- Agent instructions for amendment mode are brief and delegate to the skill

### Phase 4: Documentation Sweep

**Goal**: Update all documentation and instruction files to reflect the amendment capability as a first-class feature.

**Scope**:
- `README.md`: Add "Plan Amendment" to Key Features, add amendment branch to pipeline flowchart
- `docs/pipeline.md`: New "Amendment Pipeline" section with tier transitions, sequence diagram, backward transition documentation
- `docs/skills.md`: Add `amend-plan` to Planning Skills table, update agent-skill composition table
- `docs/scripts.md`: Add 7 new events to Event Vocabulary, 7 new actions to Action Vocabulary
- `docs/configuration.md`: Document amendment configuration keys
- `docs/agents.md`: Update planning agent descriptions with amendment capability
- `.github/copilot-instructions.md`: Add amendment reference to pipeline description
- `.github/instructions/state-management.instructions.md`: Add backward tier transitions, amendment invariants V16–V19
- `.github/orchestration.yml`: Add `amendments.max_per_project` configuration key (optional)

**Exit Criteria**:
- All 9+ files listed above are updated
- No documentation references prior behavior or "before/after" language
- Pipeline flowchart shows amendment branch
- Agent-skill composition table reflects all three planning agents with `amend-plan`
- Event and action vocabularies are complete and accurate

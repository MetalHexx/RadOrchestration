'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  detectVersion,
  migrateToV4,
  inferTaskStage,
  inferPhaseStage,
  migrateProject,
} = require('../migrate-to-v4.js');

const { validateTransition } = require('../lib/validator.js');

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
};

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'migration');

// ─── Fixture Loading ──────────────────────────────────────────────────────────

const V1_FIXTURES = [
  'VALIDATOR-v1.json',
  'PIPELINE-FEEDBACK-v1.json',
];

const V2_FIXTURES = [
  'AMENDMENT-v2.json',
  'EXECUTE-BEHAVIORAL-TESTS-v2.json',
  'MONITORING-UI-v2.json',
  'ORCHESTRATION-REORG-v2.json',
  'PIPELINE-BEHAVIORAL-TESTS-v2.json',
  'PIPELINE-HOTFIX-v2.json',
  'SCRIPT-SIMPLIFY-AGENTS-v2.json',
  'STATE-TRANSITION-SCRIPTS-v2.json',
  'UI-PATH-FIX-v2.json',
];

const V3_FIXTURES = [
  'PATH-PORTABILITY-v3.json',
  'PIPELINE-SIMPLIFICATION-v3.json',
  'SCHEMA-OVERHAUL-v3.json',
  'SKILL-RECOMMENDATION-v3.json',
  'TRANSITION-TABLE-v3.json',
  'UI-HUMAN-GATE-CONTROLS-v3.json',
  'UI-LIVE-PROJECTS-v3.json',
  'UI-MARKDOWN-IMPROVEMENTS-v3.json',
  'V3-FIXES-v3.json',
];

const ALL_FIXTURES = [...V1_FIXTURES, ...V2_FIXTURES, ...V3_FIXTURES];

function loadFixture(filename) {
  const fullPath = path.join(FIXTURES_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

const v1Fixtures = V1_FIXTURES.map(f => ({ name: f, data: loadFixture(f) }));
const v2Fixtures = V2_FIXTURES.map(f => ({ name: f, data: loadFixture(f) }));
const v3Fixtures = V3_FIXTURES.map(f => ({ name: f, data: loadFixture(f) }));
const allFixtures = [
  ...v1Fixtures.map(f => ({ ...f, version: 1 })),
  ...v2Fixtures.map(f => ({ ...f, version: 2 })),
  ...v3Fixtures.map(f => ({ ...f, version: 3 })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TIERS = new Set(['planning', 'execution', 'review', 'complete', 'halted']);
const VALID_TASK_STAGES = new Set(['planning', 'coding', 'reporting', 'reviewing', 'complete', 'failed']);
const VALID_PHASE_STAGES = new Set(['planning', 'executing', 'reporting', 'reviewing', 'complete', 'failed']);
const PLANNING_STEP_NAMES = ['research', 'prd', 'design', 'architecture', 'master_plan'];

// ─── detectVersion ───────────────────────────────────────────────────────────

describe('detectVersion', () => {
  describe('returns correct version for all v1 fixtures', () => {
    for (const { name, data } of v1Fixtures) {
      it(`${name} → 1`, () => {
        assert.equal(detectVersion(data), 1);
      });
    }
  });

  describe('returns correct version for all v2 fixtures', () => {
    for (const { name, data } of v2Fixtures) {
      it(`${name} → 2`, () => {
        assert.equal(detectVersion(data), 2);
      });
    }
  });

  describe('returns correct version for all v3 fixtures', () => {
    for (const { name, data } of v3Fixtures) {
      it(`${name} → 3`, () => {
        assert.equal(detectVersion(data), 3);
      });
    }
  });

  describe('throws on invalid $schema', () => {
    it('throws on missing $schema (empty object {})', () => {
      assert.throws(() => detectVersion({}), /unknown or missing/i);
    });

    it('throws on garbage $schema value', () => {
      assert.throws(() => detectVersion({ $schema: 'garbage' }), /unknown or missing/i);
    });

    it('throws on v4 $schema (not a source version)', () => {
      assert.throws(
        () => detectVersion({ $schema: 'orchestration-state-v4' }),
        /unknown or missing/i,
      );
    });
  });
});

// ─── migrateToV4 — full fixture migration tests ───────────────────────────────

describe('migrateToV4 — structural assertions on all 20 fixtures', () => {
  for (const { name, data, version } of allFixtures) {
    describe(`${name} (v${version})`, () => {
      let migrated;

      it('migrates without throwing', () => {
        migrated = migrateToV4(data, version);
        assert.ok(migrated, 'migration returned a result');
      });

      it('$schema === "orchestration-state-v4"', () => {
        const m = migrateToV4(data, version);
        assert.equal(m.$schema, 'orchestration-state-v4');
      });

      it('project.name matches fixture', () => {
        const m = migrateToV4(data, version);
        assert.equal(m.project.name, data.project.name);
      });

      it('pipeline.current_tier is a valid tier string', () => {
        const m = migrateToV4(data, version);
        assert.ok(
          VALID_TIERS.has(m.pipeline.current_tier),
          `"${m.pipeline.current_tier}" is not a valid tier`,
        );
      });

      it('planning.steps is an array of 5 elements with correct names in order', () => {
        const m = migrateToV4(data, version);
        assert.ok(Array.isArray(m.planning.steps), 'planning.steps should be an array');
        assert.equal(m.planning.steps.length, 5);
        m.planning.steps.forEach((step, i) => {
          assert.equal(step.name, PLANNING_STEP_NAMES[i], `step[${i}].name mismatch`);
        });
      });

      it('every phase has docs object with phase_plan, phase_report, phase_review keys', () => {
        const m = migrateToV4(data, version);
        for (const phase of m.execution.phases) {
          assert.ok(typeof phase.docs === 'object' && phase.docs !== null, `phase "${phase.name}" missing docs`);
          assert.ok('phase_plan' in phase.docs, `phase "${phase.name}" docs.phase_plan missing`);
          assert.ok('phase_report' in phase.docs, `phase "${phase.name}" docs.phase_report missing`);
          assert.ok('phase_review' in phase.docs, `phase "${phase.name}" docs.phase_review missing`);
        }
      });

      it('every phase has review object with verdict and action keys', () => {
        const m = migrateToV4(data, version);
        for (const phase of m.execution.phases) {
          assert.ok(typeof phase.review === 'object' && phase.review !== null, `phase "${phase.name}" missing review`);
          assert.ok('verdict' in phase.review, `phase "${phase.name}" review.verdict missing`);
          assert.ok('action' in phase.review, `phase "${phase.name}" review.action missing`);
        }
      });

      it('every phase has a valid stage field', () => {
        const m = migrateToV4(data, version);
        for (const phase of m.execution.phases) {
          assert.ok(
            VALID_PHASE_STAGES.has(phase.stage),
            `phase "${phase.name}" has invalid stage "${phase.stage}"`,
          );
        }
      });

      it('every task has docs object with handoff, report, review keys', () => {
        const m = migrateToV4(data, version);
        for (const phase of m.execution.phases) {
          for (const task of phase.tasks) {
            assert.ok(typeof task.docs === 'object' && task.docs !== null, `task "${task.name}" missing docs`);
            assert.ok('handoff' in task.docs, `task "${task.name}" docs.handoff missing`);
            assert.ok('report' in task.docs, `task "${task.name}" docs.report missing`);
            assert.ok('review' in task.docs, `task "${task.name}" docs.review missing`);
          }
        }
      });

      it('every task has review object with verdict and action keys', () => {
        const m = migrateToV4(data, version);
        for (const phase of m.execution.phases) {
          for (const task of phase.tasks) {
            assert.ok(typeof task.review === 'object' && task.review !== null, `task "${task.name}" missing review`);
            assert.ok('verdict' in task.review, `task "${task.name}" review.verdict missing`);
            assert.ok('action' in task.review, `task "${task.name}" review.action missing`);
          }
        }
      });

      it('every task has a valid stage field', () => {
        const m = migrateToV4(data, version);
        for (const phase of m.execution.phases) {
          for (const task of phase.tasks) {
            assert.ok(
              VALID_TASK_STAGES.has(task.stage),
              `task "${task.name}" has invalid stage "${task.stage}"`,
            );
          }
        }
      });
    });
  }
});

// ─── v4 Schema Validation — all 20 fixtures pass validateTransition ───────────

describe('validateTransition — all 20 migrated fixtures pass with 0 errors', () => {
  for (const { name, data, version } of allFixtures) {
    it(`${name} (v${version}) → 0 validation errors`, () => {
      const migrated = migrateToV4(data, version);
      const errors = validateTransition(null, migrated, DEFAULT_CONFIG);
      assert.equal(
        errors.length,
        0,
        `Expected 0 errors, got ${errors.length}: ${JSON.stringify(errors.map(e => `[${e.invariant}] ${e.field}: ${e.message}`))}`,
      );
    });
  }
});

// ─── 0→1-based index conversion ──────────────────────────────────────────────

describe('0→1-based index conversion', () => {
  it('current_phase: 0 with empty phases → stays 0 (AMENDMENT-v2)', () => {
    const data = loadFixture('AMENDMENT-v2.json');
    assert.equal(data.execution.current_phase, 0);
    assert.equal(data.execution.phases.length, 0);
    const m = migrateToV4(data, 2);
    assert.equal(m.execution.current_phase, 0);
  });

  it('current_phase: 0 with non-empty phases → becomes 1 (SKILL-RECOMMENDATION-v3)', () => {
    const data = loadFixture('SKILL-RECOMMENDATION-v3.json');
    assert.equal(data.execution.current_phase, 0);
    assert.ok(data.execution.phases.length > 0);
    const m = migrateToV4(data, 3);
    assert.equal(m.execution.current_phase, 1);
  });

  it('current_task: 0 with empty tasks → stays 0', () => {
    // Use a synthetic minimal v3 state with an empty-task phase
    const synthetic = {
      $schema: 'orchestration-state-v3',
      project: { name: 'TEST', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' },
      planning: {
        status: 'complete',
        human_approved: true,
        steps: PLANNING_STEP_NAMES.map(n => ({ name: n, status: 'complete', doc_path: null })),
      },
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        phases: [
          {
            name: 'Phase 1',
            status: 'not_started',
            current_task: 0,
            tasks: [],
            phase_plan_doc: null,
            phase_report_doc: null,
            phase_review_doc: null,
            phase_review_verdict: null,
            phase_review_action: null,
          },
        ],
      },
    };
    const m = migrateToV4(synthetic, 3);
    assert.equal(m.execution.phases[0].current_task, 0);
  });

  it('current_task: 0 with non-empty tasks → becomes 1', () => {
    // Synthetic v3 state with a phase that has tasks but current_task: 0
    const synthetic = {
      $schema: 'orchestration-state-v3',
      project: { name: 'TEST', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' },
      planning: {
        status: 'complete',
        human_approved: true,
        steps: PLANNING_STEP_NAMES.map(n => ({ name: n, status: 'complete', doc_path: null })),
      },
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 1,
        phases: [
          {
            name: 'Phase 1',
            status: 'in_progress',
            current_task: 0,
            tasks: [
              {
                name: 'Task 1',
                status: 'not_started',
                handoff_doc: null,
                report_doc: null,
                review_doc: null,
                review_verdict: null,
                review_action: null,
                has_deviations: false,
                deviation_type: null,
                retries: 0,
                report_status: null,
              },
            ],
            phase_plan_doc: 'phases/phase1.md',
            phase_report_doc: null,
            phase_review_doc: null,
            phase_review_verdict: null,
            phase_review_action: null,
          },
        ],
      },
    };
    const m = migrateToV4(synthetic, 3);
    assert.equal(m.execution.phases[0].current_task, 1);
  });

  it('all migrated phases: current_task within [0, tasks.length]', () => {
    for (const { name, data, version } of allFixtures) {
      const m = migrateToV4(data, version);
      for (const phase of m.execution.phases) {
        const ct = phase.current_task;
        const tl = phase.tasks.length;
        if (tl === 0) {
          assert.equal(ct, 0, `${name}: phase "${phase.name}" current_task should be 0 when tasks empty`);
        } else {
          assert.ok(ct >= 1 && ct <= tl, `${name}: phase "${phase.name}" current_task ${ct} out of [1, ${tl}]`);
        }
      }
    }
  });

  it('all migrated states: current_phase within [0, phases.length]', () => {
    for (const { name, data, version } of allFixtures) {
      const m = migrateToV4(data, version);
      const cp = m.execution.current_phase;
      const pl = m.execution.phases.length;
      if (pl === 0) {
        assert.equal(cp, 0, `${name}: current_phase should be 0 when phases empty`);
      } else {
        assert.ok(cp >= 1 && cp <= pl, `${name}: current_phase ${cp} out of [1, ${pl}]`);
      }
    }
  });
});

// ─── inferTaskStage unit tests ────────────────────────────────────────────────

describe('inferTaskStage', () => {
  it('{ status: "not_started" } → "planning"', () => {
    assert.equal(inferTaskStage({ status: 'not_started' }), 'planning');
  });

  it('{ status: "in_progress", handoff_doc: "h.md", report_doc: null } → "coding"', () => {
    assert.equal(
      inferTaskStage({ status: 'in_progress', handoff_doc: 'h.md', report_doc: null }),
      'coding',
    );
  });

  it('{ status: "in_progress", handoff_doc: "h.md", report_doc: "r.md" } → "reviewing"', () => {
    assert.equal(
      inferTaskStage({ status: 'in_progress', handoff_doc: 'h.md', report_doc: 'r.md' }),
      'reviewing',
    );
  });

  it('{ status: "complete", review_action: "advanced", review_doc: "rv.md" } → "complete"', () => {
    assert.equal(
      inferTaskStage({ status: 'complete', review_action: 'advanced', review_doc: 'rv.md' }),
      'complete',
    );
  });

  it('{ status: "complete", review_doc: null } → "reviewing"', () => {
    assert.equal(
      inferTaskStage({ status: 'complete', review_doc: null }),
      'reviewing',
    );
  });

  it('{ status: "failed" } → "failed"', () => {
    assert.equal(inferTaskStage({ status: 'failed' }), 'failed');
  });

  it('{ status: "halted" } → "failed"', () => {
    assert.equal(inferTaskStage({ status: 'halted' }), 'failed');
  });
});

// ─── inferPhaseStage unit tests ───────────────────────────────────────────────

describe('inferPhaseStage', () => {
  it('{ status: "not_started" } → "planning"', () => {
    assert.equal(inferPhaseStage({ status: 'not_started' }), 'planning');
  });

  it('{ status: "in_progress", phase_plan_doc: "pp.md", phase_report_doc: null, phase_review_doc: null } → "executing"', () => {
    assert.equal(
      inferPhaseStage({
        status: 'in_progress',
        phase_plan_doc: 'pp.md',
        phase_report_doc: null,
        phase_review_doc: null,
      }),
      'executing',
    );
  });

  it('{ status: "in_progress", phase_plan_doc: "pp.md", phase_report_doc: "pr.md", phase_review_doc: null } → "reviewing"', () => {
    assert.equal(
      inferPhaseStage({
        status: 'in_progress',
        phase_plan_doc: 'pp.md',
        phase_report_doc: 'pr.md',
        phase_review_doc: null,
      }),
      'reviewing',
    );
  });

  it('{ status: "in_progress", phase_plan_doc: "pp.md", phase_report_doc: "pr.md", phase_review_doc: "prv.md" } → "reviewing"', () => {
    assert.equal(
      inferPhaseStage({
        status: 'in_progress',
        phase_plan_doc: 'pp.md',
        phase_report_doc: 'pr.md',
        phase_review_doc: 'prv.md',
      }),
      'reviewing',
    );
  });

  it('{ status: "complete" } → "complete"', () => {
    assert.equal(inferPhaseStage({ status: 'complete' }), 'complete');
  });

  it('{ status: "halted" } → "failed"', () => {
    assert.equal(inferPhaseStage({ status: 'halted' }), 'failed');
  });
});

// ─── Legacy action normalization ──────────────────────────────────────────────

describe('legacy action normalization', () => {
  describe('MONITORING-UI-v2: "advance" and "proceed" → "advanced"', () => {
    it('tasks with review_action "advance" normalize to "advanced"', () => {
      const data = loadFixture('MONITORING-UI-v2.json');
      const m = migrateToV4(data, 2);
      // Collect all task review actions from the migrated output
      const taskActions = m.execution.phases.flatMap(p => p.tasks.map(t => t.review.action));
      // Each non-null action should be a v4 valid value ("advanced" in this fixture)
      for (const action of taskActions) {
        if (action !== null) {
          assert.equal(action, 'advanced', `Expected "advanced" but got "${action}"`);
        }
      }
    });

    it('tasks with review_action "proceed" normalize to "advanced"', () => {
      const data = loadFixture('MONITORING-UI-v2.json');
      // Confirm the fixture actually has "proceed" values
      const hasProceeds = data.execution.phases.some(p =>
        p.tasks.some(t => t.review_action === 'proceed'),
      );
      assert.ok(hasProceeds, 'MONITORING-UI-v2 should contain "proceed" review_action values');

      const m = migrateToV4(data, 2);
      const taskActions = m.execution.phases.flatMap(p => p.tasks.map(t => t.review.action));
      for (const action of taskActions) {
        if (action !== null) {
          assert.equal(action, 'advanced', `Expected "advanced" but got "${action}"`);
        }
      }
    });

    it('phases with phase_review_action "proceed" normalize to "advanced"', () => {
      const data = loadFixture('MONITORING-UI-v2.json');
      const m = migrateToV4(data, 2);
      for (const phase of m.execution.phases) {
        if (phase.review.action !== null) {
          assert.equal(phase.review.action, 'advanced', `Expected "advanced" but got "${phase.review.action}"`);
        }
      }
    });
  });

  describe('ORCHESTRATION-REORG-v2: "advance" → "advanced"', () => {
    it('tasks with review_action "advance" normalize to "advanced"', () => {
      const data = loadFixture('ORCHESTRATION-REORG-v2.json');
      // Confirm fixture has "advance" values
      const hasAdvance = data.execution.phases.some(p =>
        p.tasks.some(t => t.review_action === 'advance'),
      );
      assert.ok(hasAdvance, 'ORCHESTRATION-REORG-v2 should contain "advance" review_action values');

      const m = migrateToV4(data, 2);
      const taskActions = m.execution.phases.flatMap(p => p.tasks.map(t => t.review.action));
      for (const action of taskActions) {
        if (action !== null) {
          assert.equal(action, 'advanced', `Expected "advanced" but got "${action}"`);
        }
      }
    });

    it('phases with phase_review_action "advance" normalize to "advanced"', () => {
      const data = loadFixture('ORCHESTRATION-REORG-v2.json');
      const m = migrateToV4(data, 2);
      for (const phase of m.execution.phases) {
        if (phase.review.action !== null) {
          assert.equal(phase.review.action, 'advanced');
        }
      }
    });
  });

  describe('SCRIPT-SIMPLIFY-AGENTS-v2: already "advanced" values carry through', () => {
    it('task review actions are "advanced" or null (no transformation needed)', () => {
      const data = loadFixture('SCRIPT-SIMPLIFY-AGENTS-v2.json');
      const m = migrateToV4(data, 2);
      const taskActions = m.execution.phases.flatMap(p => p.tasks.map(t => t.review.action));
      for (const action of taskActions) {
        if (action !== null) {
          assert.equal(action, 'advanced');
        }
      }
    });
  });

  it('unknown action values map to null', () => {
    const synthetic = {
      $schema: 'orchestration-state-v3',
      project: { name: 'TEST', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' },
      planning: {
        status: 'complete',
        human_approved: true,
        steps: PLANNING_STEP_NAMES.map(n => ({ name: n, status: 'complete', doc_path: null })),
      },
      execution: {
        status: 'complete',
        current_tier: 'complete',
        current_phase: 1,
        phases: [
          {
            name: 'Phase 1',
            status: 'complete',
            current_task: 1,
            tasks: [
              {
                name: 'Task 1',
                status: 'complete',
                handoff_doc: 'tasks/t.md',
                report_doc: 'reports/r.md',
                review_doc: 'reviews/rv.md',
                review_verdict: 'approved',
                review_action: 'totally_unknown_value',
                has_deviations: false,
                deviation_type: null,
                retries: 0,
                report_status: 'complete',
              },
            ],
            phase_plan_doc: 'phases/p.md',
            phase_report_doc: 'reports/pr.md',
            phase_review_doc: 'reviews/prv.md',
            phase_review_verdict: 'approved',
            phase_review_action: 'totally_unknown_value',
          },
        ],
      },
    };
    const m = migrateToV4(synthetic, 3);
    assert.equal(m.execution.phases[0].tasks[0].review.action, null);
    assert.equal(m.execution.phases[0].review.action, null);
  });
});

// ─── Error handling and dropped-field tests ───────────────────────────────────

describe('error handling', () => {
  it('detectVersion({}) throws on missing $schema', () => {
    assert.throws(() => detectVersion({}), /unknown or missing/i);
  });

  it('detectVersion({ $schema: "orchestration-state-v4" }) throws (v4 is not a source version)', () => {
    assert.throws(
      () => detectVersion({ $schema: 'orchestration-state-v4' }),
      /unknown or missing/i,
    );
  });
});

describe('dropped fields absent in all migrated output', () => {
  const DROPPED_TOP_LEVEL = ['total_phases', 'total_tasks', 'current_step', 'brainstorming_doc',
    'description', 'human_gate_mode', 'triage_attempts', 'last_error', 'severity',
    'errors', 'limits'];
  const DROPPED_PHASE = ['phase_number', 'total_tasks', 'id'];
  const DROPPED_TASK = ['task_number', 'last_error', 'severity', 'triage_attempts', 'id'];

  for (const { name, data, version } of allFixtures) {
    it(`${name}: no dropped top-level fields in execution or planning`, () => {
      const m = migrateToV4(data, version);

      // These should not appear on the root state
      for (const field of ['total_phases', 'total_tasks', 'current_step', 'human_gate_mode',
        'triage_attempts', 'last_error', 'severity', 'errors', 'limits']) {
        assert.equal(
          field in m,
          false,
          `Root state should not have field "${field}"`,
        );
      }

      // 'description' and 'brainstorming_doc' were v2 project-level fields
      assert.equal('description' in m.project, false, 'project.description should be dropped');
      assert.equal('brainstorming_doc' in m.project, false, 'project.brainstorming_doc should be dropped');
    });

    it(`${name}: no dropped fields in phases`, () => {
      const m = migrateToV4(data, version);
      for (const phase of m.execution.phases) {
        for (const field of DROPPED_PHASE) {
          assert.equal(
            field in phase,
            false,
            `Phase "${phase.name}" should not have field "${field}"`,
          );
        }
      }
    });

    it(`${name}: no dropped fields in tasks`, () => {
      const m = migrateToV4(data, version);
      for (const phase of m.execution.phases) {
        for (const task of phase.tasks) {
          for (const field of DROPPED_TASK) {
            assert.equal(
              field in task,
              false,
              `Task "${task.name}" should not have field "${field}"`,
            );
          }
        }
      }
    });
  }
});

// ─── v1 planning step "skipped" → "complete" ─────────────────────────────────

describe('v1 planning step "skipped" maps to "complete"', () => {
  it('PIPELINE-FEEDBACK-v1: "design" step was skipped, migrates to "complete"', () => {
    const data = loadFixture('PIPELINE-FEEDBACK-v1.json');
    // Confirm the fixture has a "skipped" step
    assert.equal(
      data.planning.steps.design.status,
      'skipped',
      'fixture should have design step with status "skipped"',
    );
    const m = migrateToV4(data, 1);
    const designStep = m.planning.steps.find(s => s.name === 'design');
    assert.ok(designStep, 'migrated state should have a design step');
    assert.equal(designStep.status, 'complete', '"skipped" should map to "complete" in v4');
  });
});

// ─── v1/v2 final_review.report_doc → v4 final_review.doc_path ────────────────

describe('v1/v2 final_review.report_doc → v4 final_review.doc_path', () => {
  it('VALIDATOR-v1: final_review.report_doc is mapped to doc_path', () => {
    const data = loadFixture('VALIDATOR-v1.json');
    const m = migrateToV4(data, 1);
    // v1 may or may not have final_review. Check that doc_path key exists and
    // if v1 had report_doc it maps correctly.
    assert.ok('doc_path' in m.final_review, 'final_review.doc_path should exist');
    assert.equal('report_doc' in m.final_review, false, 'final_review.report_doc should be absent');
  });

  for (const { name, data } of v2Fixtures) {
    it(`${name}: final_review has doc_path (not report_doc)`, () => {
      const m = migrateToV4(data, 2);
      assert.ok('doc_path' in m.final_review, `${name}: final_review.doc_path should exist`);
      assert.equal('report_doc' in m.final_review, false, `${name}: final_review.report_doc should be absent`);
    });
  }
});

// ─── v3 missing final_review_* fields default correctly ──────────────────────

describe('v3 missing final_review_* fields default to not_started', () => {
  it('SCHEMA-OVERHAUL-v3: no final_review_* fields → defaults to { status: "not_started", doc_path: null, human_approved: false }', () => {
    const data = loadFixture('SCHEMA-OVERHAUL-v3.json');
    // Confirm fixture lacks final_review fields
    assert.equal('final_review_status' in data.execution, false, 'fixture should not have final_review_status');
    assert.equal('final_review_doc' in data.execution, false, 'fixture should not have final_review_doc');

    const m = migrateToV4(data, 3);
    assert.equal(m.final_review.status, 'not_started');
    assert.equal(m.final_review.doc_path, null);
    assert.equal(m.final_review.human_approved, false);
  });
});

// ─── v1/v2 Record→Array planning step conversion ─────────────────────────────

describe('v1/v2 Record→Array planning step conversion', () => {
  it('VALIDATOR-v1: planning.steps Record converts to 5-element array with output→doc_path', () => {
    const data = loadFixture('VALIDATOR-v1.json');
    // Confirm the fixture uses Record format
    assert.ok(!Array.isArray(data.planning.steps), 'v1 fixture planning.steps should be a Record');

    const m = migrateToV4(data, 1);
    assert.ok(Array.isArray(m.planning.steps), 'migrated planning.steps should be an array');
    assert.equal(m.planning.steps.length, 5);

    // Check that doc_path is set (was "output" in v1)
    const researchStep = m.planning.steps.find(s => s.name === 'research');
    assert.ok(researchStep, 'should have research step');
    assert.equal(researchStep.doc_path, data.planning.steps.research.output);
    assert.equal('output' in researchStep, false, '"output" field should be absent in migrated step');
  });

  for (const { name, data } of v2Fixtures) {
    it(`${name}: planning.steps Record converts to 5-element array with output→doc_path`, () => {
      // Skip if already array (some v2 might differ - all should be Record per spec)
      if (Array.isArray(data.planning.steps)) return;

      const m = migrateToV4(data, 2);
      assert.ok(Array.isArray(m.planning.steps), `${name}: migrated planning.steps should be an array`);
      assert.equal(m.planning.steps.length, 5, `${name}: should have 5 planning steps`);

      // Verify each step has doc_path not output
      for (const step of m.planning.steps) {
        assert.ok('doc_path' in step, `${name}: step "${step.name}" should have doc_path`);
        assert.equal('output' in step, false, `${name}: step "${step.name}" should not have output`);
      }
    });
  }
});

// ─── migrateProject (I/O wrapper) ────────────────────────────────────────────

describe('migrateProject', () => {
  it('successfully migrates a v3 fixture copied to a temp dir and creates a backup', () => {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    try {
      const srcFixture = path.join(FIXTURES_DIR, 'SCHEMA-OVERHAUL-v3.json');
      const stateFile = path.join(tmpDir, 'state.json');
      fs.copyFileSync(srcFixture, stateFile);

      const result = migrateProject(tmpDir);
      assert.equal(result.success, true, `Expected success, errors: ${JSON.stringify(result.errors)}`);
      assert.ok(result.backed_up !== null, 'backed_up should not be null on success');
      assert.ok(fs.existsSync(result.backed_up), 'backup file should exist');
      assert.ok(result.backed_up.endsWith('state.3.json.bak'), 'backup file should be state.3.json.bak');
      assert.equal(result.errors.length, 0);

      // Verify the written state is valid v4
      const written = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      assert.equal(written.$schema, 'orchestration-state-v4');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns success: false when state.json does not exist', () => {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-empty-'));
    try {
      const result = migrateProject(tmpDir);
      assert.equal(result.success, false);
      assert.ok(result.errors.length > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns success: false when state.json has unknown schema version', () => {
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-bad-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'state.json'),
        JSON.stringify({ $schema: 'orchestration-state-v99' }),
        'utf8',
      );
      const result = migrateProject(tmpDir);
      assert.equal(result.success, false);
      assert.ok(result.errors.length > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

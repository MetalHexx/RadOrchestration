import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../lib/condition-evaluator.js';
import type { OrchestrationConfig, PipelineState } from '../lib/types.js';

const baseConfig: OrchestrationConfig = {
  system: { orch_root: '/orch' },
  projects: { base_path: '/projects', naming: '{name}' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 20,
    max_retries_per_task: 3,
    max_consecutive_review_rejections: 3,
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'sequential',
    after_final_review: true,
  },
  source_control: {
    auto_commit: 'ask',
    auto_pr: 'never',
    provider: 'github',
  },
};

const baseState: PipelineState = {
  $schema: 'orchestration-state-v5',
  project: {
    name: 'TEST-PROJECT',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
  },
  config: {
    gate_mode: 'auto',
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 20,
      max_retries_per_task: 3,
      max_consecutive_review_rejections: 3,
    },
    source_control: {
      auto_commit: 'ask',
      auto_pr: 'never',
    },
  },
  pipeline: {
    gate_mode: null,
    source_control: null,
    current_tier: 'planning',
    halt_reason: null,
  },
  graph: {
    template_id: 'full',
    status: 'not_started',
    current_node_path: null,
    nodes: {},
  },
};

describe('evaluateCondition', () => {
  describe('eq operator', () => {
    it('returns true when resolved value strictly equals value', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'eq', value: 'ask' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('returns false when resolved value does not equal value', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'eq', value: 'never' },
          baseConfig,
          baseState
        )
      ).toBe(false);
    });

    it('uses strict equality — number 10 does not equal string "10"', () => {
      expect(
        evaluateCondition(
          { config_ref: 'limits.max_phases', operator: 'eq', value: '10' },
          baseConfig,
          baseState
        )
      ).toBe(false);
    });
  });

  describe('neq operator', () => {
    it('returns true when resolved value does not equal value', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'neq', value: 'never' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('returns false when resolved value equals value', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'neq', value: 'ask' },
          baseConfig,
          baseState
        )
      ).toBe(false);
    });

    it('uses strict inequality — number 10 is neq string "10"', () => {
      expect(
        evaluateCondition(
          { config_ref: 'limits.max_phases', operator: 'neq', value: '10' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });
  });

  describe('in operator', () => {
    it('returns true when resolved value is in the array', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'in', value: ['ask', 'never', 'always'] },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('returns false when resolved value is not in the array', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'in', value: ['never', 'always'] },
          baseConfig,
          baseState
        )
      ).toBe(false);
    });

    it('throws when value is not an array', () => {
      expect(() =>
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'in', value: 'ask' },
          baseConfig,
          baseState
        )
      ).toThrow("'in' requires value to be an array");
    });
  });

  describe('not_in operator', () => {
    it('returns true when resolved value is not in the array', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'not_in', value: ['never', 'always'] },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('returns false when resolved value is in the array', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'not_in', value: ['ask', 'never'] },
          baseConfig,
          baseState
        )
      ).toBe(false);
    });

    it('throws when value is not an array', () => {
      expect(() =>
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'not_in', value: 42 },
          baseConfig,
          baseState
        )
      ).toThrow("'not_in' requires value to be an array");
    });
  });

  describe('truthy operator', () => {
    it('returns true for a non-empty string', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'truthy' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('returns true for a non-zero number', () => {
      expect(
        evaluateCondition(
          { config_ref: 'limits.max_phases', operator: 'truthy' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('returns true for true boolean', () => {
      expect(
        evaluateCondition(
          { config_ref: 'human_gates.after_planning', operator: 'truthy' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('returns false for empty string', () => {
      const cfg: OrchestrationConfig = {
        ...baseConfig,
        source_control: { ...baseConfig.source_control, auto_commit: '' },
      };
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'truthy' },
          cfg,
          baseState
        )
      ).toBe(false);
    });

    it('returns false for 0', () => {
      const st: PipelineState = {
        ...baseState,
        config: {
          ...baseState.config,
          limits: { ...baseState.config.limits, max_phases: 0 },
        },
      };
      expect(
        evaluateCondition(
          { state_ref: 'config.limits.max_phases', operator: 'truthy' },
          baseConfig,
          st
        )
      ).toBe(false);
    });

    it('returns false for false boolean', () => {
      const cfg: OrchestrationConfig = {
        ...baseConfig,
        human_gates: { ...baseConfig.human_gates, after_planning: false },
      };
      expect(
        evaluateCondition(
          { config_ref: 'human_gates.after_planning', operator: 'truthy' },
          cfg,
          baseState
        )
      ).toBe(false);
    });

    it('returns false for null', () => {
      const cfg: OrchestrationConfig = {
        ...baseConfig,
        source_control: {
          ...baseConfig.source_control,
          auto_commit: null as unknown as string,
        },
      };
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'truthy' },
          cfg,
          baseState
        )
      ).toBe(false);
    });
  });

  describe('falsy operator', () => {
    it('returns true for empty string (falsy)', () => {
      const cfg: OrchestrationConfig = {
        ...baseConfig,
        source_control: { ...baseConfig.source_control, auto_commit: '' },
      };
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'falsy' },
          cfg,
          baseState
        )
      ).toBe(true);
    });

    it('returns true for 0 (falsy)', () => {
      const st: PipelineState = {
        ...baseState,
        config: {
          ...baseState.config,
          limits: { ...baseState.config.limits, max_phases: 0 },
        },
      };
      expect(
        evaluateCondition(
          { state_ref: 'config.limits.max_phases', operator: 'falsy' },
          baseConfig,
          st
        )
      ).toBe(true);
    });

    it('returns true for false boolean (falsy)', () => {
      const cfg: OrchestrationConfig = {
        ...baseConfig,
        human_gates: { ...baseConfig.human_gates, after_planning: false },
      };
      expect(
        evaluateCondition(
          { config_ref: 'human_gates.after_planning', operator: 'falsy' },
          cfg,
          baseState
        )
      ).toBe(true);
    });

    it('returns false for truthy non-empty string', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'falsy' },
          baseConfig,
          baseState
        )
      ).toBe(false);
    });

    it('returns false for truthy boolean', () => {
      expect(
        evaluateCondition(
          { config_ref: 'human_gates.after_planning', operator: 'falsy' },
          baseConfig,
          baseState
        )
      ).toBe(false);
    });
  });

  describe('config_ref dot-path resolution', () => {
    it('resolves source_control.auto_commit', () => {
      expect(
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'eq', value: 'ask' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('resolves limits.max_phases (number value)', () => {
      expect(
        evaluateCondition(
          { config_ref: 'limits.max_phases', operator: 'eq', value: 10 },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('resolves human_gates.execution_mode', () => {
      expect(
        evaluateCondition(
          { config_ref: 'human_gates.execution_mode', operator: 'eq', value: 'sequential' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });
  });

  describe('state_ref dot-path resolution', () => {
    it('resolves project.name', () => {
      expect(
        evaluateCondition(
          { state_ref: 'project.name', operator: 'eq', value: 'TEST-PROJECT' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('resolves config.limits.max_phases (3-level deep path)', () => {
      expect(
        evaluateCondition(
          { state_ref: 'config.limits.max_phases', operator: 'eq', value: 10 },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });

    it('resolves config.source_control.auto_commit', () => {
      expect(
        evaluateCondition(
          { state_ref: 'config.source_control.auto_commit', operator: 'eq', value: 'ask' },
          baseConfig,
          baseState
        )
      ).toBe(true);
    });
  });

  describe('error cases', () => {
    it('throws when both config_ref and state_ref are present', () => {
      expect(() =>
        evaluateCondition(
          {
            config_ref: 'source_control.auto_commit',
            state_ref: 'project.name',
            operator: 'eq',
            value: 'ask',
          },
          baseConfig,
          baseState
        )
      ).toThrow('both');
    });

    it('throws when neither config_ref nor state_ref is present', () => {
      expect(() =>
        evaluateCondition(
          { operator: 'eq', value: 'ask' },
          baseConfig,
          baseState
        )
      ).toThrow('neither');
    });

    it('throws on unknown operator', () => {
      expect(() =>
        evaluateCondition(
          { config_ref: 'source_control.auto_commit', operator: 'unknown_op' as 'eq' },
          baseConfig,
          baseState
        )
      ).toThrow('Unknown operator');
    });

    it('throws when dot-path has an unresolvable intermediate segment', () => {
      expect(() =>
        evaluateCondition(
          { config_ref: 'source_control.missing.deep', operator: 'eq', value: 'x' },
          baseConfig,
          baseState
        )
      ).toThrow('Cannot resolve path');
    });

    it('throws with message including the full path', () => {
      expect(() =>
        evaluateCondition(
          { config_ref: 'nonexistent.deep.path', operator: 'eq', value: 'x' },
          baseConfig,
          baseState
        )
      ).toThrow("Cannot resolve path 'nonexistent.deep.path'");
    });

    it('throws when intermediate state path segment is undefined', () => {
      expect(() =>
        evaluateCondition(
          { state_ref: 'project.missing.value', operator: 'eq', value: 'x' },
          baseConfig,
          baseState
        )
      ).toThrow('Cannot resolve path');
    });

    it('error message blames the segment that resolved to undefined, not the next segment', () => {
      expect(() =>
        evaluateCondition(
          { config_ref: 'source_control.missing.deep', operator: 'eq', value: 'x' },
          baseConfig,
          baseState
        )
      ).toThrow("segment 'missing'");
    });
  });
});

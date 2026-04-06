'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'schemas', 'state-v5.schema.json');
const V4_SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'schemas', 'state-v4.schema.json');

function loadSchema() {
  const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
  return JSON.parse(raw);
}

function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schema = loadSchema();
  return ajv.compile(schema);
}

/** Minimal valid v5 state object with all required sections. */
function makeValidState(overrides = {}) {
  return {
    $schema: 'orchestration-state-v5',
    project: {
      name: 'TEST-PROJECT',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:01.000Z',
    },
    pipeline: { current_tier: 'planning' },
    planning: {
      status: 'not_started',
      human_approved: false,
      steps: [],
    },
    execution: {
      status: 'not_started',
      current_phase: 0,
      phases: [],
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
    config: {
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 10,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
    },
    dag: {
      template_name: 'full',
      nodes: {},
      execution_order: [],
    },
    ...overrides,
  };
}

/** Minimal valid DagNode with only required fields. */
function makeMinimalNode(overrides = {}) {
  return {
    id: 'research',
    type: 'step',
    status: 'not_started',
    depends_on: [],
    template_node_id: 'research',
    ...overrides,
  };
}

/** DagNode with all optional fields present. */
function makeFullNode() {
  return {
    id: 'P01.T02.code',
    type: 'step',
    status: 'in_progress',
    depends_on: ['P01.T02.handoff'],
    template_node_id: 'task_code',
    action: 'spawn_coder',
    events: {
      started: 'task_coding_started',
      completed: 'task_coding_completed',
    },
    context: { some_key: 'some_value' },
    gate_type: 'planning',
    planning_step: 'research',
    phase_number: 1,
    task_number: 2,
    phase_name: 'Core Implementation',
    task_name: 'Create schema',
    retries: 1,
    docs: { handoff: 'tasks/handoff.md' },
    review: {
      verdict: 'approved',
      action: 'advanced',
    },
  };
}

describe('state-v5.schema.json', () => {
  it('is valid JSON (parseable by JSON.parse)', () => {
    const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  it('$schema const value is "orchestration-state-v5"', () => {
    const schema = loadSchema();
    assert.equal(schema.properties.$schema.const, 'orchestration-state-v5');
  });

  describe('validates well-formed v5 state', () => {
    it('accepts a complete v5 state with dag section', () => {
      const validate = createValidator();
      const state = makeValidState({
        dag: {
          template_name: 'full',
          nodes: {
            research: makeMinimalNode(),
          },
          execution_order: ['research'],
        },
      });
      const valid = validate(state);
      assert.equal(valid, true, `Validation errors: ${JSON.stringify(validate.errors)}`);
    });
  });

  describe('rejects missing dag section', () => {
    it('rejects state object without dag', () => {
      const validate = createValidator();
      const state = makeValidState();
      delete state.dag;
      const valid = validate(state);
      assert.equal(valid, false);
      const dagError = validate.errors.some(
        (e) => e.params?.missingProperty === 'dag' || e.message?.includes('dag')
      );
      assert.ok(dagError, 'Expected a validation error about missing dag');
    });
  });

  describe('rejects invalid dag.nodes type value', () => {
    it('rejects a node with type "unknown"', () => {
      const validate = createValidator();
      const state = makeValidState({
        dag: {
          template_name: 'full',
          nodes: {
            bad_node: makeMinimalNode({ type: 'unknown' }),
          },
          execution_order: ['bad_node'],
        },
      });
      const valid = validate(state);
      assert.equal(valid, false);
    });
  });

  describe('rejects invalid dag.nodes status value', () => {
    it('rejects a node with status "running"', () => {
      const validate = createValidator();
      const state = makeValidState({
        dag: {
          template_name: 'full',
          nodes: {
            bad_node: makeMinimalNode({ status: 'running' }),
          },
          execution_order: ['bad_node'],
        },
      });
      const valid = validate(state);
      assert.equal(valid, false);
    });
  });

  describe('DagNode required vs optional fields', () => {
    it('accepts a node with only required fields', () => {
      const validate = createValidator();
      const state = makeValidState({
        dag: {
          template_name: 'full',
          nodes: {
            minimal: makeMinimalNode(),
          },
          execution_order: ['minimal'],
        },
      });
      const valid = validate(state);
      assert.equal(valid, true, `Validation errors: ${JSON.stringify(validate.errors)}`);
    });

    it('accepts a node with all optional fields present', () => {
      const validate = createValidator();
      const state = makeValidState({
        dag: {
          template_name: 'full',
          nodes: {
            full_node: makeFullNode(),
          },
          execution_order: ['full_node'],
        },
      });
      const valid = validate(state);
      assert.equal(valid, true, `Validation errors: ${JSON.stringify(validate.errors)}`);
    });
  });

  describe('v4 sections preserved', () => {
    it('all v4 sections are present and structurally identical (except pipeline.template)', () => {
      const v5 = loadSchema();
      const v4Raw = fs.readFileSync(V4_SCHEMA_PATH, 'utf8');
      const v4 = JSON.parse(v4Raw);

      const v4Sections = ['project', 'planning', 'execution', 'final_review', 'config'];
      for (const section of v4Sections) {
        assert.deepStrictEqual(
          v5.properties[section],
          v4.properties[section],
          `Section "${section}" differs from v4`
        );
      }

      // pipeline should match v4 except for the added template field
      const v5Pipeline = { ...v5.properties.pipeline };
      const v5PipelineProps = { ...v5Pipeline.properties };
      delete v5PipelineProps.template;
      const v5PipelineCopy = { ...v5Pipeline, properties: v5PipelineProps };

      assert.deepStrictEqual(
        v5PipelineCopy,
        v4.properties.pipeline,
        'pipeline section differs from v4 (beyond the template addition)'
      );
    });
  });

  describe('pipeline.template field', () => {
    it('accepts state with pipeline.template present', () => {
      const validate = createValidator();
      const state = makeValidState();
      state.pipeline.template = 'full';
      const valid = validate(state);
      assert.equal(valid, true, `Validation errors: ${JSON.stringify(validate.errors)}`);
    });

    it('accepts state without pipeline.template (optional)', () => {
      const validate = createValidator();
      const state = makeValidState();
      // pipeline.template is not set
      const valid = validate(state);
      assert.equal(valid, true, `Validation errors: ${JSON.stringify(validate.errors)}`);
    });
  });

  describe('root required array includes dag', () => {
    it('dag is in root required array', () => {
      const schema = loadSchema();
      assert.ok(schema.required.includes('dag'), 'dag missing from root required array');
    });
  });

  describe('dag section structure', () => {
    it('dag has three required properties', () => {
      const schema = loadSchema();
      const dagSchema = schema.properties.dag;
      assert.deepStrictEqual(
        dagSchema.required.sort(),
        ['execution_order', 'nodes', 'template_name'],
      );
    });

    it('template_name is string type', () => {
      const schema = loadSchema();
      assert.equal(schema.properties.dag.properties.template_name.type, 'string');
    });

    it('nodes is object type', () => {
      const schema = loadSchema();
      assert.equal(schema.properties.dag.properties.nodes.type, 'object');
    });

    it('execution_order is array of strings', () => {
      const schema = loadSchema();
      const eo = schema.properties.dag.properties.execution_order;
      assert.equal(eo.type, 'array');
      assert.deepStrictEqual(eo.items, { type: 'string' });
    });
  });

  describe('DagNode definition', () => {
    it('has correct required fields', () => {
      const schema = loadSchema();
      const dagNode = schema.definitions.DagNode;
      assert.deepStrictEqual(
        dagNode.required.sort(),
        ['depends_on', 'id', 'status', 'template_node_id', 'type'],
      );
    });

    it('type enum matches DAG_NODE_TYPES exactly', () => {
      const schema = loadSchema();
      const typeEnum = schema.definitions.DagNode.properties.type.enum;
      assert.deepStrictEqual(
        typeEnum.sort(),
        ['conditional', 'for_each_phase', 'for_each_task', 'gate', 'parallel', 'step'],
      );
    });

    it('status enum matches DAG_NODE_STATUSES exactly', () => {
      const schema = loadSchema();
      const statusEnum = schema.definitions.DagNode.properties.status.enum;
      assert.deepStrictEqual(
        statusEnum.sort(),
        ['complete', 'failed', 'halted', 'in_progress', 'not_started', 'skipped'],
      );
    });

    it('has all optional fields in schema but not in required', () => {
      const schema = loadSchema();
      const dagNode = schema.definitions.DagNode;
      const optionalFields = [
        'action', 'events', 'context', 'gate_type', 'planning_step',
        'phase_number', 'task_number', 'phase_name', 'task_name',
        'retries', 'docs', 'review',
      ];
      for (const field of optionalFields) {
        assert.ok(
          dagNode.properties[field] !== undefined,
          `Optional field "${field}" missing from DagNode properties`
        );
        assert.ok(
          !dagNode.required.includes(field),
          `Optional field "${field}" should NOT be in DagNode required`
        );
      }
    });
  });

  describe('no external $ref references', () => {
    it('schema is fully self-contained (no external file refs)', () => {
      const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
      // Internal refs like #/definitions/DagNode are fine
      // External refs like ./state-v4.schema.json or file:// are not
      const externalRefPattern = /"\$ref"\s*:\s*"(?!#)/g;
      const matches = raw.match(externalRefPattern);
      assert.equal(matches, null, `Found external $ref: ${JSON.stringify(matches)}`);
    });
  });
});

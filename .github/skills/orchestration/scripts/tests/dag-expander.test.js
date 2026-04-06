'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { expandTemplate, computeExecutionOrder, expandPhases, expandTasks, injectCorrectiveTask } = require('../lib/dag-expander.js');
const { loadTemplate } = require('../lib/dag-template-loader.js');

// orchRoot = .github directory
const orchRoot = path.resolve(__dirname, '..', '..', '..', '..');

// Load templates for use in tests
const fullResult = loadTemplate('full', orchRoot);
const quickResult = loadTemplate('quick', orchRoot);
const fullTemplate = fullResult.template;
const quickTemplate = quickResult.template;

// ─── expandTemplate() ──────────────────────────────────────────────────────

describe('expandTemplate()', () => {
  it('returns { nodes, execution_order } for full template', () => {
    const result = expandTemplate(fullTemplate);
    assert.ok(result.nodes, 'result should have nodes');
    assert.ok(result.execution_order, 'result should have execution_order');
    assert.equal(typeof result.nodes, 'object');
    assert.ok(Array.isArray(result.execution_order));
  });

  it('expanded full template nodes has 10 entries', () => {
    const { nodes } = expandTemplate(fullTemplate);
    assert.equal(Object.keys(nodes).length, 10);
  });

  it('expanded quick template nodes has 7 entries', () => {
    const { nodes } = expandTemplate(quickTemplate);
    assert.equal(Object.keys(nodes).length, 7);
  });

  it('every expanded node has id, type, status, depends_on, template_node_id', () => {
    const { nodes } = expandTemplate(fullTemplate);
    for (const [key, node] of Object.entries(nodes)) {
      assert.equal(typeof node.id, 'string', `node ${key} should have string id`);
      assert.equal(typeof node.type, 'string', `node ${key} should have string type`);
      assert.equal(typeof node.status, 'string', `node ${key} should have string status`);
      assert.ok(Array.isArray(node.depends_on), `node ${key} should have array depends_on`);
      assert.equal(typeof node.template_node_id, 'string', `node ${key} should have string template_node_id`);
    }
  });

  it('every expanded node status is not_started', () => {
    const { nodes } = expandTemplate(fullTemplate);
    for (const [key, node] of Object.entries(nodes)) {
      assert.equal(node.status, 'not_started', `node ${key} status should be not_started`);
    }
  });

  it('every expanded node template_node_id equals its id', () => {
    const { nodes } = expandTemplate(fullTemplate);
    for (const [key, node] of Object.entries(nodes)) {
      assert.equal(node.template_node_id, node.id, `node ${key} template_node_id should equal id`);
    }
  });

  it('step nodes preserve action and events fields', () => {
    const { nodes } = expandTemplate(fullTemplate);
    // research is a step node
    const research = nodes['research'];
    assert.ok(research, 'research node should exist');
    assert.equal(research.type, 'step');
    assert.equal(typeof research.action, 'string', 'step node should have action');
    assert.ok(research.events, 'step node should have events');
    assert.equal(typeof research.events.completed, 'string', 'step node should have events.completed');
  });

  it('planning step nodes preserve planning_step field', () => {
    const { nodes } = expandTemplate(fullTemplate);
    const research = nodes['research'];
    assert.equal(research.planning_step, 'research');
  });

  it('gate nodes have gate_type and action fields', () => {
    const { nodes } = expandTemplate(fullTemplate);
    const gate = nodes['request_plan_approval'];
    assert.ok(gate, 'request_plan_approval gate node should exist');
    assert.equal(gate.type, 'gate');
    assert.equal(typeof gate.gate_type, 'string', 'gate node should have gate_type');
    assert.equal(typeof gate.action, 'string', 'gate node should have action');
  });

  it('container nodes (for_each_phase) preserve body array', () => {
    const { nodes } = expandTemplate(fullTemplate);
    const container = nodes['for_each_phase'];
    assert.ok(container, 'for_each_phase container node should exist');
    assert.equal(container.type, 'for_each_phase');
    assert.ok(Array.isArray(container.body), 'container node should have body array');
    assert.ok(container.body.length > 0, 'body should not be empty');
  });
});

// ─── execution_order ────────────────────────────────────────────────────────

describe('execution_order', () => {
  it('contains all node IDs (length matches nodes count)', () => {
    const { nodes, execution_order } = expandTemplate(fullTemplate);
    assert.equal(execution_order.length, Object.keys(nodes).length);
    const nodeIds = new Set(Object.keys(nodes));
    for (const id of execution_order) {
      assert.ok(nodeIds.has(id), `execution_order ID "${id}" should be in nodes`);
    }
  });

  it('respects dependencies (depends_on entries appear before dependent)', () => {
    const { nodes, execution_order } = expandTemplate(fullTemplate);
    const positionMap = new Map();
    execution_order.forEach((id, idx) => positionMap.set(id, idx));

    for (const [id, node] of Object.entries(nodes)) {
      for (const dep of node.depends_on) {
        assert.ok(
          positionMap.get(dep) < positionMap.get(id),
          `dependency "${dep}" should appear before "${id}" in execution_order`
        );
      }
    }
  });
});

// ─── computeExecutionOrder() ────────────────────────────────────────────────

describe('computeExecutionOrder()', () => {
  it('throws Error with "Cycle detected in DAG" on cyclic input', () => {
    const cyclicNodes = {
      a: { id: 'a', type: 'step', status: 'not_started', depends_on: ['b'], template_node_id: 'a' },
      b: { id: 'b', type: 'step', status: 'not_started', depends_on: ['a'], template_node_id: 'b' },
    };
    assert.throws(
      () => computeExecutionOrder(cyclicNodes),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'Cycle detected in DAG');
        return true;
      }
    );
  });
});

// ─── Stub functions ─────────────────────────────────────────────────────────

describe('Stub functions', () => {
  it('expandPhases is exported as a function with length 4', () => {
    assert.equal(typeof expandPhases, 'function');
    assert.equal(expandPhases.length, 4);
  });

  it('expandTasks is exported as a function with length 4', () => {
    assert.equal(typeof expandTasks, 'function');
    assert.equal(expandTasks.length, 4);
  });

  it('injectCorrectiveTask is exported as a function with length 5', () => {
    assert.equal(typeof injectCorrectiveTask, 'function');
    assert.equal(injectCorrectiveTask.length, 5);
  });

  it('expandPhases throws with message containing "not implemented"', () => {
    assert.throws(
      () => expandPhases({}, 'x', 1, []),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes('not implemented'));
        return true;
      }
    );
  });

  it('expandTasks throws with message containing "not implemented"', () => {
    assert.throws(
      () => expandTasks({}, 'x', 1, []),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes('not implemented'));
        return true;
      }
    );
  });

  it('injectCorrectiveTask throws with message containing "not implemented"', () => {
    assert.throws(
      () => injectCorrectiveTask({}, 'x', 1, 1, 1),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes('not implemented'));
        return true;
      }
    );
  });
});

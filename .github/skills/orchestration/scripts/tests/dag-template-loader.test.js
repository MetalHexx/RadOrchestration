'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadTemplate, validateTemplate, applyOverrides } = require('../lib/dag-template-loader.js');

// orchRoot = .github directory
const orchRoot = path.resolve(__dirname, '..', '..', '..', '..');

// ─── loadTemplate() ─────────────────────────────────────────────────────────

describe('loadTemplate()', () => {
  it('loads the full template by name', () => {
    const { template, error } = loadTemplate('full', orchRoot);
    assert.equal(error, null);
    assert.ok(template, 'template should not be null');
    assert.equal(template.name, 'full');
    assert.ok(Array.isArray(template.nodes), 'nodes should be an array');
    assert.ok(template.nodes.length > 0, 'nodes should not be empty');
  });

  it('loads the quick template by name', () => {
    const { template, error } = loadTemplate('quick', orchRoot);
    assert.equal(error, null);
    assert.ok(template, 'template should not be null');
    assert.equal(template.name, 'quick');
    assert.ok(Array.isArray(template.nodes), 'nodes should be an array');
    assert.ok(template.nodes.length > 0, 'nodes should not be empty');
  });

  it('returns error for nonexistent template', () => {
    const { template, error } = loadTemplate('nonexistent', orchRoot);
    assert.equal(template, null);
    assert.equal(typeof error, 'string');
    assert.ok(error.length > 0, 'error should be a non-empty string');
  });

  it('resolves built-in templates before user-custom', () => {
    // The built-in path is {orchRoot}/skills/orchestration/templates/{name}.yml
    const builtinPath = path.join(orchRoot, 'skills', 'orchestration', 'templates', 'full.yml');
    const fs = require('node:fs');
    assert.ok(fs.existsSync(builtinPath), 'built-in full.yml should exist');
    // loadTemplate should succeed — proof that built-in path is found
    const { template, error } = loadTemplate('full', orchRoot);
    assert.equal(error, null);
    assert.ok(template, 'template should be loaded from built-in path');
  });
});

// ─── validateTemplate() — valid templates ───────────────────────────────────

describe('validateTemplate() — valid templates', () => {
  it('returns empty errors for full.yml', () => {
    const { template } = loadTemplate('full', orchRoot);
    const errors = validateTemplate(template);
    assert.deepEqual(errors, []);
  });

  it('returns empty errors for quick.yml', () => {
    const { template } = loadTemplate('quick', orchRoot);
    const errors = validateTemplate(template);
    assert.deepEqual(errors, []);
  });
});

// ─── validateTemplate() — error categories ──────────────────────────────────

describe('validateTemplate() — error categories', () => {
  it('reports error for missing name', () => {
    const errors = validateTemplate({
      nodes: [{ id: 'a', type: 'step', action: 'spawn_research', events: { completed: 'done' } }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /name/i.test(e)), 'error should mention "name"');
  });

  it('reports error for missing nodes', () => {
    const errors = validateTemplate({ name: 'x' });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /nodes/i.test(e)), 'error should mention "nodes"');
  });

  it('reports error for empty nodes array', () => {
    const errors = validateTemplate({ name: 'x', nodes: [] });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /nodes/i.test(e)), 'error should mention "nodes"');
  });

  it('reports error for node missing id', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [{ type: 'step', action: 'spawn_research', events: { completed: 'done' } }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /id/i.test(e)), 'error should mention "id"');
  });

  it('reports error for node missing type', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [{ id: 'node1' }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /type/i.test(e)), 'error should mention "type"');
    assert.ok(errors.some(e => /node1/i.test(e)), 'error should mention the node ID');
  });

  it('reports error for unknown node type', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [{ id: 'node1', type: 'bogus_type' }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /bogus_type/i.test(e)), 'error should mention the invalid type value');
  });

  it('reports error for step node missing action', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [{ id: 'node1', type: 'step', events: { completed: 'done' } }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /action/i.test(e)), 'error should mention "action"');
    assert.ok(errors.some(e => /node1/i.test(e)), 'error should mention the node ID');
  });

  it('reports error for step node missing events.completed', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [{ id: 'node1', type: 'step', action: 'spawn_research' }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /events\.completed/i.test(e)), 'error should mention "events.completed"');
    assert.ok(errors.some(e => /node1/i.test(e)), 'error should mention the node ID');
  });

  it('reports error for broken depends_on reference', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [
        { id: 'a', type: 'step', action: 'spawn_research', events: { completed: 'done' } },
        { id: 'b', type: 'step', action: 'spawn_prd', events: { completed: 'done' }, depends_on: ['nonexistent'] },
      ],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /nonexistent/i.test(e)), 'error should mention the unknown node ID');
  });

  it('reports error for cyclic dependency', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [
        { id: 'a', type: 'step', action: 'spawn_research', events: { completed: 'done' }, depends_on: ['b'] },
        { id: 'b', type: 'step', action: 'spawn_prd', events: { completed: 'done2' }, depends_on: ['a'] },
      ],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /cycle/i.test(e)), 'error should mention "cycle"');
  });

  it('reports error for step node with invalid action name', () => {
    const errors = validateTemplate({
      name: 'x',
      nodes: [{ id: 'node1', type: 'step', action: 'totally_invalid_action', events: { completed: 'done' } }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => /totally_invalid_action/i.test(e)), 'error should mention the invalid action value');
    assert.ok(errors.some(e => /node1/i.test(e)), 'error should mention the node ID');
  });

  it('error messages include the relevant node ID', () => {
    // Use missing type scenario — the error should reference the node ID
    const errors = validateTemplate({
      name: 'x',
      nodes: [{ id: 'my_special_node' }],
    });
    assert.ok(errors.length > 0, 'should have errors');
    assert.ok(errors.some(e => e.includes('my_special_node')), 'error should include the node ID');
  });
});

// ─── applyOverrides() ──────────────────────────────────────────────────────

describe('applyOverrides()', () => {
  it('returns template unchanged with empty overrides', () => {
    const { template } = loadTemplate('full', orchRoot);
    const result = applyOverrides(template, {});
    assert.strictEqual(result.template, template, 'should return the same template reference');
    assert.deepEqual(result.errors, []);
  });

  it('returns template unchanged when overrides is null', () => {
    const { template } = loadTemplate('full', orchRoot);
    const result = applyOverrides(template, null);
    assert.strictEqual(result.template, template);
    assert.deepEqual(result.errors, []);
  });

  it('returns template unchanged when overrides is undefined', () => {
    const { template } = loadTemplate('full', orchRoot);
    const result = applyOverrides(template, undefined);
    assert.strictEqual(result.template, template);
    assert.deepEqual(result.errors, []);
  });

  it('disables a top-level node', () => {
    // create_design is a leaf here (nothing depends on it), so no orphan fires
    const tmpl = {
      name: 'test-top-level',
      nodes: [
        { id: 'research', type: 'step', action: 'spawn_research', events: { completed: 'done' } },
        { id: 'create_design', type: 'step', depends_on: ['research'], action: 'spawn_design', events: { completed: 'done' } },
      ],
    };
    const result = applyOverrides(tmpl, { nodes: { create_design: { enabled: false } } });
    assert.deepEqual(result.errors, []);
    const node = result.template.nodes.find(n => n.id === 'create_design');
    assert.strictEqual(node.enabled, false);
  });

  it('disables a body-level node', () => {
    // code_review is a leaf inside for_each_task body (nothing depends on it)
    const tmpl = {
      name: 'test-body-level',
      nodes: [
        {
          id: 'for_each_phase',
          type: 'for_each_phase',
          body: [
            {
              id: 'for_each_task',
              type: 'for_each_task',
              body: [
                { id: 'execute_coding_task', type: 'step', action: 'execute_task', events: { completed: 'done' } },
                { id: 'code_review', type: 'step', depends_on: ['execute_coding_task'], action: 'spawn_code_reviewer', events: { completed: 'done' } },
              ],
            },
          ],
        },
      ],
    };
    const result = applyOverrides(tmpl, { nodes: { code_review: { enabled: false } } });
    assert.deepEqual(result.errors, []);
    const forEachPhase = result.template.nodes.find(n => n.id === 'for_each_phase');
    const forEachTask = forEachPhase.body.find(n => n.id === 'for_each_task');
    const codeReview = forEachTask.body.find(n => n.id === 'code_review');
    assert.strictEqual(codeReview.enabled, false);
  });

  it('does not mutate the original template', () => {
    // request_final_approval is a terminal gate in full.yml — nothing depends on it
    const { template } = loadTemplate('full', orchRoot);
    applyOverrides(template, { nodes: { request_final_approval: { enabled: false } } });
    const node = template.nodes.find(n => n.id === 'request_final_approval');
    assert.strictEqual(node.enabled, undefined);
  });

  it('toggles a conditional flag', () => {
    const { template } = loadTemplate('full', orchRoot);
    const result = applyOverrides(template, { flags: { code_review_enabled: false } });
    assert.deepEqual(result.errors, []);
    assert.strictEqual(result.template.flags.code_review_enabled, false);
  });

  it('changes gate mode', () => {
    const tmpl = {
      name: 'test-gate',
      nodes: [
        { id: 'create_master_plan', type: 'step', action: 'spawn_master_plan', events: { completed: 'done' } },
        { id: 'request_plan_approval', type: 'gate', depends_on: ['create_master_plan'], gate_type: 'planning', gate_action: 'request_plan_approval' },
      ],
    };
    const result = applyOverrides(tmpl, { nodes: { request_plan_approval: { mode: 'auto' } } });
    assert.deepEqual(result.errors, []);
    const gate = result.template.nodes.find(n => n.id === 'request_plan_approval');
    assert.strictEqual(gate.mode, 'auto');
  });

  it('rejects unknown override target', () => {
    const { template } = loadTemplate('full', orchRoot);
    const result = applyOverrides(template, { nodes: { nonexistent_node: { enabled: false } } });
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.includes('nonexistent_node')));
    assert.strictEqual(result.template, template);
  });

  it('rejects orphan-creating override', () => {
    const tmpl = {
      name: 'test-orphan',
      nodes: [
        { id: 'step_a', type: 'step', action: 'spawn_research', events: { completed: 'done' } },
        { id: 'step_b', type: 'step', depends_on: ['step_a'], action: 'spawn_prd', events: { completed: 'done' } },
      ],
    };
    const result = applyOverrides(tmpl, { nodes: { step_a: { enabled: false } } });
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.includes('step_a')));
    assert.ok(result.errors.some(e => e.includes('step_b')));
    assert.strictEqual(result.template, tmpl);
  });

  it('allows disabling a node when downstream has alternative dependencies', () => {
    // C depends on [A, B]; disabling A leaves C with B — no orphan
    const tmpl = {
      name: 'test-alt-deps',
      nodes: [
        { id: 'node_a', type: 'step', action: 'spawn_research', events: { completed: 'done' } },
        { id: 'node_b', type: 'step', action: 'spawn_prd', events: { completed: 'done' } },
        { id: 'node_c', type: 'step', depends_on: ['node_a', 'node_b'], action: 'spawn_design', events: { completed: 'done' } },
      ],
    };
    const result = applyOverrides(tmpl, { nodes: { node_a: { enabled: false } } });
    assert.deepEqual(result.errors, []);
    const node = result.template.nodes.find(n => n.id === 'node_a');
    assert.strictEqual(node.enabled, false);
  });

  it('applies multiple overrides combined', () => {
    const tmpl = {
      name: 'test-multi',
      nodes: [
        { id: 'research', type: 'step', action: 'spawn_research', events: { completed: 'done' } },
        { id: 'create_design', type: 'step', depends_on: ['research'], action: 'spawn_design', events: { completed: 'done' } },
        { id: 'request_plan_approval', type: 'gate', depends_on: ['research'], gate_type: 'planning', gate_action: 'request_plan_approval' },
      ],
    };
    const result = applyOverrides(tmpl, {
      nodes: {
        create_design: { enabled: false },
        request_plan_approval: { mode: 'auto' },
      },
      flags: { code_review_enabled: false },
    });
    assert.deepEqual(result.errors, []);
    const designNode = result.template.nodes.find(n => n.id === 'create_design');
    const gateNode = result.template.nodes.find(n => n.id === 'request_plan_approval');
    assert.strictEqual(designNode.enabled, false);
    assert.strictEqual(gateNode.mode, 'auto');
    assert.strictEqual(result.template.flags.code_review_enabled, false);
  });

  it('returns errors array and never throws for validation failures', () => {
    const { template } = loadTemplate('full', orchRoot);
    let result;
    assert.doesNotThrow(() => {
      result = applyOverrides(template, { nodes: { nonexistent_node: { enabled: false } } });
    });
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0);
  });
});

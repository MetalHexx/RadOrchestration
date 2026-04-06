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
});

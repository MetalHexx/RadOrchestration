/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYamlRaw } from 'yaml';
import { parseTemplateToGraph, serializeGraphToYaml } from './template-serializer';

// ── Fixture loading ───────────────────────────────────────────────────────────

const FULL_YAML = readFileSync(
  join(__dirname, '../../.github/skills/orchestration/templates/full.yml'),
  'utf-8'
);
const QUICK_YAML = readFileSync(
  join(__dirname, '../../.github/skills/orchestration/templates/quick.yml'),
  'utf-8'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively find a node by id in a (possibly nested) YAML nodes array. */
function findYamlNode(nodes: any[], id: string): any | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (Array.isArray(node.body)) {
      const found = findYamlNode(node.body, id);
      if (found) return found;
    }
    if (node.branches) {
      const trueBranch = node.branches['true'];
      if (Array.isArray(trueBranch)) {
        const found = findYamlNode(trueBranch, id);
        if (found) return found;
      }
      const falseBranch = node.branches['false'];
      if (Array.isArray(falseBranch)) {
        const found = findYamlNode(falseBranch, id);
        if (found) return found;
      }
    }
  }
  return undefined;
}

// ── parseTemplateToGraph ──────────────────────────────────────────────────────

describe('parseTemplateToGraph', () => {
  it('parsing full.yml produces a TemplateGraph with nodes and edges arrays', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    assert.ok(Array.isArray(graph.nodes), 'nodes should be an array');
    assert.ok(Array.isArray(graph.edges), 'edges should be an array');
    assert.ok(graph.nodes.length > 0, 'nodes should not be empty');
  });

  it('parsing quick.yml produces a TemplateGraph with nodes and edges arrays', () => {
    const graph = parseTemplateToGraph(QUICK_YAML);
    assert.ok(Array.isArray(graph.nodes), 'nodes should be an array');
    assert.ok(Array.isArray(graph.edges), 'edges should be an array');
    assert.ok(graph.nodes.length > 0, 'nodes should not be empty');
  });

  it('all five node kinds appear in parsed full.yml nodes', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const kinds = new Set(graph.nodes.map(n => n.data.kind));
    assert.ok(kinds.has('step'), 'kind "step" not found');
    assert.ok(kinds.has('gate'), 'kind "gate" not found');
    assert.ok(kinds.has('conditional'), 'kind "conditional" not found');
    assert.ok(kinds.has('for_each_phase'), 'kind "for_each_phase" not found');
    assert.ok(kinds.has('for_each_task'), 'kind "for_each_task" not found');
  });

  it('loop nodes (for_each_phase, for_each_task) have type: templateGroup', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const loopNodes = graph.nodes.filter(
      n => n.data.kind === 'for_each_phase' || n.data.kind === 'for_each_task'
    );
    assert.ok(loopNodes.length > 0, 'no loop nodes found');
    for (const n of loopNodes) {
      assert.strictEqual(n.type, 'templateGroup', `loop node ${n.id} should be templateGroup`);
    }
  });

  it('step and gate nodes have type: templateNode', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const nodes = graph.nodes.filter(n => n.data.kind === 'step' || n.data.kind === 'gate');
    assert.ok(nodes.length > 0, 'no step/gate nodes found');
    for (const n of nodes) {
      assert.strictEqual(n.type, 'templateNode', `${n.id} should have type templateNode`);
    }
  });

  it('conditional nodes with non-empty branches have type: templateGroup', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const nodes = graph.nodes.filter(n => n.data.kind === 'conditional');
    assert.ok(nodes.length > 0, 'no conditional nodes found');
    for (const n of nodes) {
      assert.strictEqual(n.type, 'templateGroup', `${n.id} should have type templateGroup`);
    }
  });

  it('child nodes inside loop bodies have parentId set to the loop node id', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const phaseLoopChildren = graph.nodes.filter(n => n.parentId === 'phase_loop');
    assert.ok(phaseLoopChildren.length > 0, 'phase_loop has no children');
    const childIds = phaseLoopChildren.map(n => n.id);
    assert.ok(childIds.includes('phase_planning'), 'phase_planning should be child of phase_loop');
    assert.ok(childIds.includes('task_loop'), 'task_loop should be child of phase_loop');
  });

  it('child nodes inside conditional branches have parentId set to the conditional node id', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const commitNode = graph.nodes.find(n => n.id === 'commit');
    assert.ok(commitNode, 'commit node not found');
    assert.strictEqual(
      commitNode.parentId,
      'commit_gate',
      'commit should have parentId: commit_gate'
    );
  });

  it('depends_on relationships become edges: source=dependency, target=dependent', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    // architecture depends on design
    const edge = graph.edges.find(e => e.source === 'design' && e.target === 'architecture');
    assert.ok(edge, 'edge design → architecture not found');
  });

  it('conditional branch edges have label: "true" for true-branch children', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const commitTrueEdge = graph.edges.find(
      e => e.source === 'commit_gate' && e.target === 'commit' && e.label === 'true'
    );
    assert.ok(commitTrueEdge, 'commit_gate → commit (true) edge not found');
  });

  it('all edges have type: smoothstep, markerEnd: { type: arrowclosed }, and animated: false', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    assert.ok(graph.edges.length > 0, 'no edges produced');
    for (const edge of graph.edges) {
      assert.strictEqual(edge.type, 'smoothstep', `edge ${edge.id} type should be smoothstep`);
      assert.deepStrictEqual(
        edge.markerEnd,
        { type: 'arrowclosed' },
        `edge ${edge.id} markerEnd mismatch`
      );
      assert.strictEqual(edge.animated, false, `edge ${edge.id} animated should be false`);
    }
  });

  it('throws on invalid YAML input (empty string)', () => {
    assert.throws(() => parseTemplateToGraph(''));
  });

  it('throws on YAML without nodes array', () => {
    assert.throws(
      () => parseTemplateToGraph('template:\n  id: test\n'),
      /invalid template/i
    );
  });

  it('conditional node with empty branches has type: templateNode', () => {
    const yaml = [
      'template:',
      '  id: test-empty-cond',
      '  version: "1.0"',
      '  description: test',
      'nodes:',
      '  - id: check',
      '    kind: conditional',
      '    label: Check',
      '    depends_on: []',
      '    branches: {}',
    ].join('\n');
    const graph = parseTemplateToGraph(yaml);
    const node = graph.nodes.find((n) => n.id === 'check');
    assert.ok(node, 'conditional node not found');
    assert.strictEqual(node.type, 'templateNode', 'conditional with no branch children should be templateNode');
  });
});

// ── serializeGraphToYaml ──────────────────────────────────────────────────────

describe('serializeGraphToYaml', () => {
  it('serializing full.yml graph produces valid parseable YAML', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    assert.ok(typeof serialized === 'string' && serialized.length > 0);
    const reparsed = parseYamlRaw(serialized);
    assert.ok(reparsed !== null && typeof reparsed === 'object');
  });

  it('serializing quick.yml graph produces valid parseable YAML', () => {
    const graph = parseTemplateToGraph(QUICK_YAML);
    const quickMeta = (parseYamlRaw(QUICK_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, quickMeta);
    assert.ok(typeof serialized === 'string' && serialized.length > 0);
    const reparsed = parseYamlRaw(serialized);
    assert.ok(reparsed !== null && typeof reparsed === 'object');
  });

  it('serialized output includes template metadata block (id, version, description)', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;
    assert.ok(reparsed.template, 'template block missing from serialized output');
    assert.strictEqual(reparsed.template.id, fullMeta.id);
    assert.strictEqual(reparsed.template.version, fullMeta.version);
    assert.strictEqual(reparsed.template.description, fullMeta.description);
  });

  it('serialized output contains a non-empty nodes array', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;
    assert.ok(Array.isArray(reparsed.nodes), 'nodes should be an array');
    assert.ok(reparsed.nodes.length > 0, 'nodes should not be empty');
  });
});

// ── round-trip fidelity ───────────────────────────────────────────────────────

describe('round-trip fidelity', () => {
  it('full.yml round-trip: parse → serialize → re-parse deepStrictEquals original parse', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const original = parseYamlRaw(FULL_YAML);
    const roundTripped = parseYamlRaw(serialized);
    assert.deepStrictEqual(roundTripped, original);
  });

  it('quick.yml round-trip: parse → serialize → re-parse deepStrictEquals original parse', () => {
    const graph = parseTemplateToGraph(QUICK_YAML);
    const quickMeta = (parseYamlRaw(QUICK_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, quickMeta);
    const original = parseYamlRaw(QUICK_YAML);
    const roundTripped = parseYamlRaw(serialized);
    assert.deepStrictEqual(roundTripped, original);
  });

  it('double round-trip: parse → serialize → parse → serialize produces idempotent output', () => {
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const graph1 = parseTemplateToGraph(FULL_YAML);
    const serialized1 = serializeGraphToYaml(graph1, fullMeta);
    const graph2 = parseTemplateToGraph(serialized1);
    const serialized2 = serializeGraphToYaml(graph2, fullMeta);
    assert.deepStrictEqual(parseYamlRaw(serialized2), parseYamlRaw(serialized1));
  });

  it('node count preservation: re-parsed graph has the same number of nodes and edges', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const graph2 = parseTemplateToGraph(serialized);
    assert.strictEqual(graph2.nodes.length, graph.nodes.length, 'node count should be preserved');
    assert.strictEqual(graph2.edges.length, graph.edges.length, 'edge count should be preserved');
  });

  it('branchless conditional round-trip: no branches key emitted when conditional has no children', () => {
    const yaml = [
      'template:',
      '  id: test-branchless',
      '  version: "1.0"',
      '  description: branchless conditional round-trip',
      'nodes:',
      '  - id: check',
      '    kind: conditional',
      '    label: Check',
      '    depends_on: []',
    ].join('\n');
    const meta = (parseYamlRaw(yaml) as any).template;
    const graph = parseTemplateToGraph(yaml);
    const serialized = serializeGraphToYaml(graph, meta);
    const reparsed = parseYamlRaw(serialized) as any;
    const checkNode = reparsed.nodes.find((n: any) => n.id === 'check');
    assert.ok(checkNode, 'check node not found in serialized output');
    assert.strictEqual(
      checkNode.branches,
      undefined,
      'branchless conditional should NOT have a branches key in serialized output'
    );
  });
});

// ── node kind coverage ────────────────────────────────────────────────────────

describe('node kind coverage', () => {
  it('step nodes: research has kind=step with meta fields action, events, doc_output_field', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const research = graph.nodes.find(n => n.id === 'research');
    assert.ok(research, 'research node not found');
    assert.strictEqual(research.data.kind, 'step');
    assert.ok('action' in research.data.meta, 'meta.action missing');
    assert.ok('events' in research.data.meta, 'meta.events missing');
    assert.ok('doc_output_field' in research.data.meta, 'meta.doc_output_field missing');
  });

  it('gate nodes: plan_approval_gate has kind=gate with meta fields mode_ref, action_if_needed, approved_event', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const gate = graph.nodes.find(n => n.id === 'plan_approval_gate');
    assert.ok(gate, 'plan_approval_gate node not found');
    assert.strictEqual(gate.data.kind, 'gate');
    assert.ok('mode_ref' in gate.data.meta, 'meta.mode_ref missing');
    assert.ok('action_if_needed' in gate.data.meta, 'meta.action_if_needed missing');
    assert.ok('approved_event' in gate.data.meta, 'meta.approved_event missing');
  });

  it('conditional nodes: commit_gate has kind=conditional, meta.condition is parseable JSON with config_ref/operator/value', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const cond = graph.nodes.find(n => n.id === 'commit_gate');
    assert.ok(cond, 'commit_gate node not found');
    assert.strictEqual(cond.data.kind, 'conditional');
    assert.ok('condition' in cond.data.meta, 'meta.condition missing');
    const condValue = JSON.parse(cond.data.meta.condition);
    assert.ok(condValue.config_ref, 'condition.config_ref missing');
    assert.ok(condValue.operator, 'condition.operator missing');
    assert.ok(condValue.value !== undefined, 'condition.value missing');
  });

  it('for_each_phase nodes: phase_loop has kind=for_each_phase, type=templateGroup, meta has source_doc_ref and total_field', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const loopNode = graph.nodes.find(n => n.id === 'phase_loop');
    assert.ok(loopNode, 'phase_loop node not found');
    assert.strictEqual(loopNode.data.kind, 'for_each_phase');
    assert.strictEqual(loopNode.type, 'templateGroup');
    assert.ok('source_doc_ref' in loopNode.data.meta, 'meta.source_doc_ref missing');
    assert.ok('total_field' in loopNode.data.meta, 'meta.total_field missing');
  });

  it('for_each_task nodes: task_loop has kind=for_each_task, type=templateGroup, meta has source_doc_ref and tasks_field', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const loopNode = graph.nodes.find(n => n.id === 'task_loop');
    assert.ok(loopNode, 'task_loop node not found');
    assert.strictEqual(loopNode.data.kind, 'for_each_task');
    assert.strictEqual(loopNode.type, 'templateGroup');
    assert.ok('source_doc_ref' in loopNode.data.meta, 'meta.source_doc_ref missing');
    assert.ok('tasks_field' in loopNode.data.meta, 'meta.tasks_field missing');
  });
});

// ── recursive nesting ─────────────────────────────────────────────────────────

describe('recursive nesting', () => {
  it('task_loop (for_each_task) has parentId: phase_loop', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const taskLoop = graph.nodes.find(n => n.id === 'task_loop');
    assert.ok(taskLoop, 'task_loop not found');
    assert.strictEqual(taskLoop.parentId, 'phase_loop');
  });

  it('nodes inside task_loop body (task_handoff, task_executor, code_review, commit_gate, task_gate) have parentId: task_loop', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    for (const id of ['task_handoff', 'task_executor', 'code_review', 'commit_gate', 'task_gate']) {
      const node = graph.nodes.find(n => n.id === id);
      assert.ok(node, `${id} not found`);
      assert.strictEqual(node.parentId, 'task_loop', `${id} should have parentId: task_loop`);
    }
  });

  it('commit_gate (conditional inside task_loop) has parentId: task_loop', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const commitGate = graph.nodes.find(n => n.id === 'commit_gate');
    assert.ok(commitGate, 'commit_gate not found');
    assert.strictEqual(commitGate.parentId, 'task_loop');
  });

  it('commit (step in conditional true branch) has parentId: commit_gate', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const commit = graph.nodes.find(n => n.id === 'commit');
    assert.ok(commit, 'commit node not found');
    assert.strictEqual(commit.parentId, 'commit_gate');
  });

  it('round-trip preserves nested body arrays and branches structure', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;

    // phase_loop body exists and contains task_loop
    const phaseLoopReparsed = findYamlNode(reparsed.nodes, 'phase_loop');
    assert.ok(phaseLoopReparsed, 'phase_loop not found in re-parsed YAML');
    assert.ok(Array.isArray(phaseLoopReparsed.body), 'phase_loop.body should be an array');

    // task_loop nested inside phase_loop body
    const taskLoopReparsed = findYamlNode(phaseLoopReparsed.body, 'task_loop');
    assert.ok(taskLoopReparsed, 'task_loop not found in phase_loop.body');
    assert.ok(Array.isArray(taskLoopReparsed.body), 'task_loop.body should be an array');

    // commit_gate in task_loop body, with branches
    const commitGateReparsed = findYamlNode(taskLoopReparsed.body, 'commit_gate');
    assert.ok(commitGateReparsed, 'commit_gate not found in task_loop.body');
    assert.ok(commitGateReparsed.branches, 'commit_gate should have branches');
    assert.ok(
      Array.isArray(commitGateReparsed.branches['true']),
      'commit_gate.branches.true should be an array'
    );
  });
});

// ── depends_on ↔ edges round-trip ────────────────────────────────────────────

describe('depends_on ↔ edges round-trip', () => {
  it('architecture depends on design → edge { source: design, target: architecture } exists', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const edge = graph.edges.find(e => e.source === 'design' && e.target === 'architecture');
    assert.ok(edge, 'edge design → architecture not found');
  });

  it('task_gate depends on commit_gate → one unlabeled edge exists', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const edge = graph.edges.find(
      e => e.source === 'commit_gate' && e.target === 'task_gate' && e.label === undefined
    );
    assert.ok(edge, 'edge commit_gate → task_gate not found');
  });

  it('after round-trip, depends_on arrays in re-parsed YAML match originals', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;

    // architecture.depends_on should be ['design']
    const architecture = findYamlNode(reparsed.nodes, 'architecture');
    assert.ok(architecture, 'architecture not found in re-parsed YAML');
    assert.deepStrictEqual(architecture.depends_on, ['design']);

    // task_gate.depends_on should be ['commit_gate']
    const taskGate = findYamlNode(reparsed.nodes, 'task_gate');
    assert.ok(taskGate, 'task_gate not found in re-parsed YAML');
    assert.deepStrictEqual(taskGate.depends_on, ['commit_gate']);
  });
});

// ── meta field round-trip ─────────────────────────────────────────────────────

describe('meta field round-trip', () => {
  it('step node events (object value) is stored as JSON string in meta and restores correctly after round-trip', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const research = graph.nodes.find(n => n.id === 'research');
    assert.ok(research, 'research node not found');
    // meta.events should be a JSON-encoded string
    assert.strictEqual(typeof research.data.meta.events, 'string', 'meta.events should be a string');
    const eventsObj = JSON.parse(research.data.meta.events);
    assert.ok(eventsObj.started, 'events.started missing');
    assert.ok(eventsObj.completed, 'events.completed missing');

    // After round-trip, events should be restored as object in YAML
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;
    const researchReparsed = findYamlNode(reparsed.nodes, 'research');
    assert.ok(researchReparsed, 'research not found in re-parsed YAML');
    assert.deepStrictEqual(researchReparsed.events, eventsObj);
  });

  it('gate node auto_approve_modes (array value) survives round-trip', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const gateMode = graph.nodes.find(n => n.id === 'gate_mode_selection');
    assert.ok(gateMode, 'gate_mode_selection not found');
    const modesArr = JSON.parse(gateMode.data.meta.auto_approve_modes);
    assert.deepStrictEqual(modesArr, ['task', 'phase', 'autonomous']);

    // After round-trip, array should be preserved
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;
    const gateModeReparsed = findYamlNode(reparsed.nodes, 'gate_mode_selection');
    assert.ok(gateModeReparsed, 'gate_mode_selection not found in re-parsed YAML');
    assert.deepStrictEqual(gateModeReparsed.auto_approve_modes, ['task', 'phase', 'autonomous']);
  });

  it('conditional node condition (nested object) survives round-trip with config_ref, operator, value', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const commitGate = graph.nodes.find(n => n.id === 'commit_gate');
    assert.ok(commitGate, 'commit_gate not found');
    const condition = JSON.parse(commitGate.data.meta.condition);
    assert.strictEqual(condition.config_ref, 'source_control.auto_commit');
    assert.strictEqual(condition.operator, 'neq');
    assert.strictEqual(condition.value, 'never');

    // After round-trip, condition should be preserved as object
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;
    const commitGateReparsed = findYamlNode(reparsed.nodes, 'commit_gate');
    assert.ok(commitGateReparsed, 'commit_gate not found in re-parsed YAML');
    assert.deepStrictEqual(commitGateReparsed.condition, condition);
  });

  it('loop node source_doc_ref (string value) survives round-trip', () => {
    const graph = parseTemplateToGraph(FULL_YAML);
    const phaseLoop = graph.nodes.find(n => n.id === 'phase_loop');
    assert.ok(phaseLoop, 'phase_loop not found');
    assert.strictEqual(
      phaseLoop.data.meta.source_doc_ref,
      '$.nodes.master_plan.doc_path'
    );

    // After round-trip
    const fullMeta = (parseYamlRaw(FULL_YAML) as any).template;
    const serialized = serializeGraphToYaml(graph, fullMeta);
    const reparsed = parseYamlRaw(serialized) as any;
    const phaseLoopReparsed = findYamlNode(reparsed.nodes, 'phase_loop');
    assert.ok(phaseLoopReparsed, 'phase_loop not found in re-parsed YAML');
    assert.strictEqual(phaseLoopReparsed.source_doc_ref, '$.nodes.master_plan.doc_path');
  });
});

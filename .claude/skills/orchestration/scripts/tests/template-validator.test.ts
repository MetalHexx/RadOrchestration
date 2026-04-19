import { describe, it, expect } from 'vitest';
import { validateTemplate } from '../lib/template-validator.js';
import type { PipelineTemplate, NodeDef } from '../lib/types.js';

function makeTemplate(nodes: NodeDef[], id = 'my-template'): PipelineTemplate {
  return {
    template: { id, version: '1.0.0', description: 'test template' },
    nodes,
  };
}

function makeStep(id: string, depends_on?: string[]): NodeDef {
  return {
    id,
    kind: 'step',
    action: 'test_action',
    events: { started: `${id}_started`, completed: `${id}_completed` },
    ...(depends_on !== undefined ? { depends_on } : {}),
  } as NodeDef;
}

describe('validateTemplate', () => {
  describe('valid template', () => {
    it('returns valid result with no errors or warnings for a well-formed template', () => {
      // Root nodes (no depends_on) — fully valid, no structural defects possible
      const nodes: NodeDef[] = [
        makeStep('a'),
        makeStep('b'),
        makeStep('c'),
      ];
      const result = validateTemplate(makeTemplate(nodes), 'my-template');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('cycle_detected', () => {
    it('detects a two-node cycle and reports both participating nodes', () => {
      const nodes: NodeDef[] = [
        makeStep('a', ['b']),
        makeStep('b', ['a']),
      ];
      const result = validateTemplate(makeTemplate(nodes), 'my-template');
      expect(result.valid).toBe(false);
      const err = result.errors.find(e => e.subtype === 'cycle_detected');
      expect(err).toBeDefined();
      expect(err!.detail.cycle_nodes).toContain('a');
      expect(err!.detail.cycle_nodes).toContain('b');
    });
  });

  describe('dangling_ref', () => {
    it('detects a dependency on a node not defined in the scope', () => {
      const nodes: NodeDef[] = [
        makeStep('x', ['nonexistent']),
      ];
      const result = validateTemplate(makeTemplate(nodes), 'my-template');
      expect(result.valid).toBe(false);
      const err = result.errors.find(e => e.subtype === 'dangling_ref');
      expect(err).toBeDefined();
      expect(err!.detail.node_id).toBe('x');
      expect(err!.detail.missing_ref).toBe('nonexistent');
    });
  });

  describe('invalid_kind', () => {
    it('detects a node with an unrecognised kind and reports all valid kinds', () => {
      const nodes: NodeDef[] = [
        { id: 'bad', kind: 'bogus' } as unknown as NodeDef,
      ];
      const result = validateTemplate(makeTemplate(nodes), 'my-template');
      expect(result.valid).toBe(false);
      const err = result.errors.find(e => e.subtype === 'invalid_kind');
      expect(err).toBeDefined();
      expect(err!.detail.node_id).toBe('bad');
      expect(err!.detail.invalid_kind).toBe('bogus');
      const validKinds = err!.detail.valid_kinds as string[];
      expect(validKinds).toContain('step');
      expect(validKinds).toContain('gate');
      expect(validKinds).toContain('for_each_phase');
      expect(validKinds).toContain('for_each_task');
      expect(validKinds).toContain('conditional');
      expect(validKinds).toContain('parallel');
      expect(validKinds).toHaveLength(6);
    });
  });

  describe('unreachable_node', () => {
    it('detects a non-root node not referenced by any sibling', () => {
      // 'c' depends on 'b' (not a root) but no node lists 'c' in their depends_on
      const nodes: NodeDef[] = [
        makeStep('a'),
        makeStep('b', ['a']),
        makeStep('c', ['b']),
      ];
      const result = validateTemplate(makeTemplate(nodes), 'my-template');
      expect(result.valid).toBe(false);
      const err = result.errors.find(e => e.subtype === 'unreachable_node');
      expect(err).toBeDefined();
      expect(err!.detail.node_id).toBe('c');
    });
  });

  describe('id_mismatch', () => {
    it('produces a warning but not an error when template id does not match the provided templateId', () => {
      const nodes: NodeDef[] = [makeStep('a')];
      const result = validateTemplate(makeTemplate(nodes, 'my-template'), 'different-id');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      const warning = result.warnings[0];
      expect(warning.subtype).toBe('id_mismatch');
      expect(warning.detail.expected_id).toBe('different-id');
      expect(warning.detail.actual_id).toBe('my-template');
    });
  });

  describe('multiple errors', () => {
    it('returns entries for both dangling_ref and invalid_kind when both are present', () => {
      const nodes: NodeDef[] = [
        { id: 'bad-kind', kind: 'bogus' } as unknown as NodeDef,
        makeStep('x', ['nonexistent']),
      ];
      const result = validateTemplate(makeTemplate(nodes), 'my-template');
      expect(result.valid).toBe(false);
      const subtypes = result.errors.map(e => e.subtype);
      expect(subtypes).toContain('invalid_kind');
      expect(subtypes).toContain('dangling_ref');
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('nested scope validation', () => {
    it('detects a cycle inside a for_each_phase body', () => {
      const nodes: NodeDef[] = [
        {
          id: 'phase-loop',
          kind: 'for_each_phase',
          source_doc_ref: 'master_plan',
          total_field: 'total_phases',
          body: [
            makeStep('body-a', ['body-b']),
            makeStep('body-b', ['body-a']),
          ],
        } as NodeDef,
      ];
      const result = validateTemplate(makeTemplate(nodes), 'my-template');
      expect(result.valid).toBe(false);
      const cycleErr = result.errors.find(e => e.subtype === 'cycle_detected');
      expect(cycleErr).toBeDefined();
      expect(cycleErr!.detail.cycle_nodes).toContain('body-a');
      expect(cycleErr!.detail.cycle_nodes).toContain('body-b');
    });
  });

  describe('deprecated templates', () => {
    it('skips validation for a deprecated template even when nodes are structurally invalid', () => {
      const deprecatedTemplate: PipelineTemplate = {
        template: { id: 'foo', version: '1', description: 'd', status: 'deprecated' },
        nodes: [
          // Invalid nodes: cycle + dangling ref — would normally fail validation
          makeStep('a', ['b']),
          makeStep('b', ['a']),
          makeStep('x', ['nonexistent']),
        ],
      };
      const result = validateTemplate(deprecatedTemplate, 'foo');
      expect(result).toEqual({ valid: true, errors: [], warnings: [] });
    });
  });
});

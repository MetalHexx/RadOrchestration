import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

interface Node { id: string; kind: string; action?: string; depends_on?: string[]; body?: Node[]; branches?: { true: Node[]; false: Node[] }; }
interface Template { template: { id: string; version: string; description: string; status?: string }; nodes: Node[]; }

function load(p: string): Template { return yaml.load(fs.readFileSync(p, 'utf-8')) as Template; }
function findNode(nodes: Node[], id: string): Node | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.body) { const h = findNode(n.body, id); if (h) return h; }
    if (n.branches) {
      const t = findNode(n.branches.true, id); if (t) return t;
      const f = findNode(n.branches.false, id); if (f) return f;
    }
  }
  return undefined;
}

const TIERS = [
  { id: 'extra-high', perTaskReview: true, phaseReview: true },
  { id: 'high',       perTaskReview: true, phaseReview: false },
  { id: 'medium',     perTaskReview: false, phaseReview: true },
  { id: 'low',        perTaskReview: false, phaseReview: false },
];

describe('tier templates', () => {
  for (const tier of TIERS) {
    describe(`${tier.id}.yml`, () => {
      const t = load(path.join(TEMPLATES_DIR, `${tier.id}.yml`));

      it('declares matching template.id and is not deprecated', () => {
        expect(t.template.id).toBe(tier.id);
        expect(t.template.status).not.toBe('deprecated');
        expect(t.template.description?.length).toBeGreaterThan(0);
      });

      it('preserves planning chain (requirements → master_plan → explode_master_plan → plan_approval_gate → gate_mode_selection)', () => {
        for (const id of ['requirements','master_plan','explode_master_plan','plan_approval_gate','gate_mode_selection']) {
          expect(findNode(t.nodes, id)).toBeDefined();
        }
      });

      it('preserves final review + final-approval anchors (final_review, pr_gate, final_approval_gate)', () => {
        for (const id of ['final_review','pr_gate','final_approval_gate']) {
          expect(findNode(t.nodes, id)).toBeDefined();
        }
      });

      it('task_loop body shape matches the per-task-review setting', () => {
        const taskLoop = findNode(t.nodes, 'task_loop')!;
        const ids = (taskLoop.body ?? []).map(n => n.id);
        if (tier.perTaskReview) {
          expect(ids).toEqual(['task_executor', 'commit_gate', 'code_review', 'task_gate']);
        } else {
          expect(ids).toEqual(['task_executor', 'commit_gate']);
        }
      });

      it('phase_loop body shape matches the phase-review setting', () => {
        const phaseLoop = findNode(t.nodes, 'phase_loop')!;
        const ids = (phaseLoop.body ?? []).map(n => n.id);
        if (tier.phaseReview) {
          expect(ids).toEqual(['task_loop', 'phase_review', 'phase_gate']);
        } else {
          expect(ids).toEqual(['task_loop']);
        }
      });

      it('depends_on rewiring has no orphan references', () => {
        const allIds = new Set<string>();
        const collect = (ns: Node[]) => {
          for (const n of ns) {
            allIds.add(n.id);
            if (n.body) collect(n.body);
            if (n.branches) { collect(n.branches.true); collect(n.branches.false); }
          }
        };
        collect(t.nodes);
        const verify = (ns: Node[]) => {
          for (const n of ns) {
            for (const dep of n.depends_on ?? []) {
              expect(allIds.has(dep), `${tier.id}.yml: ${n.id} depends_on ${dep} which does not exist`).toBe(true);
            }
            if (n.body) verify(n.body);
            if (n.branches) { verify(n.branches.true); verify(n.branches.false); }
          }
        };
        verify(t.nodes);
      });
    });
  }
});

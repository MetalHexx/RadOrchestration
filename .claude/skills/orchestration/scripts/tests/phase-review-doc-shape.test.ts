import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Phase-review absorbed-doc shape test (Iter 8) ─────────────────────────────
//
// Iter 8 collapses generate_phase_report into phase_review. The phase-review
// skill now emits a single artifact that covers BOTH the conformance verdict
// AND the structured phase summary. This test pins the template shape:
//
//   - Frontmatter carries `type`-equivalent surface (project/phase + verdict
//     + exit_criteria_met + severity + author + created).
//   - Body contains all merged sections, including the ones absorbed from the
//     retired generate-phase-report template.
//
// The corresponding workflow.md step 5 (Aggregate phase data) is what produces
// the content for the absorbed sections at runtime.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../../code-review/phase-review/template.md',
);

const WORKFLOW_PATH = path.resolve(
  __dirname,
  '../../../code-review/phase-review/workflow.md',
);

function readTemplate(): string {
  return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

function readWorkflow(): string {
  return fs.readFileSync(WORKFLOW_PATH, 'utf8');
}

function extractFrontmatter(doc: string): string {
  const match = doc.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('No frontmatter block found');
  return match[1];
}

describe('[Iter 8] phase-review template absorbs phase-report doc shape', () => {
  describe('frontmatter shape', () => {
    const frontmatter = extractFrontmatter(readTemplate());

    it('declares verdict (phase-review conformance output)', () => {
      expect(frontmatter).toMatch(/^verdict:/m);
    });

    it('declares exit_criteria_met (phase-review conformance output)', () => {
      expect(frontmatter).toMatch(/^exit_criteria_met:/m);
    });

    it('declares severity (phase-review conformance output)', () => {
      expect(frontmatter).toMatch(/^severity:/m);
    });

    it('declares project + phase (phase-report summary output)', () => {
      expect(frontmatter).toMatch(/^project:/m);
      expect(frontmatter).toMatch(/^phase:/m);
    });

    it('declares author + created (standard review fields)', () => {
      expect(frontmatter).toMatch(/^author:/m);
      expect(frontmatter).toMatch(/^created:/m);
    });
  });

  describe('body sections — merged phase-review + phase-report', () => {
    const body = readTemplate();

    // Sections that existed on phase-review before Iter 8 (retained):
    it('has Verdict heading', () => {
      expect(body).toMatch(/^## Verdict:/m);
    });

    it('has Summary section', () => {
      expect(body).toMatch(/^## Summary$/m);
    });

    it('has Integration Assessment section', () => {
      expect(body).toMatch(/^## Integration Assessment$/m);
    });

    it('has Cross-Task Issues section', () => {
      expect(body).toMatch(/^## Cross-Task Issues$/m);
    });

    it('has Independent Quality Assessment section', () => {
      expect(body).toMatch(/^## Independent Quality Assessment$/m);
    });

    it('has Test & Build Summary section', () => {
      expect(body).toMatch(/^## Test & Build Summary$/m);
    });

    it('has Recommendations for Next Phase section', () => {
      expect(body).toMatch(/^## Recommendations for Next Phase$/m);
    });

    // Sections absorbed from the retired phase-report template (new in Iter 8):
    it('has Task Results section (absorbed from phase-report)', () => {
      expect(body).toMatch(/^## Task Results$/m);
    });

    it('has Exit Criteria Assessment section (merged with existing verification)', () => {
      expect(body).toMatch(/^## Exit Criteria Assessment$/m);
    });

    it('has Files Changed (Phase Total) section (absorbed from phase-report)', () => {
      expect(body).toMatch(/^## Files Changed \(Phase Total\)$/m);
    });

    it('has Issues & Resolutions section (absorbed from phase-report)', () => {
      expect(body).toMatch(/^## Issues & Resolutions$/m);
    });

    it('has Carry-Forward Items section (absorbed from phase-report)', () => {
      expect(body).toMatch(/^## Carry-Forward Items$/m);
    });

    it('has Master Plan Adjustment Recommendations section (absorbed from phase-report)', () => {
      expect(body).toMatch(/^## Master Plan Adjustment Recommendations$/m);
    });

    // New, named section introduced by Iter 8:
    it('has Corrections Applied section (new in Iter 8; empty on first-time reviews)', () => {
      expect(body).toMatch(/^## Corrections Applied$/m);
    });
  });

  describe('workflow shape — absorbs phase-report inputs + aggregation pass', () => {
    const workflow = readWorkflow();

    it('inputs table no longer lists a pre-authored Phase Report', () => {
      // The old workflow routed a "Phase Report" input row into the reviewer.
      // Post-Iter 8 the reviewer aggregates the summary itself — no upstream doc.
      expect(workflow).not.toMatch(/\|\s*Phase Report\s*\|/);
    });

    it('inputs table lists state.json (for retry counts in Task Results)', () => {
      expect(workflow).toMatch(/state\.json/);
    });

    it('workflow step aggregates Task Results from Code Reviews + state.json', () => {
      const aggregateStep = workflow.match(/Aggregate phase data[\s\S]*?(?=\n\d+\.|\n## )/)?.[0] ?? '';
      expect(aggregateStep).toMatch(/Task Results/);
      expect(aggregateStep).toMatch(/state\.json|retry/);
    });

    it('workflow step mentions Files Changed aggregation', () => {
      expect(workflow).toMatch(/Files Changed/);
    });

    it('workflow step mentions Carry-Forward Items', () => {
      expect(workflow).toMatch(/Carry-Forward Items/);
    });

    it('workflow preserves the corrective save-path suffix rule (-C{N}.md)', () => {
      expect(workflow).toMatch(/-C\{corrective_index\}\.md/);
    });
  });
});

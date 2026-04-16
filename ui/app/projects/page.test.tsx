/**
 * Tests for projects/page — module exports and dependency verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/projects/page.test.tsx
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import ProjectsPage from './page';
import { ProjectsPlaceholderView } from '@/components/layout';

// ─── Source text helper ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourceText = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('projects/page — exports and contracts');

  await test('Default export is a function named ProjectsPage', () => {
    assert.strictEqual(typeof ProjectsPage, 'function', 'Default export should be a function');
    assert.strictEqual(ProjectsPage.name, 'ProjectsPage', 'Default export should be named ProjectsPage');
  });

  await test('ProjectsPlaceholderView is importable from @/components/layout', () => {
    assert.strictEqual(typeof ProjectsPlaceholderView, 'function', 'ProjectsPlaceholderView should be a function');
  });

  await test('Source contains id="main-content" attribute', () => {
    assert.ok(
      sourceText.includes('id="main-content"') || sourceText.includes("id='main-content'"),
      'projects/page.tsx must contain id="main-content" on the wrapper div'
    );
  });

  await test('Source contains h-page centering class', () => {
    assert.ok(
      sourceText.includes('h-page'),
      'projects/page.tsx must contain the h-page centering class'
    );
  });

  // ─── Follow-mode integration (P04-T04) ────────────────────────────────────

  await test('Source imports useFollowMode from @/hooks/use-follow-mode', () => {
    assert.ok(
      /import\s*\{\s*useFollowMode\s*\}\s*from\s*["']@\/hooks\/use-follow-mode["']/.test(sourceText),
      'projects/page.tsx must import useFollowMode from @/hooks/use-follow-mode'
    );
  });

  await test('Source imports TimelineToolbar from @/components/dag-timeline', () => {
    assert.ok(
      sourceText.includes('TimelineToolbar') &&
        /from\s*["']@\/components\/dag-timeline["']/.test(sourceText),
      'projects/page.tsx must import TimelineToolbar from @/components/dag-timeline'
    );
    // Stricter: ensure TimelineToolbar appears inside an import statement from @/components/dag-timeline.
    const importBlock = sourceText.match(
      /import\s*\{[^}]*\}\s*from\s*["']@\/components\/dag-timeline["']/
    );
    assert.ok(importBlock, 'projects/page.tsx must have a named import block from @/components/dag-timeline');
    assert.ok(
      /TimelineToolbar/.test(importBlock![0]),
      'TimelineToolbar must be included in the @/components/dag-timeline import block'
    );
  });

  await test('Source calls useFollowMode( at least once', () => {
    assert.ok(
      sourceText.includes('useFollowMode('),
      'projects/page.tsx must invoke useFollowMode('
    );
  });

  await test('Source renders <TimelineToolbar at least once', () => {
    assert.ok(
      sourceText.includes('<TimelineToolbar'),
      'projects/page.tsx must render <TimelineToolbar'
    );
  });

  await test('Source does NOT contain stub literal expandedLoopIds={[]}', () => {
    assert.ok(
      !sourceText.includes('expandedLoopIds={[]}'),
      'projects/page.tsx must not contain the Phase 1 stub expandedLoopIds={[]}'
    );
  });

  await test('Source does NOT contain stub literal onAccordionChange={() => {}}', () => {
    assert.ok(
      !sourceText.includes('onAccordionChange={() => {}}'),
      'projects/page.tsx must not contain the Phase 1 stub onAccordionChange={() => {}}'
    );
  });

  await test('Source passes expandedLoopIds={expandedLoopIds} to DAGTimeline', () => {
    assert.ok(
      sourceText.includes('expandedLoopIds={expandedLoopIds}'),
      'projects/page.tsx must pass expandedLoopIds={expandedLoopIds} to DAGTimeline'
    );
  });

  await test('Source passes onAccordionChange={onAccordionChange} to DAGTimeline', () => {
    assert.ok(
      sourceText.includes('onAccordionChange={onAccordionChange}'),
      'projects/page.tsx must pass onAccordionChange={onAccordionChange} to DAGTimeline'
    );
  });

  await test('TimelineToolbar is rendered between </ProjectHeader> and <DAGTimeline', () => {
    const projectHeaderCloseIdx = sourceText.indexOf('</ProjectHeader>');
    // ProjectHeader is a self-closing tag in page.tsx — fall back to the opening tag's end (`/>`)
    // if `</ProjectHeader>` is not present. We locate the end of the ProjectHeader element.
    let headerEndIdx = projectHeaderCloseIdx;
    if (headerEndIdx === -1) {
      const openIdx = sourceText.indexOf('<ProjectHeader');
      assert.ok(openIdx >= 0, '<ProjectHeader must appear in page.tsx');
      const selfCloseIdx = sourceText.indexOf('/>', openIdx);
      assert.ok(selfCloseIdx >= 0, 'ProjectHeader must have a closing tag or self-close');
      headerEndIdx = selfCloseIdx;
    }

    const toolbarIdx = sourceText.indexOf('<TimelineToolbar');
    const dagTimelineIdx = sourceText.indexOf('<DAGTimeline');

    assert.ok(headerEndIdx >= 0, 'ProjectHeader element must be present');
    assert.ok(toolbarIdx >= 0, '<TimelineToolbar must be present');
    assert.ok(dagTimelineIdx >= 0, '<DAGTimeline must be present');

    assert.ok(
      toolbarIdx > headerEndIdx,
      '<TimelineToolbar must appear after the end of <ProjectHeader ...'
    );
    assert.ok(
      toolbarIdx < dagTimelineIdx,
      '<TimelineToolbar must appear before <DAGTimeline'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

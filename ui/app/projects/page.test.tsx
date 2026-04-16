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

  await test('Source does NOT import TimelineToolbar from @/components/dag-timeline', () => {
    // Follow Mode is now controlled by the shadcn Switch inside <ProjectHeader>.
    // TimelineToolbar was deleted; the page must no longer import it.
    assert.ok(
      !sourceText.includes('TimelineToolbar'),
      'projects/page.tsx must not reference TimelineToolbar'
    );
  });

  await test('Source calls useFollowMode( at least once', () => {
    assert.ok(
      sourceText.includes('useFollowMode('),
      'projects/page.tsx must invoke useFollowMode('
    );
  });

  await test('Source does NOT render <TimelineToolbar', () => {
    assert.ok(
      !sourceText.includes('<TimelineToolbar'),
      'projects/page.tsx must not render <TimelineToolbar (Follow Mode is now inside ProjectHeader)'
    );
  });

  await test('Source threads followMode and toggleFollowMode into <ProjectHeader>', () => {
    assert.ok(
      sourceText.includes('followMode={followMode}'),
      'projects/page.tsx must pass followMode={followMode} to <ProjectHeader>'
    );
    assert.ok(
      sourceText.includes('onToggleFollowMode={toggleFollowMode}'),
      'projects/page.tsx must pass onToggleFollowMode={toggleFollowMode} to <ProjectHeader>'
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

  await test('<DAGTimeline> is rendered directly after <ProjectHeader> (no toolbar sibling)', () => {
    const projectHeaderOpenIdx = sourceText.indexOf('<ProjectHeader');
    assert.ok(projectHeaderOpenIdx >= 0, '<ProjectHeader must appear in page.tsx');
    const headerSelfCloseIdx = sourceText.indexOf('/>', projectHeaderOpenIdx);
    assert.ok(headerSelfCloseIdx >= 0, 'ProjectHeader must have a self-close');

    const dagTimelineIdx = sourceText.indexOf('<DAGTimeline');
    assert.ok(dagTimelineIdx >= 0, '<DAGTimeline must be present');

    assert.ok(
      dagTimelineIdx > headerSelfCloseIdx,
      '<DAGTimeline must appear after <ProjectHeader ... />'
    );
    assert.ok(
      !sourceText.includes('<TimelineToolbar'),
      'No <TimelineToolbar sibling may appear between <ProjectHeader /> and <DAGTimeline'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

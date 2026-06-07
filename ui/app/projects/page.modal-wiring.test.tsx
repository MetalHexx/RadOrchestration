import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  markdownPathForActive,
  fileNameAtOffset,
  fileNameAfterDelete,
} from '@/hooks/use-artifact-modal';
import type { Artifact } from '@/lib/artifact-model';

// Mirrors the page's wiring: identity is the FILENAME. The page converts the
// index handed up by BrainstormingSection/LaunchScreen into a filename at the
// call site (`artifacts[index].fileName`) and drives the modal by name from
// there on. These tests pin that contract without mounting the whole page tree.

const arts: Artifact[] = [
  { fileName: 'DEMO-BRAINSTORMING.md', kind: 'markdown', label: 'Brainstorm', title: null, isMarkdown: true },
  { fileName: 'DEMO-BRAINSTORM.html', kind: 'visual', label: 'Brainstorm Visual', title: null, isMarkdown: false },
  { fileName: 'DEMO-WIREFRAME-X.html', kind: 'wireframe', label: 'Wireframe', title: 'X', isMarkdown: false },
];

const pageSrc = readFileSync(path.join(process.cwd(), 'app', 'projects', '[[...slug]]', 'page.tsx'), 'utf-8');

test('open converts the child index to a filename at the call site (open-by-filename)', () => {
  // BrainstormingSection/LaunchScreen still hand up an index; the page turns it
  // into the filename it opens the modal with.
  assert.ok(
    pageSrc.includes('openArtifactModal(artifacts[index].fileName)'),
    'page converts the incoming index to a filename before opening the modal',
  );
  // And the modal opener is the filename-based entry point.
  assert.ok(pageSrc.includes('openArtifactModal = modal.openByName'), 'opener is openByName');
});

test('the modal is driven by activeFileName, not an index (single choke point)', () => {
  assert.ok(pageSrc.includes('activeFileName={modal.activeFileName}'), 'modal receives the active filename');
  assert.ok(!/activeIndex=\{/.test(pageSrc), 'no activeIndex prop is passed anymore');
  assert.ok(pageSrc.includes('const activeFileName = modal.activeFileName'), 'active filename is the hook identity');
});

test('the render guard checks the active filename is still in the list (FR-19)', () => {
  assert.ok(
    pageSrc.includes('artifacts.some((a) => a.fileName === modal.activeFileName)'),
    'guard presence-checks by filename, not by index',
  );
});

test('select forwards a filename to the modal (select-by-filename)', () => {
  assert.ok(pageSrc.includes('onSelect={(fileName) => modal.openByName(fileName)}'), 'onSelect re-opens by filename');
});

test('prev/next are wired to the filename-based navigation handlers (FR-14)', () => {
  assert.ok(pageSrc.includes('onPrev={modal.goPrev}'), 'prev wired');
  assert.ok(pageSrc.includes('onNext={modal.goNext}'), 'next wired');
  // The handlers themselves step by the active filename's current position.
  assert.equal(fileNameAtOffset(arts, 'DEMO-BRAINSTORMING.md', 1), 'DEMO-BRAINSTORM.html');
  assert.equal(fileNameAtOffset(arts, 'DEMO-BRAINSTORMING.md', -1), 'DEMO-WIREFRAME-X.html');
});

test('delete resolves the pending artifact by the active filename (FR-19)', () => {
  assert.ok(
    pageSrc.includes('artifacts.find((x) => x.fileName === modal.activeFileName)'),
    'delete finds the active artifact by filename',
  );
  // onDeleted clamp semantics, in filename terms.
  assert.equal(fileNameAfterDelete(arts, 'DEMO-WIREFRAME-X.html'), 'DEMO-BRAINSTORM.html');
});

test('close runs the deferred-unmount handler and the modal is driven by a data-state (Fix 3 exit animation)', () => {
  assert.ok(pageSrc.includes('onClose={handleModalClose}'), 'close is wired to the deferred-unmount handler');
  assert.ok(pageSrc.includes('dataState={modalClosing ? "closed" : "open"}'), 'data-state toggles between open and closed for the exit animation');
});

test('the markdown fetch effect resolves its path from the active filename (FR-12, AD-8)', () => {
  assert.ok(
    pageSrc.includes('markdownPathForActive(artifacts, modal.activeFileName)'),
    'effect reads markdown path by filename',
  );
  // And the helper returns the md path only for a markdown active file.
  assert.equal(markdownPathForActive(arts, 'DEMO-BRAINSTORMING.md'), 'DEMO-BRAINSTORMING.md');
  assert.equal(markdownPathForActive(arts, 'DEMO-BRAINSTORM.html'), null);
});

test('the modal identity is the URL document and navigation drives the router (URL source of truth)', () => {
  assert.ok(pageSrc.includes('useArtifactModal(getArtifacts, urlDoc, navigate)'),
    'modal is constructed from the URL document and a navigate fn');
  assert.ok(pageSrc.includes('/docs/${encodeURIComponent('),
    'navigate builds an encoded document deep link');
  assert.ok(/const\s+urlDoc\s*=/.test(pageSrc),
    'page derives urlDoc from the slug');
});

test('slug segments are read as-is (useParams already decodes) — no double-decode URIError (PR #115)', () => {
  // The write side encodes exactly once (`/docs/${encodeURIComponent(...)}`) and Next's
  // useParams() decodes once, so a manual decodeURIComponent on a slug segment double-
  // decodes and throws URIError on names containing '%'. Pin the single round-trip.
  assert.ok(!/decodeURIComponent\(\s*slug\[/.test(pageSrc),
    'urlProject/urlDoc must NOT manually decode slug segments — useParams already decodes them');
  assert.ok(/urlProject\s*=\s*slug\s*&&\s*slug\.length\s*>\s*0\s*\?\s*slug\[0\]\s*:/.test(pageSrc),
    'urlProject reads slug[0] directly');
  assert.ok(/slug\[1\]\s*===\s*'docs'\s*\?\s*slug\[2\]\s*:/.test(pageSrc),
    'urlDoc reads slug[2] directly when the second segment is "docs"');
});

test('a missing document shows a load-gated not-found state, never while still loading', () => {
  assert.ok(pageSrc.includes('filesLoaded && !artifacts.some((a) => a.fileName === modal.activeFileName)'),
    'not-found state is gated on filesLoaded and a filename-absence check');
  assert.ok(pageSrc.includes('Document not found'),
    'a client-rendered document-not-found notice is present');
});

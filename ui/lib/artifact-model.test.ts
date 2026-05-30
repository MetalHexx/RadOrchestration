import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveArtifacts } from './artifact-model';

const PROJECT = 'DEMO';

test('filters to BRAINSTORMING.md plus root *.html only (FR-1)', () => {
  const files = ['DEMO-BRAINSTORMING.md', 'DEMO-BRAINSTORM.html', 'state.json', 'reports/X.md', 'sub/Y.html'];
  const arts = deriveArtifacts(PROJECT, files, {});
  const names = arts.map((a) => a.fileName);
  assert.deepEqual(names.sort(), ['DEMO-BRAINSTORM.html', 'DEMO-BRAINSTORMING.md'].sort());
});

test('orders BRAINSTORMING.md, then BRAINSTORM.html, then wireframes by mtime asc (FR-2)', () => {
  const files = [
    'DEMO-WIREFRAME-DAG-VIEW.html',
    'DEMO-WIREFRAME-LAUNCH-SCREEN.html',
    'DEMO-BRAINSTORM.html',
    'DEMO-BRAINSTORMING.md',
  ];
  const mtimes = {
    'DEMO-WIREFRAME-DAG-VIEW.html': 200,
    'DEMO-WIREFRAME-LAUNCH-SCREEN.html': 100,
    'DEMO-BRAINSTORM.html': 999,
    'DEMO-BRAINSTORMING.md': 999,
  };
  const arts = deriveArtifacts(PROJECT, files, mtimes);
  assert.deepEqual(arts.map((a) => a.fileName), [
    'DEMO-BRAINSTORMING.md',
    'DEMO-BRAINSTORM.html',
    'DEMO-WIREFRAME-LAUNCH-SCREEN.html',
    'DEMO-WIREFRAME-DAG-VIEW.html',
  ]);
});

test('assigns locked labels and humanized wireframe titles (FR-3)', () => {
  const files = ['DEMO-BRAINSTORMING.md', 'DEMO-BRAINSTORM.html', 'DEMO-WIREFRAME-LAUNCH-SCREEN.html'];
  const arts = deriveArtifacts(PROJECT, files, {});
  const byName = Object.fromEntries(arts.map((a) => [a.fileName, a]));
  assert.equal(byName['DEMO-BRAINSTORMING.md'].label, 'Brainstorm');
  assert.equal(byName['DEMO-BRAINSTORMING.md'].kind, 'markdown');
  assert.equal(byName['DEMO-BRAINSTORM.html'].label, 'Brainstorm Visual');
  assert.equal(byName['DEMO-BRAINSTORM.html'].kind, 'visual');
  assert.equal(byName['DEMO-WIREFRAME-LAUNCH-SCREEN.html'].label, 'Wireframe');
  assert.equal(byName['DEMO-WIREFRAME-LAUNCH-SCREEN.html'].kind, 'wireframe');
  assert.equal(byName['DEMO-WIREFRAME-LAUNCH-SCREEN.html'].title, 'Launch Screen');
});

test('an empty listing yields an empty artifact list without throwing (NFR-3, FR-1)', () => {
  assert.deepEqual(deriveArtifacts(PROJECT, [], {}), []);
});

test('surfaces ANY root *.html as a generic visual; excludes non-html and non-root (tolerance)', () => {
  const files = ['random.html', 'OTHER-PROJECT-BRAINSTORM.html', 'notes.txt', 'sub/x.html'];
  // Under tolerance, every root *.html surfaces as a generic 'html' artifact
  // (even those that are not the canonical brainstorm-visual or a wireframe).
  // Non-html files (notes.txt) and non-root html (sub/x.html) stay excluded.
  const arts = deriveArtifacts(PROJECT, files, {});
  const names = arts.map((a) => a.fileName).sort();
  assert.deepEqual(names, ['OTHER-PROJECT-BRAINSTORM.html', 'random.html']);
  assert.ok(arts.every((a) => a.kind === 'html'));
  assert.ok(!names.includes('notes.txt'));
  assert.ok(!names.includes('sub/x.html'));
});

test('surfaces non-canonical root *.html as generic visuals, ordered by mtime asc (tolerance)', () => {
  const arts = deriveArtifacts(
    'DEMO',
    ['DEMO-BRAINSTORM-VISUAL.html', 'DEMO-MOCKUP.html'],
    { 'DEMO-BRAINSTORM-VISUAL.html': 100, 'DEMO-MOCKUP.html': 200 },
  );
  assert.equal(arts.length, 2);
  const byName = Object.fromEntries(arts.map((a) => [a.fileName, a]));

  assert.equal(byName['DEMO-BRAINSTORM-VISUAL.html'].kind, 'html');
  assert.equal(byName['DEMO-BRAINSTORM-VISUAL.html'].label, 'Visual');
  assert.equal(byName['DEMO-BRAINSTORM-VISUAL.html'].title, 'Brainstorm Visual');
  assert.equal(byName['DEMO-BRAINSTORM-VISUAL.html'].isMarkdown, false);

  assert.equal(byName['DEMO-MOCKUP.html'].kind, 'html');
  assert.equal(byName['DEMO-MOCKUP.html'].label, 'Visual');
  assert.equal(byName['DEMO-MOCKUP.html'].title, 'Mockup');
  assert.equal(byName['DEMO-MOCKUP.html'].isMarkdown, false);
});

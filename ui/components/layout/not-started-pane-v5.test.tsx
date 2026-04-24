import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotStartedPaneV5 } from './not-started-pane-v5';
import * as barrel from './index';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

function render(props: Parameters<typeof NotStartedPaneV5>[0]): string {
  return renderToStaticMarkup(createElement(NotStartedPaneV5, props));
}

const noop = () => {};

// Doc present → two buttons, project name as title
{
  const html = render({
    projectName: 'DEMO',
    brainstormingDoc: 'DEMO-BRAINSTORMING.md',
    onViewBrainstorming: noop,
    onStartPlanning: noop,
    onStartBrainstorming: noop,
    pendingAction: null,
    errorMessage: null,
  });
  assert.ok(html.includes('DEMO'), 'project name rendered as card title');
  assert.ok(html.includes('Start Planning'), 'Start Planning button rendered');
  assert.ok(html.includes('View Brainstorming'), 'View Brainstorming button rendered');
  assert.ok(!html.includes('Start Brainstorming'), 'Start Brainstorming NOT rendered when doc exists');
  console.log('✓ doc present → two-button row (Start Planning + View Brainstorming)');
}

// Doc absent → single Start Brainstorming button, no placeholder for missing button
{
  const html = render({
    projectName: 'DEMO',
    brainstormingDoc: null,
    onViewBrainstorming: noop,
    onStartPlanning: noop,
    onStartBrainstorming: noop,
    pendingAction: null,
    errorMessage: null,
  });
  assert.ok(html.includes('Start Brainstorming'), 'Start Brainstorming rendered');
  assert.ok(!html.includes('Start Planning'), 'Start Planning NOT rendered');
  assert.ok(!html.includes('View Brainstorming'), 'View Brainstorming NOT rendered');
  console.log('✓ doc absent → single Start Brainstorming button');
}

// pendingAction=start-brainstorming → the clicked button is disabled
{
  const html = render({
    projectName: 'DEMO',
    brainstormingDoc: null,
    onViewBrainstorming: noop,
    onStartPlanning: noop,
    onStartBrainstorming: noop,
    pendingAction: 'start-brainstorming',
    errorMessage: null,
  });
  assert.ok(html.includes('disabled'), 'pending button carries disabled attribute');
  console.log('✓ pending action → button disabled');
}

// errorMessage present → inline error line with text-destructive and the message
{
  const html = render({
    projectName: 'DEMO',
    brainstormingDoc: null,
    onViewBrainstorming: noop,
    onStartPlanning: noop,
    onStartBrainstorming: noop,
    pendingAction: null,
    errorMessage: 'Launcher failed.',
  });
  assert.ok(html.includes('text-destructive'), 'destructive token used for inline error');
  assert.ok(html.includes('Launcher failed.'), 'inline error message rendered verbatim');
  console.log('✓ error message → inline destructive line below button row');
}

// View Brainstorming only renders when brainstormingDoc is non-null (FR-3, DD-4)
{
  const htmlWithDoc = render({
    projectName: 'DEMO',
    brainstormingDoc: 'DEMO-BRAINSTORMING.md',
    onViewBrainstorming: noop,
    onStartPlanning: noop,
    onStartBrainstorming: noop,
    pendingAction: null,
    errorMessage: null,
  });
  assert.ok(
    htmlWithDoc.includes('View Brainstorming'),
    'View Brainstorming button renders when brainstormingDoc is non-null',
  );

  const htmlWithoutDoc = render({
    projectName: 'DEMO',
    brainstormingDoc: null,
    onViewBrainstorming: noop,
    onStartPlanning: noop,
    onStartBrainstorming: noop,
    pendingAction: null,
    errorMessage: null,
  });
  assert.ok(
    !htmlWithoutDoc.includes('View Brainstorming'),
    'View Brainstorming button absent when brainstormingDoc is null',
  );
  // Full DOM-click wiring for onViewBrainstorming(brainstormingDoc) is
  // covered by the live-browser verification in Phase 4 (FR-9).
  console.log('✓ View Brainstorming render gate is brainstormingDoc presence');
}

// Barrel re-export
{
  assert.equal(typeof barrel.NotStartedPaneV5, 'function');
  console.log('✓ barrel re-exports NotStartedPaneV5');
}

console.log('\nAll NotStartedPaneV5 tests passed');

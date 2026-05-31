import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicForProject, classifyArtifactEvent } from './artifact-adapter';

const ROOT = '/projects';

test('topic key is scoped per project', () => {
  assert.equal(topicForProject('DEMO'), 'artifacts:DEMO');
});

test('classifies add/change/unlink of a project file into a semantic artifact event', () => {
  assert.deepEqual(
    classifyArtifactEvent({ type: 'add', filePath: '/projects/DEMO/DEMO-BRAINSTORM.html' }, ROOT),
    { topic: 'artifacts:DEMO', kind: 'added', projectName: 'DEMO' },
  );
  assert.deepEqual(
    classifyArtifactEvent({ type: 'change', filePath: '/projects/DEMO/DEMO-BRAINSTORMING.md' }, ROOT),
    { topic: 'artifacts:DEMO', kind: 'changed', projectName: 'DEMO' },
  );
  assert.deepEqual(
    classifyArtifactEvent({ type: 'unlink', filePath: '/projects/DEMO/x.html' }, ROOT),
    { topic: 'artifacts:DEMO', kind: 'removed', projectName: 'DEMO' },
  );
});

test('a path that is not under a project directory yields null', () => {
  assert.equal(classifyArtifactEvent({ type: 'change', filePath: '/projects/loose.txt' }, ROOT), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocDeepLink } from './deep-link';

test('builds an origin-based document deep link, encoding the project and filename', () => {
  assert.equal(
    buildDocDeepLink('http://192.168.1.5:3000', 'MY PROJ', 'A B-WIREFRAME.html'),
    'http://192.168.1.5:3000/projects/MY%20PROJ/docs/A%20B-WIREFRAME.html',
  );
});

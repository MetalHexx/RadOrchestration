import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.join(process.cwd(), 'app', 'projects', 'page.tsx'), 'utf-8');

test('projects page mounts ArtifactLiveProvider (AD-8)', () => {
  assert.ok(SRC.includes('ArtifactLiveProvider'), 'provider imported and mounted');
  assert.ok(SRC.includes('useArtifactLive'), 'page reads the live store');
});

test('the unseen clear is wired at the modal active-file choke point (AD-9, FR-9)', () => {
  assert.ok(SRC.includes('markActive'), 'markActive clear wire present');
  // The clear fires from the single active-artifact effect, not per surface.
  assert.ok(/markActive\(/.test(SRC), 'markActive is invoked');
});

test('the provider receives the modal active file name so the open doc shows no badge (DD-5)', () => {
  assert.ok(/activeFileName=/.test(SRC), 'active file name passed to the provider');
});

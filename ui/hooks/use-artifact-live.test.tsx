import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ArtifactLiveContext,
  ArtifactLiveProvider,
  useArtifactLive,
  defaultArtifactLiveValue,
} from './use-artifact-live';

test('exports the context, provider, hook, and default value (AD-8)', () => {
  assert.notEqual(ArtifactLiveContext, undefined);
  assert.equal(typeof ArtifactLiveProvider, 'function');
  assert.equal(typeof useArtifactLive, 'function');
});

test('default value exposes artifacts, unseen, activePulse, degraded, and markActive (FR-8, AD-9)', () => {
  assert.ok(Array.isArray(defaultArtifactLiveValue.artifacts));
  assert.ok(defaultArtifactLiveValue.unseen instanceof Set);
  assert.ok(defaultArtifactLiveValue.activePulse instanceof Set);
  assert.equal(defaultArtifactLiveValue.degraded, false);
  assert.equal(typeof defaultArtifactLiveValue.markActive, 'function');
});

test('provider is a Context provider with no new state-management dependency (NFR-9, AD-11)', () => {
  const src = readFileSync(path.join(process.cwd(), 'hooks', 'use-artifact-live.tsx'), 'utf-8');
  assert.ok(src.includes('createContext'), 'uses React Context idiom');
  assert.ok(!/from ['"](zustand|redux|jotai|recoil|valtio)['"]/.test(src), 'no new state library imported');
  assert.ok(src.includes('EventSource'), 'owns its own live connection (documented fallback, AD-11)');
  assert.ok(src.includes('fetchArtifactSnapshot'), 'snapshots over REST on connect');
});

test('the artifact_change path feeds live deltas into the store via snapshot diffing (FR-8, FR-9)', () => {
  const src = readFileSync(path.join(process.cwd(), 'hooks', 'use-artifact-live.tsx'), 'utf-8');
  assert.ok(src.includes('diffSnapshots'), 'derives per-file changes by diffing successive snapshots');
  assert.ok(!/void\s+applyChange/.test(src), 'applyChange is wired, not silenced with void');
  assert.ok(!/void\s+setMtimes/.test(src), 'setMtimes is wired, not silenced with void');
  assert.ok(/applyChange\s*\(/.test(src), 'applyChange is actually invoked');
});

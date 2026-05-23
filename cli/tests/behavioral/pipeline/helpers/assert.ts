// cli/tests/behavioral/pipeline/helpers/assert.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

export interface SideFileExpectation { path: string; exists: boolean; contentsMatches?: RegExp | string }
export interface ThreeSurfaceExpectation {
  projectDir: string;
  envelope: Record<string, unknown>;
  state: Record<string, unknown> | 'absent';
  sideFiles: SideFileExpectation[];
}

function partialDeepEqual(actual: unknown, expected: unknown, where: string): void {
  if (expected === null || typeof expected !== 'object') {
    expect(actual, where).toEqual(expected);
    return;
  }
  if (Array.isArray(expected)) {
    expect(actual, where).toEqual(expected);
    return;
  }
  expect(actual, where).toBeTypeOf('object');
  for (const k of Object.keys(expected as Record<string, unknown>)) {
    partialDeepEqual((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k], `${where}.${k}`);
  }
}

export function assertEnvelopeStateSideFiles(actualEnvelope: unknown, expected: ThreeSurfaceExpectation): void {
  partialDeepEqual(actualEnvelope, expected.envelope, 'envelope');
  const statePath = path.join(expected.projectDir, 'state.json');
  if (expected.state === 'absent') {
    expect(fs.existsSync(statePath), 'state.json should be absent').toBe(false);
  } else {
    expect(fs.existsSync(statePath), 'state.json should exist').toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    partialDeepEqual(onDisk, expected.state, 'state');
  }
  for (const sf of expected.sideFiles) {
    const full = path.join(expected.projectDir, sf.path);
    if (sf.exists) {
      expect(fs.existsSync(full), `side-file ${sf.path} should exist`).toBe(true);
      if (sf.contentsMatches !== undefined) {
        const body = fs.readFileSync(full, 'utf8');
        if (sf.contentsMatches instanceof RegExp) expect(body, `${sf.path} contents`).toMatch(sf.contentsMatches);
        else expect(body, `${sf.path} contents`).toContain(sf.contentsMatches);
      }
    } else {
      expect(fs.existsSync(full), `side-file ${sf.path} should be absent`).toBe(false);
    }
  }
}

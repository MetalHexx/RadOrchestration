/**
 * Tests for v6 state discriminator.
 * Run with: npx tsx ui/types/state-discriminator.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isV6State } from '@/types/state';
test('isV6State discriminates orchestration-state-v6', () => {
  assert.strictEqual(isV6State({ $schema: 'orchestration-state-v6' } as any), true);
  assert.strictEqual(isV6State({ $schema: 'orchestration-state-v5' } as any), false);
});

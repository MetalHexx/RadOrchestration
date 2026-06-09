import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('CLI cleanup — deleted surfaces are absent', () => {
  const cliRoot = path.resolve(__dirname, '../..');
  const removed = [
    'src/commands/harness-use.ts',
    'src/commands/harness-list.ts',
    'src/lib/registry.ts',
    'src/commands/where.ts',
    'src/commands/project/find.ts',
    'tests/commands/harness.test.ts',
    'tests/lib/registry.test.ts',
    'tests/lib/install-json-migration.test.ts',
    'tests/commands/where.test.ts',
    'tests/commands/project/find.test.ts',
  ];
  for (const rel of removed) {
    it(`${rel} is removed`, () => {
      expect(existsSync(path.join(cliRoot, rel))).toBe(false);
    });
  }
});

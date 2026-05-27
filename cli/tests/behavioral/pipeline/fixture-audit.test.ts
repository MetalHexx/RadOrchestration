import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const eventsDir = path.resolve(__dirname, 'events');

// Audit assertion: no behavioral file asserts on a step node reading
// `not_started` immediately after a code path that called processEvent
// with the predecessor's completion event. Approximated by scanning for
// `expect(...nodes.<id>.status).toBe('not_started')` lines and requiring
// any such line to have an explicit "// seed:" tag earmarking it as a
// pre-signal scaffold.
describe('fixture audit — predecessor-completed assertions match new contract', () => {
  for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith('.behavioral.test.ts'))) {
    it(`${file} has no bare not_started assertions after a completion event`, () => {
      const body = fs.readFileSync(path.join(eventsDir, file), 'utf8');
      const offenders: string[] = [];
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]!;
        if (/expect\([^)]*\.status\)\.toBe\(['"]not_started['"]\)/.test(l) && !/\/\/\s*seed:/.test(l)) {
          offenders.push(`${file}:${i + 1}: ${l.trim()}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

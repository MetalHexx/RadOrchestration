import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEXT_ACTIONS, EVENTS } from '../lib/constants.js';
import type { PipelineResult } from '../lib/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolved base directories (relative to this test file's location)
const libDir = path.resolve(__dirname, '../lib');
const testsDir = path.resolve(__dirname, '.');
const referencesDir = path.resolve(__dirname, '../../references');

/**
 * Recursively collect all files matching the given extension under a directory.
 */
function collectFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { recursive: true }) as string[];
  return entries
    .filter((e) => typeof e === 'string' && e.endsWith(ext))
    .map((e) => path.join(dir, e));
}

/**
 * Strip single-line and block comments from TypeScript source.
 * Preserves newlines so line numbers remain accurate.
 */
function stripComments(source: string): string {
  // Replace block comments — preserve newlines inside them
  let result = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // Replace single-line comments
  result = result.replace(/\/\/[^\n]*/g, '');
  return result;
}

// ── 1. Stale reference scan ──────────────────────────────────────────────────

describe('Stale reference scan', () => {
  const tsFiles = [
    ...collectFiles(libDir, '.ts'),
    // Exclude this file itself — it necessarily contains the search literal
    ...collectFiles(testsDir, '.ts').filter(
      (f) => path.basename(f) !== 'static-compliance.test.ts',
    ),
  ];
  const mdFiles = collectFiles(referencesDir, '.md');
  const allFiles = [...tsFiles, ...mdFiles];

  it('has files to scan', () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('zero files contain the string "scripts-v5/"', () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('scripts-v5/')) {
        violations.push(path.relative(path.resolve(__dirname, '../..'), file));
      }
    }
    expect(
      violations,
      `Stale "scripts-v5/" references found in:\n${violations.map((v) => `  ${v}`).join('\n')}`,
    ).toHaveLength(0);
  });
});

// ── 2. any type audit ────────────────────────────────────────────────────────

describe('any type audit', () => {
  // Scan all lib files except types.ts
  const libFiles = collectFiles(libDir, '.ts').filter(
    (f) => path.basename(f) !== 'types.ts',
  );

  // Matches explicit `any` type annotations: `: any`, `<any>`, `as any`, `any[]`
  const anyPattern = /:\s*any\b|<any>|\bas\s+any\b|\bany\[\]/g;

  it('finds core engine module files to audit', () => {
    expect(libFiles.length).toBeGreaterThan(0);
  });

  it('zero explicit any annotations in core engine modules', () => {
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of libFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const stripped = stripComments(source);
      const lines = stripped.split('\n');
      lines.forEach((line, i) => {
        anyPattern.lastIndex = 0; // reset stateful regex
        if (anyPattern.test(line)) {
          violations.push({ file: path.basename(file), line: i + 1, text: line.trim() });
        }
      });
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${v.file}:${v.line}: ${v.text}`)
        .join('\n');
      expect.fail(`Found ${violations.length} explicit any annotation(s):\n${details}`);
    }

    expect(violations).toHaveLength(0);
  });
});

// ── 3. Action count freeze ───────────────────────────────────────────────────

describe('Action count freeze', () => {
  it('NEXT_ACTIONS has exactly 18 keys', () => {
    expect(Object.keys(NEXT_ACTIONS)).toHaveLength(18);
  });
});

// ── 4. Event count freeze ────────────────────────────────────────────────────

describe('Event count freeze', () => {
  it('EVENTS has exactly 32 keys', () => {
    expect(Object.keys(EVENTS)).toHaveLength(32);
  });
});

// ── 5. PipelineResult shape ──────────────────────────────────────────────────

describe('PipelineResult shape', () => {
  // Compile-time verification via `satisfies` — TypeScript will reject this
  // block if PipelineResult's shape no longer matches these fields.
  const _minimalDummy = {
    success: true,
    action: null as string | null,
    context: {} as Record<string, unknown>,
    mutations_applied: [] as string[],
    orchRoot: '/path/to/root',
  } satisfies PipelineResult;

  const _withOptionalError = {
    success: false,
    action: 'display_halted',
    context: {},
    mutations_applied: [],
    orchRoot: '/path/to/root',
    error: { message: 'Something failed', event: 'task_completed' },
  } satisfies PipelineResult;

  const _withFullError = {
    success: false,
    action: null,
    context: {},
    mutations_applied: [],
    orchRoot: '/path/to/root',
    error: { message: 'Bad field', event: 'task_completed', field: 'phase' },
  } satisfies PipelineResult;

  // Required (non-optional) fields
  const requiredKeys = [
    'success',
    'action',
    'context',
    'mutations_applied',
    'orchRoot',
  ] as const;

  for (const key of requiredKeys) {
    it(`has required field '${key}'`, () => {
      expect(_minimalDummy).toHaveProperty(key);
    });
  }

  it('action field accepts null', () => {
    expect(_minimalDummy.action).toBeNull();
  });

  it('error is optional — absent when not provided', () => {
    expect(Object.prototype.hasOwnProperty.call(_minimalDummy, 'error')).toBe(false);
  });

  it('error is present when provided', () => {
    expect(_withOptionalError).toHaveProperty('error');
    expect(_withOptionalError.error).toMatchObject({
      message: expect.any(String),
      event: expect.any(String),
    });
  });

  it('error.field is optional within error', () => {
    expect(_withOptionalError.error).not.toHaveProperty('field');
    expect(_withFullError.error).toHaveProperty('field', 'phase');
  });
});

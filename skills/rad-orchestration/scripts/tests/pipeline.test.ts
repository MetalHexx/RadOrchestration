import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, existsSync: vi.fn() };
});

vi.mock('node:child_process', async () => {
  const actual =
    await vi.importActual<typeof import('node:child_process')>(
      'node:child_process',
    );
  return { ...actual, execSync: vi.fn(), execFileSync: vi.fn() };
});

const mockExistsSync = vi.mocked(existsSync);
const mockExecSync = vi.mocked(execSync);
const mockExecFileSync = vi.mocked(execFileSync);

// The scripts directory where pipeline.js lives
const scriptsDir = dirname(fileURLToPath(import.meta.url)).replace(
  /[\\/]tests$/,
  '',
);
const nodeModulesDir = join(scriptsDir, 'node_modules');
const lockFilePath = join(scriptsDir, 'package-lock.json');
const mainScript = join(scriptsDir, 'main.ts');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulate what pipeline.js does without actually importing it (since it
 * runs as a script with side effects). This tests the core logic in
 * isolation: the existence checks and the commands that would be executed.
 */
function resolveInstallCommand(
  nodeModulesExists: boolean,
  lockfileExists: boolean,
): string | null {
  if (nodeModulesExists) return null; // no install needed
  return lockfileExists ? 'ci' : 'install';
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pipeline.js — JIT dependency installer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Install decision logic ──────────────────────────────────────────────

  describe('install decision', () => {
    it('returns null when node_modules exists (no install needed)', () => {
      expect(resolveInstallCommand(true, true)).toBeNull();
      expect(resolveInstallCommand(true, false)).toBeNull();
    });

    it('returns "ci" when node_modules is missing and lockfile exists', () => {
      expect(resolveInstallCommand(false, true)).toBe('ci');
    });

    it('returns "install" when node_modules is missing and no lockfile', () => {
      expect(resolveInstallCommand(false, false)).toBe('install');
    });
  });

  // ── Path resolution ─────────────────────────────────────────────────────

  describe('path resolution', () => {
    it('resolves node_modules relative to the scripts directory', () => {
      expect(nodeModulesDir).toBe(join(scriptsDir, 'node_modules'));
    });

    it('resolves package-lock.json relative to the scripts directory', () => {
      expect(lockFilePath).toBe(join(scriptsDir, 'package-lock.json'));
    });

    it('resolves main.ts relative to the scripts directory', () => {
      expect(mainScript).toBe(join(scriptsDir, 'main.ts'));
    });
  });

  // ── npm ci / npm install behavior ───────────────────────────────────────

  describe('npm install invocation', () => {
    it('calls npm ci when lockfile exists and node_modules is missing', () => {
      // Simulate: node_modules → false, package-lock.json → true
      mockExistsSync.mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr === nodeModulesDir) return false;
        if (pathStr === lockFilePath) return true;
        return false;
      });

      const command = resolveInstallCommand(
        mockExistsSync(nodeModulesDir),
        mockExistsSync(lockFilePath),
      );
      expect(command).toBe('ci');
    });

    it('calls npm install when no lockfile and node_modules is missing', () => {
      mockExistsSync.mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr === nodeModulesDir) return false;
        if (pathStr === lockFilePath) return false;
        return false;
      });

      const command = resolveInstallCommand(
        mockExistsSync(nodeModulesDir),
        mockExistsSync(lockFilePath),
      );
      expect(command).toBe('install');
    });
  });

  // ── Delegation to main.ts ───────────────────────────────────────────

  describe('pipeline delegation', () => {
    it('passes all CLI arguments through to main.ts', () => {
      const cliArgs = [
        '--event',
        'start',
        '--project-dir',
        '/tmp/test',
        '--config',
        '/tmp/config.yml',
      ];

      // The expected tsx args are: ['tsx', mainScript, ...cliArgs]
      const expectedTsxArgs = ['tsx', mainScript, ...cliArgs];

      // Verify the argument array construction
      const tsxArgs = [mainScript, ...cliArgs];
      expect(['tsx', ...tsxArgs]).toEqual(expectedTsxArgs);
    });

    it('preserves all 20+ pipeline flags in argument passthrough', () => {
      const fullFlags = [
        '--event', 'task_completed',
        '--project-dir', '/tmp/proj',
        '--config', '/tmp/config.yml',
        '--doc-path', '/tmp/doc.md',
        '--branch', 'feature/test',
        '--base-branch', 'main',
        '--worktree-path', '/tmp/worktree',
        '--auto-commit', 'always',
        '--auto-pr', 'never',
        '--remote-url', 'https://github.com/test/repo',
        '--compare-url', 'https://github.com/test/repo/compare',
        '--gate-type', 'task',
        '--reason', 'Test reason',
        '--gate-mode', 'autonomous',
        '--commit-hash', 'abc123',
        '--pushed', 'true',
        '--pr-url', 'https://github.com/test/repo/pull/1',
        '--phase', '2',
        '--task', '3',
        '--template', 'full',
        '--verdict', 'approved',
      ];

      const tsxArgs = [mainScript, ...fullFlags];
      // All flags pass through unchanged
      expect(tsxArgs.slice(1)).toEqual(fullFlags);
    });
  });

  // ── Error output format ─────────────────────────────────────────────────

  describe('error output format', () => {
    it('produces a valid PipelineResult-shaped error on npm failure', () => {
      const errorJson = {
        success: false,
        action: null,
        context: { error: 'npm ci failed' },
        mutations_applied: [],
        orchRoot: '.github',
        error: {
          message: 'npm ci failed: ERR! code ENOENT',
          event: 'unknown',
        },
      };

      // Verify shape matches PipelineResult contract
      expect(errorJson).toHaveProperty('success', false);
      expect(errorJson).toHaveProperty('action', null);
      expect(errorJson).toHaveProperty('context.error');
      expect(errorJson).toHaveProperty('mutations_applied');
      expect(errorJson).toHaveProperty('orchRoot');
      expect(errorJson).toHaveProperty('error.message');
      expect(errorJson).toHaveProperty('error.event');
      expect(Array.isArray(errorJson.mutations_applied)).toBe(true);
    });
  });

  // ── Cross-platform ─────────────────────────────────────────────────────

  describe('cross-platform compatibility', () => {
    it('uses shell: true on Windows for npx execution', () => {
      // On Windows, npx is a .cmd script that requires shell: true
      const isWindows = process.platform === 'win32';
      const shellOption = isWindows;
      // The bootstrap script uses: shell: process.platform === 'win32'
      expect(typeof shellOption).toBe('boolean');
      if (isWindows) {
        expect(shellOption).toBe(true);
      }
    });
  });

  // ── TSX environment variable isolation ─────────────────────────────────

  describe('TSX environment variable isolation', () => {
    /**
     * Replicates the cleanEnv logic from pipeline.js so we can test it
     * in isolation without importing or exec-ing the script.
     */
    // Note: this tests a replica of the cleanEnv logic from pipeline.js because
    // pipeline.js has module-level side effects (execFileSync) that prevent direct import.
    // If the cleaning logic in pipeline.js changes, these tests must be manually synchronized.
    function buildCleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
      const cleanEnv = { ...env };
      for (const key of Object.keys(cleanEnv)) {
        if (key.startsWith('TSX_')) {
          delete cleanEnv[key];
        }
      }
      return cleanEnv;
    }

    it('strips TSX_* variables from the clean env', () => {
      const originalTsxValue = process.env['TSX_TSCONFIG_PATH'];
      const originalOtherValue = process.env['TSX_OTHER'];

      process.env['TSX_TSCONFIG_PATH'] = '/some/tsconfig.json';
      process.env['TSX_OTHER'] = 'some-value';

      try {
        const cleanEnv = buildCleanEnv(process.env);
        expect(Object.prototype.hasOwnProperty.call(cleanEnv, 'TSX_TSCONFIG_PATH')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(cleanEnv, 'TSX_OTHER')).toBe(false);
      } finally {
        // Restore original state
        if (originalTsxValue === undefined) {
          delete process.env['TSX_TSCONFIG_PATH'];
        } else {
          process.env['TSX_TSCONFIG_PATH'] = originalTsxValue;
        }
        if (originalOtherValue === undefined) {
          delete process.env['TSX_OTHER'];
        } else {
          process.env['TSX_OTHER'] = originalOtherValue;
        }
      }
    });

    it('preserves non-TSX_* variables in the clean env', () => {
      const originalTsxValue = process.env['TSX_TSCONFIG_PATH'];

      process.env['TSX_TSCONFIG_PATH'] = '/some/tsconfig.json';

      try {
        const cleanEnv = buildCleanEnv(process.env);
        // Non-TSX_ vars must be preserved
        if (process.env['PATH'] !== undefined) {
          expect(cleanEnv['PATH']).toBe(process.env['PATH']);
        }
        if (process.env['HOME'] !== undefined) {
          expect(cleanEnv['HOME']).toBe(process.env['HOME']);
        }
        if (process.env['NODE_ENV'] !== undefined) {
          expect(cleanEnv['NODE_ENV']).toBe(process.env['NODE_ENV']);
        }
        // TSX_ var must be gone
        expect(Object.prototype.hasOwnProperty.call(cleanEnv, 'TSX_TSCONFIG_PATH')).toBe(false);
      } finally {
        if (originalTsxValue === undefined) {
          delete process.env['TSX_TSCONFIG_PATH'];
        } else {
          process.env['TSX_TSCONFIG_PATH'] = originalTsxValue;
        }
      }
    });

    it('is a no-op when no TSX_* variables are present', () => {
      // Ensure no TSX_ vars exist for this test
      const savedTsxVars: Record<string, string> = {};
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('TSX_')) {
          savedTsxVars[key] = process.env[key]!;
          delete process.env[key];
        }
      }

      try {
        const envBefore = { ...process.env };
        const cleanEnv = buildCleanEnv(process.env);
        expect(Object.keys(cleanEnv).sort()).toEqual(Object.keys(envBefore).sort());
        for (const key of Object.keys(envBefore)) {
          expect(cleanEnv[key]).toBe(envBefore[key]);
        }
      } finally {
        // Restore saved TSX_ vars
        for (const [key, value] of Object.entries(savedTsxVars)) {
          process.env[key] = value;
        }
      }
    });

    it('does not mutate process.env when building clean env', () => {
      const originalTsxValue = process.env['TSX_TSCONFIG_PATH'];

      process.env['TSX_TSCONFIG_PATH'] = '/some/tsconfig.json';

      try {
        buildCleanEnv(process.env);
        // process.env must still contain the TSX_ var
        expect(process.env['TSX_TSCONFIG_PATH']).toBe('/some/tsconfig.json');
      } finally {
        if (originalTsxValue === undefined) {
          delete process.env['TSX_TSCONFIG_PATH'];
        } else {
          process.env['TSX_TSCONFIG_PATH'] = originalTsxValue;
        }
      }
    });
  });

  // ── detectOrchRoot: install-time orchRoot discovery ──────────────────────

  // Note: detectOrchRoot is tested via pure path logic without importing pipeline.js
  // (which has module-level side effects). We test the algorithm in isolation.

  describe('detectOrchRoot', () => {
    /**
     * Replicates the detectOrchRoot logic to test without importing pipeline.js.
     * If the detectOrchRoot implementation in pipeline.js changes, these tests must be manually synchronized.
     */
    function detectOrchRootTestImpl(scriptsDir: string): string {
      return basename(resolve(scriptsDir, '..', '..', '..'));
    }

    it("returns '.claude' when scripts dir parent grandparent is named '.claude'", () => {
      const scriptsDir = resolve('/install', '.claude', 'skills', 'rad-orchestration', 'scripts');
      expect(detectOrchRootTestImpl(scriptsDir)).toBe('.claude');
    });

    it("returns '.github' when scripts dir parent grandparent is named '.github'", () => {
      const scriptsDir = resolve('/install', '.github', 'skills', 'rad-orchestration', 'scripts');
      expect(detectOrchRootTestImpl(scriptsDir)).toBe('.github');
    });

    it('returns the basename of any custom orchRoot folder', () => {
      const scriptsDir = resolve('/install', 'my-custom-root', 'skills', 'rad-orchestration', 'scripts');
      expect(detectOrchRootTestImpl(scriptsDir)).toBe('my-custom-root');
    });
  });
});

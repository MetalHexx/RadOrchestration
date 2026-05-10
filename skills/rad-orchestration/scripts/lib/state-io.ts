import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import type { PipelineState, OrchestrationConfig } from './types.js';

// ── Private helpers ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: OrchestrationConfig = {
  system: {
    orch_root: '.claude', // authored-install-default — overwritten on first readConfig() call
  },
  projects: {
    base_path: '',
    naming: 'SCREAMING_CASE',
  },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'ask',
    after_final_review: true,
  },
  source_control: {
    auto_commit: 'ask',
    auto_pr: 'ask',
    provider: 'github',
  },
  default_template: 'extra-high',
};

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];
    if (
      srcVal !== null &&
      srcVal !== undefined &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      tgtVal !== undefined &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>,
      );
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result;
}

function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Expands the leading `~/` in a `projects.base_path` value at read time.
 *
 * The plugin emit ships `base_path: ~/.radorch/projects/` as a portable,
 * cross-platform default (FR-12, FR-13). At read time:
 *
 *   - `~/.radorch/...` expands against `env.RADORCH_HOME` when set, or
 *     `os.homedir() + '/.radorch'` otherwise. This lets operators relocate
 *     the radorch home (tests, alternate accounts, isolated installs) by
 *     setting `RADORCH_HOME` without editing config.
 *   - Bare `~/<other>` expands against `os.homedir()`.
 *   - Anything else (absolute paths, relative paths, empty string) returns
 *     unchanged — preserves the legacy installer's existing behavior.
 *
 * Pure: no filesystem access, no `process.env` capture beyond the explicit
 * `env` argument. Defaults `env` to `process.env` for callsite ergonomics.
 */
export function resolveBasePath(
  raw: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!raw) return raw;
  if (raw.startsWith('~/.radorch')) {
    const radorchHome = env.RADORCH_HOME || path.join(os.homedir(), '.radorch');
    const remainder = raw.slice('~/.radorch'.length).replace(/^[/\\]+/, '');
    // Normalize trailing separators to match path.join's canonical output
    // (no trailing slash) — callers compose further path segments.
    const joined = remainder ? path.join(radorchHome, remainder) : radorchHome;
    return joined.replace(/[/\\]+$/, '');
  }
  if (raw.startsWith('~/') || raw.startsWith('~\\')) {
    const remainder = raw.slice(2).replace(/^[/\\]+/, '');
    const joined = remainder ? path.join(os.homedir(), remainder) : os.homedir();
    return joined.replace(/[/\\]+$/, '');
  }
  return raw;
}

export function readState(projectDir: string): PipelineState | null {
  const statePath = path.join(projectDir, 'state.json');
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(raw) as PipelineState;
  } catch (err: unknown) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

export function writeState(projectDir: string, state: PipelineState): void {
  fs.mkdirSync(projectDir, { recursive: true });
  const statePath = path.join(projectDir, 'state.json');
  const tmpPath = path.join(projectDir, 'state.json.tmp');
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, statePath);
  } catch (err) {
    fs.rmSync(tmpPath, { force: true });
    throw err;
  }
}

export function readConfig(configPath?: string): OrchestrationConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, unknown>;

  if (!configPath) {
    return base as unknown as OrchestrationConfig;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return base as unknown as OrchestrationConfig;
    }
    return deepMerge(base, parsed as Record<string, unknown>) as unknown as OrchestrationConfig;
  } catch (err: unknown) {
    if (isEnoent(err)) return base as unknown as OrchestrationConfig;
    throw err;
  }
}

export function readDocument(
  docPath: string,
): { frontmatter: Record<string, unknown>; content: string } | null {
  let raw: string;
  try {
    raw = fs.readFileSync(docPath, 'utf-8');
  } catch (err: unknown) {
    if (isEnoent(err)) return null;
    throw err;
  }

  // Match standard YAML frontmatter: starts with ---, ends with \n---
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: raw };
  }

  const frontmatterText = match[1] ?? '';
  const content = match[2] ?? '';
  const parsed = yaml.load(frontmatterText);
  const frontmatter =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    frontmatter,
    content,
  };
}

export function ensureDirectories(projectDir: string): void {
  fs.mkdirSync(projectDir, { recursive: true });
  for (const subdir of ['phases', 'tasks', 'reports', 'reviews']) {
    fs.mkdirSync(path.join(projectDir, subdir), { recursive: true });
  }
}

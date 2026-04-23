import { readFile, readdir, stat, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import type { AnyProjectState } from '@/types/state';
import { isV5State } from '@/types/state';
import type { OrchestrationConfig } from '@/types/config';
import type { ProjectSummary } from '@/types/components';

import { resolveBasePath, resolveProjectDir } from '@/lib/path-resolver';
import { parseYaml } from '@/lib/yaml-parser';
import { derivePlanningStatus, deriveExecutionStatus } from '@/lib/status-derivation';

/**
 * Resolve the absolute path to orchestration.yml.
 * Extracted from readConfig() so the write path uses the same logic.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Absolute path to orchestration.yml
 */
export function getConfigPath(workspaceRoot: string): string {
  const bootstrapRoot = process.env.ORCH_ROOT || '.claude';
  return path.resolve(workspaceRoot, bootstrapRoot, 'skills', 'orchestration', 'config', 'orchestration.yml');
}

/**
 * Read and parse orchestration.yml from the workspace root.
 *
 * Bootstrap strategy:
 * 1. Check the `ORCH_ROOT` environment variable for the orchestration root folder name.
 * 2. Fall back to `'.claude'` when `ORCH_ROOT` is unset or empty.
 * 3. Read `orchestration.yml` from `{bootstrapRoot}/skills/orchestration/config/`.
 * 4. Use `system.orch_root` from the loaded config for subsequent operations (downstream responsibility).
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Parsed OrchestrationConfig
 * @throws If orchestration.yml does not exist or is invalid YAML
 */
export async function readConfig(workspaceRoot: string): Promise<OrchestrationConfig> {
  const configPath = getConfigPath(workspaceRoot);
  const content = await readFile(configPath, 'utf-8');
  return parseYaml<OrchestrationConfig>(content);
}

/**
 * Read orchestration.yml and return both parsed config and raw YAML string.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Object with parsed config and raw YAML string
 * @throws If orchestration.yml does not exist or is invalid YAML
 */
export async function readConfigWithRaw(workspaceRoot: string): Promise<{
  config: OrchestrationConfig;
  rawYaml: string;
}> {
  const configPath = getConfigPath(workspaceRoot);
  const rawYaml = await readFile(configPath, 'utf-8');
  const config = parseYaml<OrchestrationConfig>(rawYaml);
  return { config, rawYaml };
}

/**
 * Write content to orchestration.yml atomically (write to temp file, then rename).
 * The temp file is created in the same directory as orchestration.yml to ensure
 * same-filesystem rename semantics.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param content - YAML string to write
 * @throws If the write or rename operation fails (e.g., permission denied, disk full)
 */
export async function writeConfig(workspaceRoot: string, content: string): Promise<void> {
  const configPath = getConfigPath(workspaceRoot);
  const configDir = path.dirname(configPath);
  const suffix = randomBytes(8).toString('hex');
  const tmpPath = path.join(configDir, `.orchestration.yml.tmp.${suffix}`);

  await writeFile(tmpPath, content, 'utf-8');
  try {
    await rename(tmpPath, configPath);
  } catch (renameErr) {
    try {
      await unlink(tmpPath);
    } catch {
      // best-effort cleanup
    }
    throw renameErr;
  }
}

/**
 * Resolve the effective orchestration root folder name from a loaded config.
 *
 * Returns `config.system.orch_root` when present, otherwise defaults to `'.claude'`.
 * This is the canonical way for downstream consumers (e.g., API routes) to obtain
 * the orchestration root after a config has been loaded.
 *
 * @param config - A parsed OrchestrationConfig object
 * @returns The effective orchestration root folder name (e.g., `'.claude'`, `'.agents'`)
 */
export function resolveOrchRoot(config: OrchestrationConfig): string {
  return config.system?.orch_root ?? '.claude';
}

/**
 * Discover all projects under the base path. Returns summaries with tier info.
 * Each subdirectory under basePath is treated as a project.
 * If state.json exists and is parseable, extract the pipeline tier.
 * If state.json is missing, mark hasState: false.
 * If state.json is malformed, mark hasMalformedState: true with errorMessage.
 *
 * Reads run in parallel via `Promise.all` with a per-project try/catch so a
 * single malformed state.json cannot poison the entire list. Result order
 * matches `readdir`'s directory-entry order (stable per filesystem). The
 * sequential implementation became the dominant cost on large workspaces
 * once Iter 5 grew state.json from ~2 KB to ~50–200 KB per project.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Base path from orchestration.yml (relative or absolute)
 * @returns Array of ProjectSummary objects (one per directory under basePath)
 */
export async function discoverProjects(
  workspaceRoot: string,
  basePath: string
): Promise<ProjectSummary[]> {
  const absBasePath = resolveBasePath(workspaceRoot, basePath);
  const entries = await readdir(absBasePath, { withFileTypes: true });

  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<ProjectSummary> => {
        const projectName = entry.name;
        const projectDir = resolveProjectDir(workspaceRoot, basePath, projectName);
        const statePath = path.join(projectDir, 'state.json');

        const brainstormingFile = `${projectName}-BRAINSTORMING.md`;
        const brainstormingAbsPath = path.join(projectDir, brainstormingFile);
        // Initialised to false; resolved inside the try so any future exception
        // in fileExists is contained by the per-project catch below.
        let hasBrainstorming = false;

        try {
          hasBrainstorming = await fileExists(brainstormingAbsPath);
          const raw = await readFile(statePath, 'utf-8');
          const state: AnyProjectState = JSON.parse(raw);
          if (isV5State(state)) {
            return {
              name: projectName,
              tier: state.graph.status === 'completed' ? 'complete' : state.pipeline.current_tier,
              hasState: true,
              hasMalformedState: false,
              brainstormingDoc: hasBrainstorming ? brainstormingFile : null,
              planningStatus: derivePlanningStatus(state.graph.nodes),
              executionStatus: deriveExecutionStatus(state.graph.status, state.graph.nodes),
              lastUpdated: state.project?.updated,
              schemaVersion: 'v5',
              graphStatus: state.graph.status,
            };
          }
          return {
            name: projectName,
            tier: state.pipeline.current_tier,
            hasState: true,
            hasMalformedState: false,
            brainstormingDoc: hasBrainstorming ? brainstormingFile : null,
            planningStatus: state.planning?.status,
            executionStatus: state.execution?.status,
            lastUpdated: state.project?.updated,
            schemaVersion: 'v4',
            graphStatus: 'not_initialized',
          };
        } catch (err) {
          const isNotFound =
            err instanceof Error &&
            'code' in err &&
            (err as NodeJS.ErrnoException).code === 'ENOENT';

          if (isNotFound) {
            return {
              name: projectName,
              tier: 'not_initialized',
              hasState: false,
              hasMalformedState: false,
              brainstormingDoc: hasBrainstorming ? brainstormingFile : null,
              graphStatus: 'not_initialized',
            };
          }
          return {
            name: projectName,
            tier: 'not_initialized',
            hasState: true,
            hasMalformedState: true,
            errorMessage:
              err instanceof Error ? err.message : 'Unknown parse error',
            brainstormingDoc: hasBrainstorming ? brainstormingFile : null,
            graphStatus: 'not_initialized',
          };
        }
      }),
  );

  return summaries;
}

/**
 * Read and parse a project's state.json. Returns null if file does not exist.
 *
 * @param projectDir - Absolute path to the project directory
 * @returns Parsed ProjectState, or null if state.json does not exist
 * @throws If state.json exists but is malformed JSON
 */
export async function readProjectState(
  projectDir: string
): Promise<AnyProjectState | null> {
  const statePath = path.join(projectDir, 'state.json');
  try {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as AnyProjectState;
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) return null;
    throw err;
  }
}

/**
 * Read a document file and return its raw content.
 *
 * @param absolutePath - Absolute filesystem path to the document
 * @returns Raw file content as a string
 * @throws If file does not exist
 */
export async function readDocument(absolutePath: string): Promise<string> {
  return readFile(absolutePath, 'utf-8');
}

/**
 * Check if a file exists at the given absolute path.
 *
 * @param absolutePath - Absolute filesystem path to check
 * @returns true if file exists, false otherwise
 */
export async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Directory names skipped by `listProjectFiles`. A project that contains its
 * own build scaffold (e.g. a Next.js app with installed npm deps) would
 * otherwise pull hundreds of `.md` files out of `node_modules` into the UI's
 * "Other Docs" list, and walking those trees on every selection is slow.
 */
const LIST_IGNORED_DIR_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  '.next',
  '.cache',
]);

/**
 * Recursively list all .md files in a project directory.
 * Returns paths relative to the project directory using forward slashes.
 * Does not follow symlinks. Skips entries containing "..".
 *
 * @param projectDir - Absolute path to the project directory
 * @returns Array of relative file paths (e.g., ["PRD.md", "tasks/TASK-P01-T01.md"])
 */
export async function listProjectFiles(projectDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.includes('..')) continue;
      if (entry.isDirectory() && LIST_IGNORED_DIR_NAMES.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(path.relative(projectDir, fullPath).replace(/\\/g, '/'));
      }
    }
  }

  await walk(projectDir);
  return files;
}

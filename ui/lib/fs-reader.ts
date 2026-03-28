import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectState } from '@/types/state';
import type { OrchestrationConfig } from '@/types/config';
import type { ProjectSummary } from '@/types/components';

import { resolveBasePath, resolveProjectDir } from '@/lib/path-resolver';
import { parseYaml } from '@/lib/yaml-parser';

/**
 * Read and parse orchestration.yml from the workspace root.
 *
 * Bootstrap strategy:
 * 1. Check the `ORCH_ROOT` environment variable for the orchestration root folder name.
 * 2. Fall back to `'.github'` when `ORCH_ROOT` is unset or empty.
 * 3. Read `orchestration.yml` from `{bootstrapRoot}/skills/orchestration/config/`.
 * 4. Use `system.orch_root` from the loaded config for subsequent operations (downstream responsibility).
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Parsed OrchestrationConfig
 * @throws If orchestration.yml does not exist or is invalid YAML
 */
export async function readConfig(workspaceRoot: string): Promise<OrchestrationConfig> {
  const bootstrapRoot = process.env.ORCH_ROOT || '.github';
  const configPath = path.join(workspaceRoot, bootstrapRoot, 'skills', 'orchestration', 'config', 'orchestration.yml');
  const content = await readFile(configPath, 'utf-8');
  return parseYaml<OrchestrationConfig>(content);
}

/**
 * Resolve the effective orchestration root folder name from a loaded config.
 *
 * Returns `config.system.orch_root` when present, otherwise defaults to `'.github'`.
 * This is the canonical way for downstream consumers (e.g., API routes) to obtain
 * the orchestration root after a config has been loaded.
 *
 * @param config - A parsed OrchestrationConfig object
 * @returns The effective orchestration root folder name (e.g., `'.github'`, `'.agents'`)
 */
export function resolveOrchRoot(config: OrchestrationConfig): string {
  return config.system?.orch_root ?? '.github';
}

/**
 * Discover all projects under the base path. Returns summaries with tier info.
 * Each subdirectory under basePath is treated as a project.
 * If state.json exists and is parseable, extract the pipeline tier.
 * If state.json is missing, mark hasState: false.
 * If state.json is malformed, mark hasMalformedState: true with errorMessage.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Base path from orchestration.yml (relative or absolute)
 * @returns Array of ProjectSummary objects
 */
export async function discoverProjects(
  workspaceRoot: string,
  basePath: string
): Promise<ProjectSummary[]> {
  const absBasePath = resolveBasePath(workspaceRoot, basePath);
  const entries = await readdir(absBasePath, { withFileTypes: true });
  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectName = entry.name;
    const projectDir = resolveProjectDir(workspaceRoot, basePath, projectName);
    const statePath = path.join(projectDir, 'state.json');

    const brainstormingFile = `${projectName}-BRAINSTORMING.md`;
    const brainstormingAbsPath = path.join(projectDir, brainstormingFile);
    const hasBrainstorming = await fileExists(brainstormingAbsPath);

    try {
      const raw = await readFile(statePath, 'utf-8');
      const state: ProjectState = JSON.parse(raw);
      projects.push({
        name: projectName,
        tier: state.pipeline.current_tier,
        hasState: true,
        hasMalformedState: false,
        brainstormingDoc: hasBrainstorming ? brainstormingFile : null,
        planningStatus: state.planning?.status,
        executionStatus: state.execution?.status,
      });
    } catch (err) {
      // Determine if the file is missing or malformed
      const isNotFound =
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === 'ENOENT';

      if (isNotFound) {
        projects.push({
          name: projectName,
          tier: 'not_initialized',
          hasState: false,
          hasMalformedState: false,
          brainstormingDoc: hasBrainstorming ? brainstormingFile : null,
        });
      } else {
        projects.push({
          name: projectName,
          tier: 'not_initialized',
          hasState: true,
          hasMalformedState: true,
          errorMessage:
            err instanceof Error ? err.message : 'Unknown parse error',
          brainstormingDoc: hasBrainstorming ? brainstormingFile : null,
        });
      }
    }
  }

  return projects;
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
): Promise<ProjectState | null> {
  const statePath = path.join(projectDir, 'state.json');
  try {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as ProjectState;
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

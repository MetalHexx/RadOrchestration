import path from 'node:path';
import {
  readFile,
  readdir,
  writeFile,
  rename,
  unlink,
  access,
  constants,
} from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

import { parseYaml } from '@/lib/yaml-parser';
import { resolveOrchRoot } from '@/lib/fs-reader';
import type { OrchestrationConfig } from '@/types/config';
import type { TemplateSummary, TemplateDefinition } from '@/types/template';

/**
 * Resolve the absolute path to the global templates directory.
 * Path: {workspaceRoot}/{orchRoot}/skills/rad-orchestration/templates/
 */
export function resolveTemplateDir(workspaceRoot: string, config: OrchestrationConfig): string {
  return path.join(workspaceRoot, resolveOrchRoot(config), 'skills', 'rad-orchestration', 'templates');
}

/**
 * Validate a template ID to prevent path traversal.
 * Must match /^[a-zA-Z0-9_-]+$/ — no slashes, dots, or spaces.
 */
export function isValidTemplateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * List all .yml files in the templates directory and return their metadata.
 */
export async function listTemplateFiles(templateDir: string): Promise<TemplateSummary[]> {
  const entries = await readdir(templateDir);
  const results: TemplateSummary[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.yml')) continue;

    const id = entry.slice(0, -4); // strip .yml
    try {
      const content = await readFile(path.join(templateDir, entry), 'utf-8');
      const definition = parseYaml<TemplateDefinition>(content);
      const summary: TemplateSummary = {
        id,
        description: definition.template?.description ?? '',
        version: definition.template?.version ?? '',
      };
      if (definition.template?.status !== undefined) {
        summary.status = definition.template.status;
      }
      results.push(summary);
    } catch (err) {
      console.warn('listTemplateFiles: skipping unparseable file', entry, err instanceof Error ? err.message : err);
    }
  }

  return results;
}

/**
 * Read a single template file and return its raw YAML and parsed definition.
 * Returns null if the file does not exist.
 */
export async function readTemplateFile(
  templateDir: string,
  id: string
): Promise<{ rawYaml: string; definition: TemplateDefinition } | null> {
  const filePath = path.join(templateDir, `${id}.yml`);
  try {
    const rawYaml = await readFile(filePath, 'utf-8');
    const definition = parseYaml<TemplateDefinition>(rawYaml);
    return { rawYaml, definition };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Write a template file atomically (temp file + rename).
 */
export async function writeTemplateFile(
  templateDir: string,
  id: string,
  content: string
): Promise<void> {
  const suffix = randomBytes(8).toString('hex');
  const tmpPath = path.join(templateDir, `.${id}.yml.tmp.${suffix}`);
  const destPath = path.join(templateDir, `${id}.yml`);

  await writeFile(tmpPath, content, 'utf-8');
  try {
    await rename(tmpPath, destPath);
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
 * Check whether a template file exists in the directory.
 */
export async function templateFileExists(
  templateDir: string,
  id: string
): Promise<boolean> {
  try {
    await access(path.join(templateDir, `${id}.yml`), constants.F_OK);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

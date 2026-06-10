import path from 'node:path';
import fs from 'node:fs';
import { UserError } from '../framework/errors.js';
import { userDataPaths } from './paths.js';
import { parseYaml } from './yaml.js';

/**
 * Read a project's declared repos and project-type from its master-plan
 * frontmatter. Shared default implementation injected by the `worktree create`,
 * `worktree remove`, and `source-control init` commands (DRY — previously
 * triplicated, see project-repos de-duplication cleanup).
 *
 * Resolution: locate `<PROJECT>-MASTER-PLAN*.md` (then any `*MASTER-PLAN*.md`)
 * under the project data dir, parse its YAML frontmatter, and return the
 * `repos:` list plus the `project-type`. Throws a UserError when no master plan,
 * no frontmatter, or no repos are found.
 *
 * Note: this does NOT reject side-projects — the `worktree create` call site
 * layers its own side-project guard on top, because `worktree remove` and
 * `source-control init` legitimately operate on side-projects.
 */
export function readProjectReposDefault(project: string): { repos: string[]; projectType: 'standard' | 'side-project' } {
  const projectDir = path.join(userDataPaths().projects, project);
  // Find master plan — match the convention: <PROJECT>-MASTER-PLAN*.md
  let masterPlanPath: string | null = null;
  try {
    const entries = fs.readdirSync(projectDir);
    for (const e of entries) {
      if (e.toUpperCase().startsWith(project.toUpperCase() + '-MASTER-PLAN') && e.endsWith('.md')) {
        masterPlanPath = path.join(projectDir, e);
        break;
      }
    }
    // Fallback: any file matching MASTER-PLAN pattern
    if (!masterPlanPath) {
      for (const e of entries) {
        if (e.toUpperCase().includes('MASTER-PLAN') && e.endsWith('.md')) {
          masterPlanPath = path.join(projectDir, e);
          break;
        }
      }
    }
  } catch { /* ignore — will throw below */ }

  if (!masterPlanPath) {
    throw new UserError(`No master plan found for project "${project}" in ${projectDir}`);
  }

  const raw = fs.readFileSync(masterPlanPath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new UserError(`Master plan at ${masterPlanPath} has no YAML frontmatter`);
  }
  const fm = parseYaml<Record<string, unknown>>(match[1] ?? '') ?? {};
  const projectType = fm['project-type'] === 'side-project' ? 'side-project' : 'standard';
  const repos = Array.isArray(fm['repos']) ? (fm['repos'] as unknown[]).map(String) : [];
  if (repos.length === 0) {
    throw new UserError(`Master plan for project "${project}" declares no repos.`);
  }
  return { repos, projectType };
}

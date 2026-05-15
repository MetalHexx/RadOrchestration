import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PipelineState, OrchestrationConfig, TemplateResolution } from './types.js';

/**
 * Resolves which template to use.
 * Priority: state.graph.template_id → CLI --template → config.default_template (with sentinel remap) → "extra-high"
 * The sentinel remap applies ONLY to config.default_template:
 *   default → extra-high, quick → low, full → extra-high.
 * state.graph.template_id and CLI --template resolve verbatim (project-local
 * snapshot lookup keeps legacy in-flight projects functional).
 * When default_template is "ask" or empty, fall through to "extra-high".
 */
const CONFIG_SENTINEL_REMAP: Record<string, string> = {
  default: 'extra-high',
  quick: 'low',
  full: 'extra-high',
};

export function resolveTemplateName(
  state: PipelineState | null,
  cliTemplateName: string | undefined,
  config: OrchestrationConfig,
  projectDir: string,
  templatesDir: string,
): TemplateResolution {
  let templateName: string;
  let source: TemplateResolution['source'];

  if (state !== null && state.graph.template_id) {
    templateName = state.graph.template_id;
    source = 'state';
  } else if (cliTemplateName !== undefined && cliTemplateName !== '') {
    templateName = cliTemplateName;
    source = 'cli';
  } else if (config.default_template !== '' && config.default_template !== 'ask') {
    const raw = config.default_template;
    templateName = CONFIG_SENTINEL_REMAP[raw] ?? raw;
    source = 'config';
  } else {
    templateName = 'extra-high';
    source = 'default';
  }

  const { path: templatePath, isProjectLocal } = resolveTemplatePath(templateName, projectDir, templatesDir);

  return { templateName, templatePath, source, isProjectLocal };
}

/**
 * Resolves the file path for a template.
 * Checks project-local {projectDir}/template.yml first, then global {templatesDir}/{name}.yml.
 */
export function resolveTemplatePath(
  templateName: string,
  projectDir: string,
  templatesDir: string,
): { path: string; isProjectLocal: boolean } {
  const projectLocalPath = path.join(projectDir, 'template.yml');
  if (fs.existsSync(projectLocalPath)) {
    return { path: path.resolve(projectLocalPath), isProjectLocal: true };
  }
  return { path: path.join(templatesDir, templateName + '.yml'), isProjectLocal: false };
}

/**
 * Copies the global template YAML into the project directory as template.yml.
 * Creates the project directory if it does not exist.
 */
export function snapshotTemplate(
  globalTemplatePath: string,
  projectDir: string,
): void {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.copyFileSync(globalTemplatePath, path.join(projectDir, 'template.yml'));
}

/**
 * Lists available templates by scanning the global templates directory.
 * Returns template names (filename stems, without .yml extension).
 * Returns empty array if the templates directory does not exist.
 *
 * @param templatesDir - Absolute path to the templates directory, typically
 *   path.join(os.homedir(), '.radorch', 'templates') as resolved by pipeline.ts.
 */
export function listAvailableTemplates(
  templatesDir: string,
): string[] {
  if (!fs.existsSync(templatesDir)) {
    return [];
  }
  const entries = fs.readdirSync(templatesDir);
  return entries
    .filter(entry => entry.endsWith('.yml'))
    .map(entry => entry.slice(0, -4));
}

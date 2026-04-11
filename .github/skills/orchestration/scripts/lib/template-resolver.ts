import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PipelineState, OrchestrationConfig, TemplateResolution } from './types.js';

/**
 * Resolves which template to use.
 * Priority: state.graph.template_id → CLI --template → config.default_template → "full"
 * When default_template is "ask", treat as absent and fall through to "full".
 */
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
    templateName = config.default_template;
    source = 'config';
  } else {
    templateName = 'full';
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
 */
export function listAvailableTemplates(
  orchRoot: string,
): string[] {
  const templatesDir = path.join(orchRoot, 'skills/orchestration/templates/');
  if (!fs.existsSync(templatesDir)) {
    return [];
  }
  const entries = fs.readdirSync(templatesDir);
  return entries
    .filter(entry => entry.endsWith('.yml'))
    .map(entry => entry.slice(0, -4));
}

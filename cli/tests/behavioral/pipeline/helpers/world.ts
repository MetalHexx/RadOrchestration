// cli/tests/behavioral/pipeline/helpers/world.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import type { PathContext, PipelineState, OrchestrationConfig } from '../../../../src/lib/pipeline-engine/types.js';

export interface WorldSpec {
  template: { id: string; body: string };
  state: Partial<PipelineState> | null;
  config: Partial<OrchestrationConfig> & Record<string, unknown>;
  sideFiles: Array<{ path: string; contents: string }>;
}
export interface World {
  projectDir: string;
  configPath: string;
  pathContext: PathContext;
  cleanup: () => void;
}

const DEFAULT_CONFIG: OrchestrationConfig = {
  limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
  human_gates: { after_planning: true, execution_mode: 'task', after_final_review: true },
  source_control: { auto_commit: 'never', auto_pr: 'never' },
  default_template: 'medium',
};

export function buildWorld(spec: WorldSpec): World {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-behavioral-'));
  fs.writeFileSync(path.join(projectDir, 'template.yml'), spec.template.body, 'utf8');
  if (spec.state !== null) {
    fs.writeFileSync(path.join(projectDir, 'state.json'), JSON.stringify(spec.state, null, 2), 'utf8');
  }
  const mergedConfig = { ...DEFAULT_CONFIG, ...spec.config };
  const configPath = path.join(projectDir, 'orchestration.yml');
  fs.writeFileSync(configPath, yaml.dump(mergedConfig), 'utf8');
  for (const f of spec.sideFiles) {
    const full = path.join(projectDir, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents, 'utf8');
  }
  const prevTemplatesEnv = process.env['RADORCH_TEMPLATES_DIR'];
  process.env['RADORCH_TEMPLATES_DIR'] = projectDir;
  const pathContext: PathContext = { scriptsDir: projectDir, templatesDir: projectDir };
  return {
    projectDir,
    configPath,
    pathContext,
    cleanup: () => {
      if (prevTemplatesEnv === undefined) delete process.env['RADORCH_TEMPLATES_DIR'];
      else process.env['RADORCH_TEMPLATES_DIR'] = prevTemplatesEnv;
      fs.rmSync(projectDir, { recursive: true, force: true });
    },
  };
}

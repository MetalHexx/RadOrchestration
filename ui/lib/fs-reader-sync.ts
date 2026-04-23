// ui/lib/fs-reader-sync.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseYaml } from './yaml-parser';

export function readConfigSync(workspaceRoot: string): { projects: { base_path: string } } {
  const bootstrapRoot = process.env.ORCH_ROOT || '.claude';
  const cfgPath = path.join(
    workspaceRoot,
    bootstrapRoot,
    'skills',
    'orchestration',
    'config',
    'orchestration.yml',
  );
  const raw = readFileSync(cfgPath, 'utf-8');
  const parsed = parseYaml<{ projects: { base_path: string } }>(raw);
  return parsed;
}

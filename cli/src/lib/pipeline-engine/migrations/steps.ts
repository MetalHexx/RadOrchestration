import { Ajv } from 'ajv';
import v5Schema from '../schemas/legacy/orchestration-state-v5.schema.json' with { type: 'json' };
import { CURRENT_SCHEMA_VERSION } from './version.js';

export interface MigrationStep {
  from: string;
  to: string;
  migrate: (s: unknown) => unknown;
}

const v5Validate = new Ajv({ allErrors: true }).compile(v5Schema as object);

function wrapEntry(e: Record<string, unknown>): void {
  const hash = (e['commit_hash'] ?? null) as string | null;
  delete e['commit_hash'];
  e['repos'] = [{ name: '', commit_hash: hash }];
}

export function migrateV5ToV6(input: unknown): { $schema: string } & Record<string, unknown> {
  if (!v5Validate(input)) {
    throw new Error('migrate v5→v6: input does not validate against the archived v5 schema');
  }
  const s = structuredClone(input) as Record<string, unknown>;
  const phaseLoop = (s['graph'] as any)?.nodes?.phase_loop;
  for (const phaseIter of phaseLoop?.iterations ?? []) {
    wrapEntry(phaseIter as Record<string, unknown>);
    for (const ct of (phaseIter.corrective_tasks ?? []) as Record<string, unknown>[]) {
      wrapEntry(ct);
    }
    const taskLoop = (phaseIter as any).nodes?.task_loop;
    for (const taskIter of taskLoop?.iterations ?? []) {
      wrapEntry(taskIter as Record<string, unknown>);
      for (const ct of (taskIter.corrective_tasks ?? []) as Record<string, unknown>[]) {
        wrapEntry(ct);
      }
    }
  }
  s['$schema'] = CURRENT_SCHEMA_VERSION;
  return s as { $schema: string } & Record<string, unknown>;
}

export const MIGRATION_LADDER: MigrationStep[] = [
  { from: 'orchestration-state-v5', to: 'orchestration-state-v6', migrate: migrateV5ToV6 },
];

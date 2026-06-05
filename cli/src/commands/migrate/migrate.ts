/**
 * migrate.ts
 *
 * Core migration logic for `radorch migrate <project>`.
 * Safety rails: backup, idempotency, per-step output validation, ladder walk.
 * Requirements: FR-15, FR-18, FR-19, NFR-5, AD-7, DD-2
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CURRENT_SCHEMA_VERSION } from '../../lib/pipeline-engine/migrations/version.js';
import { MIGRATION_LADDER } from '../../lib/pipeline-engine/migrations/steps.js';
import { validateStateSchema } from '../../lib/pipeline-engine/schema-validator.js';
import type { PipelineState } from '../../lib/pipeline-engine/types.js';

export interface MigrateProjectOptions {
  projectDir: string;
  dryRun: boolean;
}

export type MigrateProjectResult =
  | { migrated: false }
  | { migrated: true; from: string; to: string; backupPath: string | null };

/**
 * Migrate a single project directory's state.json from its current version
 * up to CURRENT_SCHEMA_VERSION using the MIGRATION_LADDER.
 *
 * Safety rails (live here, not in individual steps — AD-7):
 *  - Idempotency: returns { migrated: false } if already current (FR-18).
 *  - Per-step validation: validates result against the v6 schema after
 *    the final step; throws (no write) on failure (FR-19/AD-7).
 *  - Backup: copies original to state.json.bak-<iso> before writing (NFR-5/FR-18).
 *  - Dry-run: returns computed result without backing up or writing (FR-15).
 */
export function migrateProject(opts: MigrateProjectOptions): MigrateProjectResult {
  const { projectDir, dryRun } = opts;
  const statePath = path.join(projectDir, 'state.json');

  const raw = fs.readFileSync(statePath, 'utf8');
  const state = JSON.parse(raw) as Record<string, unknown>;
  const currentSchema = (state['$schema'] as string | undefined) ?? '';

  // Idempotency: already at the current version — no-op (FR-18)
  if (currentSchema === CURRENT_SCHEMA_VERSION) {
    return { migrated: false };
  }

  // Walk the migration ladder from the state's version to the current version
  let fromVersion = currentSchema;
  let value: unknown = state;

  // Find the starting index in the ladder
  const startIdx = MIGRATION_LADDER.findIndex((step) => step.from === fromVersion);
  if (startIdx === -1) {
    throw new Error(`migrate: no migration step found starting from schema '${fromVersion}'`);
  }

  const stepsToApply = MIGRATION_LADDER.slice(startIdx);
  for (const step of stepsToApply) {
    if ((value as Record<string, unknown>)['$schema'] !== step.from) {
      throw new Error(`migrate: expected schema '${step.from}' but state has '${(value as Record<string, unknown>)['$schema']}'`);
    }
    value = step.migrate(value);
  }

  // Per-step validation: validate final output against the v6 schema (FR-19/AD-7)
  const errors = validateStateSchema(value as PipelineState);
  if (errors.length > 0) {
    throw new Error(`migrate: post-migration validation failed:\n${errors.join('\n')}`);
  }

  const toVersion = CURRENT_SCHEMA_VERSION;

  // Dry-run: report without backing up or writing (FR-15)
  if (dryRun) {
    return { migrated: true, from: fromVersion, to: toVersion, backupPath: null };
  }

  // Backup: copy original to timestamped .bak file (NFR-5/FR-18)
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${statePath}.bak-${iso}`;
  fs.writeFileSync(backupPath, raw, 'utf8');

  // Write migrated state
  fs.writeFileSync(statePath, JSON.stringify(value, null, 2), 'utf8');

  return { migrated: true, from: fromVersion, to: toVersion, backupPath };
}

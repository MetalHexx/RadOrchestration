import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { migrateProject } from '../../../src/commands/migrate/migrate.js';
import { makeValidV5State } from '../../helpers/state-factory.js';

function tmpProject(state: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
  return dir;
}

describe('radorch migrate (FR-15, FR-18)', () => {
  it('migrates v5→v6, backs up, and writes (FR-15, FR-18, NFR-5)', () => {
    const dir = tmpProject(makeValidV5State({ taskCommitHash: 'abc1234' }));
    const r = migrateProject({ projectDir: dir, dryRun: false });
    expect(r.migrated).toBe(true);
    expect(r.from).toBe('orchestration-state-v5');
    expect(r.to).toBe('orchestration-state-v6');
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    expect(written.$schema).toBe('orchestration-state-v6');
    expect(r.backupPath && fs.existsSync(r.backupPath)).toBe(true);
  });
  it('is a no-op when already current (FR-18)', () => {
    const dir = tmpProject(makeValidV5State({ taskCommitHash: 'abc1234' }));
    migrateProject({ projectDir: dir, dryRun: false });
    const second = migrateProject({ projectDir: dir, dryRun: false });
    expect(second.migrated).toBe(false);
  });
  it('dry-run reports without writing (FR-15)', () => {
    const dir = tmpProject(makeValidV5State({ taskCommitHash: 'abc1234' }));
    const r = migrateProject({ projectDir: dir, dryRun: true });
    expect(r.migrated).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).$schema).toBe('orchestration-state-v5');
  });
});

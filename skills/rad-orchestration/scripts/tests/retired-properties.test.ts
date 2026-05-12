import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readConfig } from '../lib/state-io.js';

describe('Retired property handling', () => {
  it('reads a YAML carrying retired keys without error', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-rc-'));
    fs.writeFileSync(path.join(tmp, 'orchestration.yml'), `
version: "1.0"
system:
  orch_root: ".claude"
projects:
  base_path: "old/path"
  naming: "SCREAMING_CASE"
source_control:
  auto_commit: "ask"
  auto_pr: "ask"
  provider: "github"
default_template: ask
limits:
  max_phases: 10
  max_tasks_per_phase: 8
  max_retries_per_task: 5
  max_consecutive_review_rejections: 3
human_gates:
  after_planning: true
  execution_mode: "ask"
  after_final_review: true
`);
    const cfg = readConfig(path.join(tmp, 'orchestration.yml'));
    // Retired keys not surfaced on the typed config object:
    expect((cfg as { system?: unknown }).system).toBeUndefined();
    expect((cfg as { projects?: unknown }).projects).toBeUndefined();
    expect((cfg.source_control as { provider?: unknown }).provider).toBeUndefined();
    // Live keys preserved:
    expect(cfg.source_control.auto_commit).toBe('ask');
    expect(cfg.default_template).toBe('ask');
  });
});

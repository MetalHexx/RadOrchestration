import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

const SCRIPT_PATH = path.resolve(import.meta.dirname, 'cleanup-tiers.ts');
const FULL_BAK = path.resolve(import.meta.dirname, 'cleanup-tiers', 'full.yml.bak');

function makeProject(baseDir: string, name: string, templateId: string, opts: { snapshot?: string } = {}): string {
  const projectDir = path.join(baseDir, name);
  fs.mkdirSync(projectDir, { recursive: true });
  const state = { $schema: 'orchestration-state-v5', project: { name, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' }, config: { gate_mode: 'ask', limits: {}, source_control: {} }, pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null }, graph: { template_id: templateId, status: 'in_progress', current_node_path: null, nodes: {} } };
  fs.writeFileSync(path.join(projectDir, 'state.json'), JSON.stringify(state, null, 2));
  if (opts.snapshot !== undefined) {
    fs.writeFileSync(path.join(projectDir, 'template.yml'), opts.snapshot);
  }
  return projectDir;
}

function readState(projectDir: string): any {
  return JSON.parse(fs.readFileSync(path.join(projectDir, 'state.json'), 'utf-8'));
}

function runScript(baseDir: string): void {
  execSync(`npx tsx "${SCRIPT_PATH}" --base-path "${baseDir}"`, { stdio: 'pipe' });
}

test('rewrites template_id default → extra-high', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
  try {
    const p = makeProject(baseDir, 'P-DEF', 'default', { snapshot: 'template:\n  id: default\n' });
    runScript(baseDir);
    assert.equal(readState(p).graph.template_id, 'extra-high');
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
});

test('rewrites template_id quick → low', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
  try {
    const p = makeProject(baseDir, 'P-Q', 'quick', { snapshot: 'template:\n  id: quick\n' });
    runScript(baseDir);
    assert.equal(readState(p).graph.template_id, 'low');
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
});

test('full project keeps template_id but ensures local snapshot', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
  try {
    const p = makeProject(baseDir, 'P-F', 'full'); // no snapshot
    runScript(baseDir);
    assert.equal(readState(p).graph.template_id, 'full');
    const snap = path.join(p, 'template.yml');
    assert.ok(fs.existsSync(snap));
    // Snapshot content matches the captured full.yml.bak byte-for-byte.
    assert.equal(fs.readFileSync(snap, 'utf-8'), fs.readFileSync(FULL_BAK, 'utf-8'));
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
});

test('full project with existing snapshot is left alone', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
  try {
    const existing = 'template:\n  id: full\n  custom: true\n';
    const p = makeProject(baseDir, 'P-FS', 'full', { snapshot: existing });
    runScript(baseDir);
    assert.equal(fs.readFileSync(path.join(p, 'template.yml'), 'utf-8'), existing);
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
});

test('custom and already-migrated projects are not modified', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
  try {
    const a = makeProject(baseDir, 'P-CUSTOM', 'my-custom', { snapshot: 'template:\n  id: my-custom\n' });
    const b = makeProject(baseDir, 'P-EH', 'extra-high', { snapshot: 'template:\n  id: extra-high\n' });
    runScript(baseDir);
    assert.equal(readState(a).graph.template_id, 'my-custom');
    assert.equal(readState(b).graph.template_id, 'extra-high');
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
});

test('idempotent — second run is a no-op', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
  try {
    const p = makeProject(baseDir, 'P-DEF', 'default', { snapshot: 'template:\n  id: default\n' });
    runScript(baseDir);
    runScript(baseDir);
    assert.equal(readState(p).graph.template_id, 'extra-high');
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
});

test('ignores non-project entries (no state.json) without erroring', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
  try {
    fs.mkdirSync(path.join(baseDir, 'NOT-A-PROJECT'));
    fs.writeFileSync(path.join(baseDir, 'README.txt'), 'not a project');
    runScript(baseDir);
    // No throw == pass.
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
});

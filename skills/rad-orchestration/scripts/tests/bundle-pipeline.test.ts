import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsRoot = path.resolve(__dirname, '..');

describe('pipeline bundle', () => {
  let tmp: string;
  let bundlePath: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-pipe-'));
    bundlePath = path.join(tmp, 'pipeline.js');
    await execP('npm', ['run', 'bundle', '--', `--out=${bundlePath}`], { cwd: scriptsRoot, shell: process.platform === 'win32' });
  }, 120_000);

  it('emits a single-file bundle under 6 MB', async () => {
    const stat = await fs.stat(bundlePath);
    expect(stat.size).toBeLessThan(6 * 1024 * 1024);
    expect(stat.size).toBeGreaterThan(50 * 1024);
  });

  it('exits non-zero with no event flag, but loads without npm-install bootstrap', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-pipe-iso-'));
    const copy = path.join(isolated, 'pipeline.js');
    await fs.copyFile(bundlePath, copy);
    const result = await execP('node', [copy], { reject: false } as never).catch((e: { stderr?: string; stdout?: string; code?: number }) => e);
    const merged = ((result as { stderr?: string }).stderr ?? '') + ((result as { stdout?: string }).stdout ?? '');
    expect(merged).not.toMatch(/SyntaxError|Cannot find|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|npm (ci|install)/);
  });

  // Bundle geometry sanity — `pipeline.ts` lives at `scripts/pipeline.ts` and
  // bundles into `scripts/pipeline.js` (same depth), so the runtime
  // path-resolution in `resolvePathContext()` must locate the templates and
  // orchRoot correctly when invoked from the in-tree bundle. This guards
  // against the regression where bundling shifted import.meta.url one level
  // and template loads returned "Template file not found".
  it('start event loads a template against the in-tree bundle', async () => {
    // Use the in-tree bundle that the harness ships (the one at
    // scripts/pipeline.js), so the geometry assertion exercises the real
    // distribution layout — not the temp-bundle output.
    const inTreeBundle = path.resolve(scriptsRoot, 'pipeline.js');
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-pipe-start-'));
    const result = await execP(
      'node',
      [
        inTreeBundle,
        '--event', 'start',
        '--project-dir', projectDir,
        '--template', 'extra-high',
      ],
      { reject: false } as never,
    ).catch((e: { stderr?: string; stdout?: string; code?: number }) => e);
    const stdout = (result as { stdout?: string }).stdout ?? '';
    const parsed = JSON.parse(stdout);
    expect(parsed.success, JSON.stringify(parsed, null, 2)).toBe(true);
    expect(parsed.action).toBe('spawn_requirements');
    expect(typeof parsed.orchRoot).toBe('string');
    expect(parsed.orchRoot.length).toBeGreaterThan(0);
  });
});

describe('explode-master-plan bundle', () => {
  let tmp: string;
  let bundlePath: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-explode-'));
    bundlePath = path.join(tmp, 'explode-master-plan.js');
    await execP('npm', ['run', 'bundle', '--', '--entry=explode-master-plan', `--out=${bundlePath}`], { cwd: scriptsRoot, shell: process.platform === 'win32' });
  }, 120_000);

  it('emits a single-file bundle under 1 MB and over 10 KB', async () => {
    const stat = await fs.stat(bundlePath);
    expect(stat.size).toBeLessThan(1 * 1024 * 1024);
    expect(stat.size).toBeGreaterThan(10 * 1024);
  });

  it('loads without npm-install bootstrap when run with no args', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-explode-iso-'));
    const copy = path.join(isolated, 'explode-master-plan.js');
    await fs.copyFile(bundlePath, copy);
    const result = await execP('node', [copy], { reject: false } as never).catch((e: { stderr?: string; stdout?: string; code?: number }) => e);
    const merged = ((result as { stderr?: string }).stderr ?? '') + ((result as { stdout?: string }).stdout ?? '');
    expect(merged).not.toMatch(/SyntaxError|Cannot find|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|npm (ci|install)/);
  });
});

describe('migrate-to-v5 bundle', () => {
  let tmp: string;
  let bundlePath: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-migrate-'));
    bundlePath = path.join(tmp, 'migrate-to-v5.js');
    await execP('npm', ['run', 'bundle', '--', '--entry=migrate-to-v5', `--out=${bundlePath}`], { cwd: scriptsRoot, shell: process.platform === 'win32' });
  }, 120_000);

  it('emits a single-file bundle under 1 MB and over 10 KB', async () => {
    const stat = await fs.stat(bundlePath);
    expect(stat.size).toBeLessThan(1 * 1024 * 1024);
    expect(stat.size).toBeGreaterThan(10 * 1024);
  });

  it('loads without npm-install bootstrap when run with no args', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-migrate-iso-'));
    const copy = path.join(isolated, 'migrate-to-v5.js');
    await fs.copyFile(bundlePath, copy);
    const result = await execP('node', [copy], { reject: false } as never).catch((e: { stderr?: string; stdout?: string; code?: number }) => e);
    const merged = ((result as { stderr?: string }).stderr ?? '') + ((result as { stdout?: string }).stdout ?? '');
    expect(merged).not.toMatch(/SyntaxError|Cannot find|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|npm (ci|install)/);
  });
});

describe('fix-ghost-v5 bundle', () => {
  let tmp: string;
  let bundlePath: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-fixghost-'));
    bundlePath = path.join(tmp, 'fix-ghost-v5.js');
    await execP('npm', ['run', 'bundle', '--', '--entry=fix-ghost-v5', `--out=${bundlePath}`], { cwd: scriptsRoot, shell: process.platform === 'win32' });
  }, 120_000);

  it('emits a single-file bundle under 1 MB and over 10 KB', async () => {
    const stat = await fs.stat(bundlePath);
    expect(stat.size).toBeLessThan(1 * 1024 * 1024);
    expect(stat.size).toBeGreaterThan(10 * 1024);
  });

  it('loads without npm-install bootstrap when run with no args', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-fixghost-iso-'));
    const copy = path.join(isolated, 'fix-ghost-v5.js');
    await fs.copyFile(bundlePath, copy);
    const result = await execP('node', [copy], { reject: false } as never).catch((e: { stderr?: string; stdout?: string; code?: number }) => e);
    const merged = ((result as { stderr?: string }).stderr ?? '') + ((result as { stdout?: string }).stdout ?? '');
    expect(merged).not.toMatch(/SyntaxError|Cannot find|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|npm (ci|install)/);
  });
});

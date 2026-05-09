import path from 'node:path';
import { pathExists } from '../../lib/fs-helpers.js';
import { installPaths } from '../../lib/paths.js';
import { readInstallJson, readConfigYml } from '../../lib/config.js';
import { readRegistry } from '../../lib/registry.js';
import { isHarnessName } from '../../framework/harness.js';
import { cmpSemver } from '../../lib/install-json.js';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type CheckCategory = 'Environment' | 'Install' | 'Registry' | 'Plugin';

export interface CheckResult {
  category: CheckCategory;
  name: string;
  status: CheckStatus;
  detail?: string;
}

export async function runEnvironmentChecks(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const major = Number(process.versions.node.split('.')[0]);
  out.push({
    category: 'Environment',
    name: 'node-version',
    status: major >= 20 ? 'pass' : 'fail',
    detail: `node ${process.versions.node}`,
  });
  out.push({
    category: 'Environment',
    name: 'platform',
    status: 'pass',
    detail: `${process.platform}/${process.arch}`,
  });
  return out;
}

export async function runInstallChecks(root: string): Promise<CheckResult[]> {
  const p = installPaths(root);
  const out: CheckResult[] = [];
  const rootExists = await pathExists(p.root);
  out.push({
    category: 'Install',
    name: 'root-exists',
    status: rootExists ? 'pass' : 'fail',
    detail: rootExists ? p.root : `missing ${p.root} — run \`radorch install\``,
  });
  if (!rootExists) return out;
  // install.json
  try {
    const ij = await readInstallJson(p.installJson);
    out.push({
      category: 'Install',
      name: 'install.json shape',
      status: typeof ij.package_version === 'string' && typeof ij.installed_at === 'string' ? 'pass' : 'fail',
    });
  } catch (e) {
    out.push({ category: 'Install', name: 'install.json shape', status: 'fail', detail: (e as Error).message });
  }
  // config.yml
  try {
    const cfg = await readConfigYml(p.configYml);
    out.push({
      category: 'Install',
      name: 'config.yml shape',
      status: isHarnessName(cfg.default_active_harness) ? 'pass' : 'fail',
    });
  } catch (e) {
    out.push({ category: 'Install', name: 'config.yml shape', status: 'fail', detail: (e as Error).message });
  }
  return out;
}

export async function runRegistryChecks(root: string): Promise<CheckResult[]> {
  const p = installPaths(root);
  const out: CheckResult[] = [];
  try {
    const reg = await readRegistry(p.registryYml);
    const empty = (reg.repos ?? []).length === 0 && (reg.workspaces ?? []).length === 0;
    out.push({
      category: 'Registry',
      name: 'registry has entries',
      status: empty ? 'warn' : 'pass',
      detail: empty ? 'nothing registered yet (lands in #1.1)' : undefined,
    });
  } catch (e) {
    out.push({ category: 'Registry', name: 'registry shape', status: 'fail', detail: (e as Error).message });
  }
  return out;
}

export async function runPluginChecks(opts: {
  root: string;
  localVersion: string;
  pluginRoot?: string;
}): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const p = installPaths(opts.root);
  // Bundle integrity: probe the bundled CLI when CLAUDE_PLUGIN_ROOT is known
  // (deployed plugin), otherwise warn that it could not be verified.
  if (opts.pluginRoot) {
    const bundle = path.join(opts.pluginRoot, 'bin', 'radorch.mjs');
    const exists = await pathExists(bundle);
    out.push({
      category: 'Plugin',
      name: 'bundle-integrity',
      status: exists ? 'pass' : 'fail',
      detail: exists ? bundle : `missing ${bundle} — run \`npm run build:plugin\``,
    });
  } else {
    out.push({
      category: 'Plugin',
      name: 'bundle-integrity',
      status: 'warn',
      detail: 'CLAUDE_PLUGIN_ROOT not set — bundle presence not verified',
    });
  }
  // Bootstrap skeleton
  const required = [p.projectsDir, p.registryYml, p.configYml, p.installJson];
  let bootstrapOk = true;
  for (const f of required) if (!(await pathExists(f))) bootstrapOk = false;
  out.push({
    category: 'Plugin',
    name: 'bootstrap-skeleton',
    status: bootstrapOk ? 'pass' : 'fail',
    detail: bootstrapOk ? undefined : 'missing one or more entries under RADORCH_HOME',
  });
  // UI PID consistency
  const pidExists = await pathExists(p.uiPidFile);
  let pidStatus: CheckStatus = 'pass';
  let pidDetail: string | undefined;
  if (pidExists) {
    try {
      const fsModule = await import('node:fs/promises');
      const entry = JSON.parse(await fsModule.readFile(p.uiPidFile, 'utf8')) as { pid: number };
      try {
        process.kill(entry.pid, 0);
      } catch {
        pidStatus = 'warn';
        pidDetail = `stale PID ${entry.pid} in ${p.uiPidFile} — process is dead`;
      }
    } catch {
      pidStatus = 'warn';
      pidDetail = 'pid file present but unparseable';
    }
  }
  out.push({ category: 'Plugin', name: 'ui-pid-consistency', status: pidStatus, detail: pidDetail });
  // Version skew
  let skewStatus: CheckStatus = 'pass';
  let skewDetail: string | undefined;
  if (await pathExists(p.installJson)) {
    const ij = await readInstallJson(p.installJson);
    if (!ij.last_writer_version) {
      skewStatus = 'pass';
      skewDetail = 'install.json has no last_writer_version (iter-01 install — skipping skew check)';
    } else if (cmpSemver(opts.localVersion, ij.last_writer_version) < 0) {
      skewStatus = 'fail';
      skewDetail = `state last written by ${ij.last_writer_version}; this CLI is ${opts.localVersion}`;
    }
  }
  out.push({ category: 'Plugin', name: 'version-skew', status: skewStatus, detail: skewDetail });
  return out;
}

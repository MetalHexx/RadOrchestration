import { pathExists } from '../../lib/fs-helpers.js';
import { installPaths } from '../../lib/paths.js';
import { readInstallJson, readConfigYml } from '../../lib/config.js';
import { readRegistry } from '../../lib/registry.js';
import { isHarnessName } from '../../framework/harness.js';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type CheckCategory = 'Environment' | 'Install' | 'Registry';

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

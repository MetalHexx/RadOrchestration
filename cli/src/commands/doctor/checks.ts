import fsP from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathExists } from '../../lib/fs-helpers.js';
import { installPaths } from '../../lib/paths.js';
import { readInstallJson, readConfigYml } from '../../lib/config.js';
import { readRegistry } from '../../lib/registry.js';
import { isHarnessName } from '../../framework/harness.js';
import { cmpSemver } from '../../lib/install-json.js';
import { parseYaml } from '../../lib/yaml.js';

/**
 * Mirrors `resolveBasePath` in skills/rad-orchestration/scripts/lib/state-io.ts
 * (P05-T01). Duplicated locally because cli/'s tsconfig pins rootDir to ./src,
 * which prevents importing from the pipeline runtime. Pure: no filesystem,
 * no env capture beyond the explicit `env` argument.
 */
export function expandHome(raw: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!raw) return raw;
  if (raw.startsWith('~/.radorch')) {
    const radorchHome = env['RADORCH_HOME'] || path.join(os.homedir(), '.radorch');
    const remainder = raw.slice('~/.radorch'.length).replace(/^[/\\]+/, '');
    const joined = remainder ? path.join(radorchHome, remainder) : radorchHome;
    return joined.replace(/[/\\]+$/, '');
  }
  if (raw.startsWith('~/') || raw.startsWith('~\\')) {
    const remainder = raw.slice(2).replace(/^[/\\]+/, '');
    const joined = remainder ? path.join(os.homedir(), remainder) : os.homedir();
    return joined.replace(/[/\\]+$/, '');
  }
  return raw;
}

/**
 * Locate `orchestration.yml` under the search root and return its
 * `projects.base_path`. Falls back to `<searchRoot>/projects` when no
 * orchestration.yml is present (the standard RADORCH_HOME layout).
 */
export async function readBasePathFromOrchestrationYml(
  searchRoot: string,
): Promise<{ basePath: string }> {
  const candidates = [
    path.join(searchRoot, 'skills', 'rad-orchestration', 'config', 'orchestration.yml'),
    path.join(searchRoot, 'orchestration.yml'),
  ];
  for (const candidate of candidates) {
    try {
      const text = await fsP.readFile(candidate, 'utf8');
      const parsed = parseYaml<{ projects?: { base_path?: string } }>(text);
      const bp = parsed?.projects?.base_path;
      if (typeof bp === 'string' && bp.length > 0) return { basePath: bp };
    } catch {
      // ENOENT or unreadable — try next candidate.
    }
  }
  return { basePath: path.join(searchRoot, 'projects') };
}

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
  /**
   * Optional iter-01 (legacy npm-installed `radorch`) version, supplied by
   * callers that have already detected a parallel install. When omitted the
   * cross-install-version-skew check warns "iter-01 install not detected;
   * nothing to compare" rather than shelling out (NFR-8: filesystem-light).
   */
  iter01Version?: string;
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
  // projects-base-path-readable (FR-14, AD-12): resolve `projects.base_path`
  // from orchestration.yml (or fall back to <root>/projects) and verify the
  // resolved directory is present and readable. Filesystem `stat`-only.
  {
    const cfg = await readBasePathFromOrchestrationYml(opts.pluginRoot ?? opts.root);
    const resolved = expandHome(cfg.basePath, process.env);
    let detail: string | undefined;
    let status: CheckStatus = 'pass';
    try {
      await fsP.access(resolved, fsP.constants.R_OK);
      detail = resolved;
    } catch {
      status = 'fail';
      detail = `${resolved} is missing or unreadable`;
    }
    out.push({ category: 'Plugin', name: 'projects-base-path-readable', status, detail });
  }
  // plugin-skills-enumerable (FR-14): every shipped skills/<name>/ folder
  // must contain a SKILL.md. Warn when the plugin root is unknown or the
  // skills/ directory itself is missing — the check is irrelevant outside
  // a deployed plugin (AD-12 missing-data warn), and a missing skills/
  // dir signals a structurally broken plugin (warn so it surfaces).
  if (opts.pluginRoot) {
    const skillsDir = path.join(opts.pluginRoot, 'skills');
    if (!(await pathExists(skillsDir))) {
      out.push({
        category: 'Plugin',
        name: 'plugin-skills-enumerable',
        status: 'warn',
        detail: 'skills/ directory missing under CLAUDE_PLUGIN_ROOT',
      });
    } else {
      const missing: string[] = [];
      for (const name of await fsP.readdir(skillsDir)) {
        const f = path.join(skillsDir, name, 'SKILL.md');
        if (!(await pathExists(f))) missing.push(name);
      }
      out.push({
        category: 'Plugin',
        name: 'plugin-skills-enumerable',
        status: missing.length === 0 ? 'pass' : 'fail',
        detail: missing.length === 0 ? undefined : `skills missing SKILL.md: ${missing.join(', ')}`,
      });
    }
  } else {
    out.push({
      category: 'Plugin',
      name: 'plugin-skills-enumerable',
      status: 'warn',
      detail: 'CLAUDE_PLUGIN_ROOT not set',
    });
  }
  // plugin-agents-resolvable (FR-14, DD-3): the plugin ships canonical agent
  // files under agents/; namespacing is a body transform inside the plugin.
  // Enumerate dynamically and require agents/ to be non-empty, every entry
  // .md-suffixed and readable on R_OK; report per-file misses.
  if (opts.pluginRoot) {
    const agentsDir = path.join(opts.pluginRoot, 'agents');
    const missing: string[] = [];
    if (!(await pathExists(agentsDir))) {
      missing.push('agents/ directory');
    } else {
      const entries = (await fsP.readdir(agentsDir)).filter((f) => f.endsWith('.md'));
      if (entries.length === 0) {
        missing.push('no .md agent files under agents/');
      } else {
        for (const f of entries) {
          try {
            await fsP.access(path.join(agentsDir, f), fsP.constants.R_OK);
          } catch {
            missing.push(f);
          }
        }
      }
    }
    out.push({
      category: 'Plugin',
      name: 'plugin-agents-resolvable',
      status: missing.length === 0 ? 'pass' : 'fail',
      detail: missing.length === 0 ? undefined : `missing or unreadable: ${missing.join(', ')}`,
    });
  } else {
    out.push({
      category: 'Plugin',
      name: 'plugin-agents-resolvable',
      status: 'warn',
      detail: 'CLAUDE_PLUGIN_ROOT not set',
    });
  }
  // cross-install-version-skew (FR-14, AD-12, NFR-8): warn when a parallel
  // iter-01 npm install of `radorch` reports a different version from the
  // plugin CLI. Detection is caller-supplied via `opts.iter01Version` to
  // keep this check filesystem-light — no shell-outs, no PATH walk.
  {
    let crossStatus: CheckStatus = 'warn';
    let crossDetail = 'iter-01 install not detected; nothing to compare';
    if (opts.iter01Version) {
      if (opts.iter01Version === opts.localVersion) {
        crossStatus = 'pass';
        crossDetail = `iter-01 install at ${opts.iter01Version} matches plugin CLI`;
      } else {
        crossStatus = 'warn';
        crossDetail = `iter-01 install reports ${opts.iter01Version}; plugin CLI is ${opts.localVersion}`;
      }
    }
    out.push({
      category: 'Plugin',
      name: 'cross-install-version-skew',
      status: crossStatus,
      detail: crossDetail,
    });
  }
  return out;
}

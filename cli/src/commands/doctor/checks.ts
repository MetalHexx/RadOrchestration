import fsP from 'node:fs/promises';
import path from 'node:path';
import { pathExists } from '../../lib/fs-helpers.js';
import { installPaths } from '../../lib/paths.js';
import { readInstallJson } from '../../lib/config.js';
import { readRegistry } from '../../lib/registry.js';
import { cmpSemver } from '../../lib/install-json.js';
import { parseYaml } from '../../lib/yaml.js';
import { userDataPaths } from '../../lib/upgrade/user-data-paths.js';
import { scanUserLevelHarnesses } from '../../lib/cross-harness-scan.js';
import { getCliVersion } from '../../lib/package-version.js';

const pkg = { version: getCliVersion() };

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type CheckCategory = 'Environment' | 'Install' | 'Registry' | 'Plugin';

export interface CheckResult {
  category: CheckCategory;
  name: string;
  status: CheckStatus;
  detail?: string;
}

/** The four properties retired in 1.3 — present in old orchestration.yml files. */
const RETIRED_KEYS = ['system.orch_root', 'projects.base_path', 'projects.naming', 'source_control.provider'] as const;

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

export async function runInstallChecks(): Promise<CheckResult[]> {
  const p = userDataPaths();
  const out: CheckResult[] = [];

  // 1. radorch-home-exists
  const rootExists = await pathExists(p.root);
  out.push({
    category: 'Install',
    name: 'radorch-home-exists',
    status: rootExists ? 'pass' : 'fail',
    detail: rootExists ? p.root : `missing ${p.root} — run \`radorch install\``,
  });
  if (!rootExists) return out;

  // 2. install-json-shape
  try {
    const ij = await readInstallJson(p.installJson);
    out.push({
      category: 'Install',
      name: 'install-json-shape',
      status: typeof ij.package_version === 'string' ? 'pass' : 'fail',
    });
  } catch (e) {
    out.push({ category: 'Install', name: 'install-json-shape', status: 'fail', detail: (e as Error).message });
  }

  // 3. (retired) `radorch-bin-on-path` — the CLI no longer ships at
  // ~/.radorch/bin/; it lives inside the rad-orchestration skill folder and
  // is invoked through the harness's slash commands or `node <skill-path>`.
  // There is no PATH-on-shell concern to surface here anymore.

  // 4. templates-folder-populated
  {
    const templatesDir = p.templates;
    const required = ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml'];
    let allPresent = true;
    const missing: string[] = [];
    for (const file of required) {
      if (!(await pathExists(path.join(templatesDir, file)))) {
        allPresent = false;
        missing.push(file);
      }
    }
    out.push({
      category: 'Install',
      name: 'templates-folder-populated',
      status: allPresent ? 'pass' : 'warn',
      detail: allPresent ? undefined : `missing templates: ${missing.join(', ')}`,
    });
  }

  // 5. retired-properties-present
  {
    const orchYml = p.orchestrationYml;
    const found: string[] = [];
    try {
      const text = await fsP.readFile(orchYml, 'utf8');
      const parsed = parseYaml<Record<string, unknown>>(text);
      if (parsed && typeof parsed === 'object') {
        for (const key of RETIRED_KEYS) {
          const parts = key.split('.');
          const top = parts[0];
          const sub = parts[1];
          if (!top) continue;
          const topVal = (parsed as Record<string, unknown>)[top];
          if (sub) {
            if (topVal !== null && typeof topVal === 'object' && sub in (topVal as Record<string, unknown>)) {
              found.push(key);
            }
          } else {
            if (top in parsed) found.push(key);
          }
        }
      }
    } catch {
      // orchestration.yml absent or unreadable — no retired keys to report.
    }
    if (found.length > 0) {
      out.push({
        category: 'Install',
        name: 'retired-properties-present',
        status: 'warn',
        detail: `stale keys in orchestration.yml (safe to delete): ${found.join(', ')}`,
      });
    } else {
      out.push({
        category: 'Install',
        name: 'retired-properties-present',
        status: 'pass',
      });
    }
  }

  // 6. version-match
  {
    let versionStatus: CheckStatus = 'pass';
    let versionDetail: string | undefined;
    try {
      const ij = await readInstallJson(p.installJson);
      if (typeof ij.package_version !== 'string') {
        versionStatus = 'warn';
        versionDetail = 'install.json missing package_version';
      } else {
        const cliVersion = pkg.version;
        if (cliVersion) {
          const match = cmpSemver(cliVersion, ij.package_version) === 0;
          versionStatus = match ? 'pass' : 'warn';
          versionDetail = match
            ? `${cliVersion}`
            : `CLI is ${cliVersion}, install.json reports ${ij.package_version} — re-run \`radorch install\``;
        }
      }
    } catch {
      versionStatus = 'warn';
      versionDetail = 'install.json unreadable — run `radorch install`';
    }
    out.push({ category: 'Install', name: 'version-match', status: versionStatus, detail: versionDetail });
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
    const bundle = path.join(
      opts.pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs',
    );
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
    detail: bootstrapOk ? undefined : 'missing one or more entries under ~/.radorch',
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
  // projects-base-path-readable (legacy check for workspace-relative projects dir)
  {
    const projectsDir = path.join(opts.root, 'projects');
    let detail: string | undefined;
    let status: CheckStatus = 'pass';
    try {
      await fsP.access(projectsDir, fsP.constants.R_OK);
      detail = projectsDir;
    } catch {
      status = 'fail';
      detail = `${projectsDir} is missing or unreadable`;
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
  // multi-harness-install-table (DD-8): render per-harness install status from
  // user-level harness directories via scanUserLevelHarnesses().
  {
    const reports = scanUserLevelHarnesses();
    const lines = reports.map((r) => {
      const ver = r.installed && r.packageVersion ? r.packageVersion : 'not installed';
      return `${r.harness}: ${ver}`;
    });
    out.push({
      category: 'Plugin',
      name: 'multi-harness-install-table',
      status: 'pass',
      detail: lines.join('\n'),
    });
  }
  return out;
}

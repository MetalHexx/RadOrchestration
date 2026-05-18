import fsP from 'node:fs/promises';
import path from 'node:path';
import { pathExists } from '../../lib/fs-helpers.js';
import { installPaths, userDataPaths } from '../../lib/paths.js';
import { readInstallJson } from '../../lib/config.js';
import type { InstallJson, InstallJsonV5, InstallJsonV6 } from '../../lib/config.js';
import { cmpSemver, isInstallJsonV6, readLastWriterVersion } from '../../lib/install-json.js';
import { parseYaml } from '../../lib/yaml.js';
import { scanUserLevelHarnesses } from '../../lib/cross-harness-scan.js';
import { getCliVersion } from '../../lib/package-version.js';

/** Pull a representative `version` from either v5 (top-level package_version)
 * or v6 (any entry's version). Used by doctor's install-shape checks where the
 * specific install-key isn't disambiguated. */
function readAnyVersion(ij: InstallJson): string | undefined {
  if (isInstallJsonV6(ij)) {
    for (const entry of Object.values((ij as InstallJsonV6).harnesses)) {
      if (entry?.version) return entry.version;
    }
    return undefined;
  }
  return (ij as InstallJsonV5).package_version;
}

const pkg = { version: getCliVersion() };

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type CheckCategory = 'Environment' | 'Install' | 'Plugin';

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

  // 2. install-json-shape — accepts both v5 (top-level package_version) and v6
  // (any registered harness entry's version).
  try {
    const ij = await readInstallJson(p.installJson);
    const version = readAnyVersion(ij);
    out.push({
      category: 'Install',
      name: 'install-json-shape',
      status: typeof version === 'string' ? 'pass' : 'fail',
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

  // 6. version-match — operates on the union; v6 picks the first registered entry.
  {
    let versionStatus: CheckStatus = 'pass';
    let versionDetail: string | undefined;
    try {
      const ij = await readInstallJson(p.installJson);
      const installedVersion = readAnyVersion(ij);
      if (typeof installedVersion !== 'string') {
        versionStatus = 'warn';
        versionDetail = 'install.json missing package_version';
      } else {
        const cliVersion = pkg.version;
        if (cliVersion) {
          const match = cmpSemver(cliVersion, installedVersion) === 0;
          versionStatus = match ? 'pass' : 'warn';
          versionDetail = match
            ? `${cliVersion}`
            : `CLI is ${cliVersion}, install.json reports ${installedVersion} — re-run \`radorch install\``;
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

  // Precondition: the three plugin-specific checks (bundle-integrity,
  // plugin-skills-enumerable, plugin-agents-resolvable) are only meaningful
  // when the system is running inside the Claude Code plugin or when a plugin
  // install is registered. If neither signal is present, skip those three
  // checks entirely — they would degrade to noisy CLAUDE_PLUGIN_ROOT warnings
  // on every Copilot harness and every legacy-installer Claude install.
  const registeredReports = scanUserLevelHarnesses();
  const claudePluginRegistered = registeredReports.some(
    (r) => r.installKey === 'claude-plugin' && r.installed,
  );
  const runPluginSpecificChecks = opts.pluginRoot !== undefined || claudePluginRegistered;

  // Bundle integrity: probe the bundled CLI when CLAUDE_PLUGIN_ROOT is known.
  if (runPluginSpecificChecks) {
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
      // Plugin registered in install.json but env var absent (e.g. running
      // doctor outside a Claude Code session) — warn that the bundle can't be
      // located without CLAUDE_PLUGIN_ROOT.
      out.push({
        category: 'Plugin',
        name: 'bundle-integrity',
        status: 'warn',
        detail: 'CLAUDE_PLUGIN_ROOT not set — bundle presence not verified',
      });
    }
  }
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
  // Version skew — reads the latest last_writer_version across v5 (top-level)
  // or v6 (max across all registered harness entries).
  let skewStatus: CheckStatus = 'pass';
  let skewDetail: string | undefined;
  if (await pathExists(p.installJson)) {
    const ij = await readInstallJson(p.installJson);
    const lastWriter = readLastWriterVersion(ij);
    if (!lastWriter) {
      skewStatus = 'pass';
      skewDetail = 'install.json has no last_writer_version (iter-01 install — skipping skew check)';
    } else if (cmpSemver(opts.localVersion, lastWriter) < 0) {
      skewStatus = 'fail';
      skewDetail = `state last written by ${lastWriter}; this CLI is ${opts.localVersion}`;
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
  // plugin-skills-enumerable: every shipped skills/<name>/ folder must contain
  // a SKILL.md. Only runs when the plugin is active or registered.
  if (runPluginSpecificChecks) {
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
      // Plugin registered but env var absent — warn that skills can't be verified.
      out.push({
        category: 'Plugin',
        name: 'plugin-skills-enumerable',
        status: 'warn',
        detail: 'CLAUDE_PLUGIN_ROOT not set — skills not verifiable outside a plugin session',
      });
    }
  }
  // plugin-agents-resolvable: the plugin ships canonical agent files under
  // agents/. Only runs when the plugin is active or registered.
  if (runPluginSpecificChecks) {
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
      // Plugin registered but env var absent — warn that agents can't be verified.
      out.push({
        category: 'Plugin',
        name: 'plugin-agents-resolvable',
        status: 'warn',
        detail: 'CLAUDE_PLUGIN_ROOT not set — agents not verifiable outside a plugin session',
      });
    }
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
  // multi-harness-install-table (DD-8 + Section 6): render per-install-key status
  // from the v6 registry at ~/.radorch/install.json. Each install-key emits one
  // line with `(channel)` suffix. When both `claude` and `claude-plugin` are
  // present, append an info line recommending consolidation.
  {
    const reports = registeredReports;
    const lines = reports.map((r) => {
      if (!r.installed) return `${r.installKey}: not installed`;
      const channel = r.channel ? ` (${r.channel})` : '';
      const ver = r.packageVersion ?? 'unknown';
      return `${r.installKey}: ${ver}${channel}`;
    });
    const hasClaude = reports.some((r) => r.installed && r.installKey === 'claude');
    const hasClaudePlugin = reports.some((r) => r.installed && r.installKey === 'claude-plugin');
    if (hasClaude && hasClaudePlugin) {
      lines.push('');
      lines.push('Both `claude` and `claude-plugin` are registered — they share ~/.claude/.');
      lines.push('The plugin is the recommended channel. To remove the legacy install,');
      lines.push('run `npx rad-orchestration uninstall`.');
    }
    out.push({
      category: 'Plugin',
      name: 'multi-harness-install-table',
      status: 'pass',
      detail: lines.join('\n'),
    });
  }
  return out;
}

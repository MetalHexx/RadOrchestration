import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { userDataPaths } from '../../lib/upgrade/user-data-paths.js';
import { readInstallJson, writeInstallJson } from '../../lib/upgrade/install-json-access.js';
import { acquireBootstrapLock } from '../../lib/upgrade/bootstrap-lock.js';
import { loadBundledManifest } from '../../lib/upgrade/catalog.js';
import { detectModifiedFiles, confirmModifiedFiles } from '../../lib/upgrade/hash-check.js';
import { removeManifestFiles } from '../../lib/upgrade/remove.js';
import { installManifestFiles } from '../../lib/upgrade/install.js';
import { cmpSemver } from '../../lib/install-json.js';
import { appendInstallLogEntry } from '../../lib/upgrade/install-log.js';
import type { InstallLogChannel } from '../../lib/upgrade/install-log.js';
import type { HarnessName } from '../../lib/upgrade/harness-paths.js';
import { writeBaseFiles } from '../install/skeleton.js';
import type { BootstrapResult } from './envelope.js';

export interface RunOpts {
  pluginRoot: string;
  /**
   * AD-3: optional shared-assets root for the legacy installer channel.
   * When omitted, defaults to `pluginRoot` (the Claude plugin channel ships a
   * single bundle root; the legacy installer ships shared `bin/` and `ui/`
   * one level up from each per-harness payload).
   */
  sharedRoot?: string;
  harness: HarnessName;
  force?: boolean;
  quiet?: boolean;
}

export async function runPluginBootstrap(opts: RunOpts): Promise<BootstrapResult> {
  const paths = userDataPaths();
  const sharedRoot = opts.sharedRoot ?? opts.pluginRoot;
  const channel: InstallLogChannel = opts.sharedRoot ? 'legacy-installer' : 'claude-plugin';
  const require_ = createRequire(import.meta.url);
  const pluginPkg = require_(path.join(opts.pluginRoot, 'package.json')) as { version: string };
  const deliveringVersion = pluginPkg.version;
  const haveInstallJson = fs.existsSync(paths.installJson);
  // Fresh-install short-circuit when no install.json present.
  if (!haveInstallJson) {
    const result = await doInstall({ paths, opts, sharedRoot, deliveringVersion, action: 'fresh-install' });
    appendInstallLogEntry({ channel, action: result.action, deliveringVersion, installedVersionBefore: null });
    return result;
  }
  const ij = await readInstallJson(paths.installJson);
  const installedVersion = ij.package_version;
  // installedVersionBefore is captured here (before any upgrade work) for use in all log entries.
  const installedVersionBefore: string | null = installedVersion ?? null;
  // Sanity: if expected files are missing, treat as fresh. The CLI now lives
  // inside the rad-orchestration skill (no ~/.radorch/bin/), so check the
  // plugin payload's copy as the install-completion sentinel.
  const expectedSentinel = path.join(
    opts.pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs',
  );
  if (!fs.existsSync(expectedSentinel)) {
    const result = await doInstall({ paths, opts, sharedRoot, deliveringVersion, action: 'fresh-install', installedVersion });
    appendInstallLogEntry({ channel, action: result.action, deliveringVersion, installedVersionBefore });
    return result;
  }
  const cmp = cmpSemver(deliveringVersion, installedVersion);
  if (cmp === 0 && !opts.force) {
    appendInstallLogEntry({ channel, action: 'noop', deliveringVersion, installedVersionBefore });
    return { action: 'noop', code: 0, deliveringVersion, installedVersion };
  }
  if (cmp < 0) {
    appendInstallLogEntry({ channel, action: 'downgrade-noop', deliveringVersion, installedVersionBefore });
    return {
      action: 'downgrade-noop',
      code: 0,
      deliveringVersion,
      installedVersion,
      message: `Delivering v${deliveringVersion} is older than installed v${installedVersion}; no-op. If this is unexpected, run \`radorch doctor\`.`,
    };
  }
  // Upgrade path (or --force re-install).
  const lock = acquireBootstrapLock(paths.bootstrapLock);
  if (!lock.acquired) {
    appendInstallLogEntry({ channel, action: 'lock-busy', deliveringVersion, installedVersionBefore });
    return {
      action: 'lock-busy',
      code: 0,
      deliveringVersion,
      installedVersion,
      message: 'another bootstrap in progress',
    };
  }
  try {
    // Ensure standard .radorch subdirectories exist on upgrade path (defensive against partial cleans).
    // FR-12: projects/ is user-owned; mkdir is recursive (no-op when present), never written into.
    fs.mkdirSync(paths.projects, { recursive: true });
    fs.mkdirSync(paths.logs, { recursive: true });
    fs.mkdirSync(paths.runtime, { recursive: true });
    // Self-heal: existing-but-broken installs missing the base files (config.yml,
    // registry.yml, .harness, .gitignore) get them on next session bootstrap.
    await writeBaseFiles(paths.root, opts.harness);
    const priorManifest = loadBundledManifest(opts.pluginRoot, installedVersion);
    const modified = detectModifiedFiles(priorManifest, opts.harness);
    if (modified.length > 0) {
      const proceed = await confirmModifiedFiles(modified, paths.root);
      if (!proceed) {
        appendInstallLogEntry({ channel, action: 'cancelled-modified-files', deliveringVersion, installedVersionBefore });
        return { action: 'cancelled-modified-files', code: 0, deliveringVersion, installedVersion, modifiedFiles: modified };
      }
    }
    removeManifestFiles(priorManifest, opts.harness);
    const newManifest = loadBundledManifest(opts.pluginRoot, deliveringVersion);
    installManifestFiles(newManifest, opts.pluginRoot, opts.harness, { sharedRoot });
    await writeInstallJson(paths.installJson, {
      ...ij,
      package_version: deliveringVersion,
      last_writer_version: deliveringVersion,
    });
    appendInstallLogEntry({ channel, action: 'upgrade-complete', deliveringVersion, installedVersionBefore });
    return { action: 'upgrade-complete', code: 0, deliveringVersion, installedVersion };
  } catch (err) {
    appendInstallLogEntry({ channel, action: 'error', deliveringVersion, installedVersionBefore });
    throw err;
  } finally {
    lock.release?.();
  }
}

async function doInstall(args: { paths: ReturnType<typeof userDataPaths>, opts: RunOpts, sharedRoot: string, deliveringVersion: string, action: BootstrapResult['action'], installedVersion?: string }): Promise<BootstrapResult> {
  // Fresh install path: skip hash-check + remove, run install + stamp install.json.
  // Also ensure the standard .radorch subdirectories exist (projects, logs, runtime).
  const newManifest = loadBundledManifest(args.opts.pluginRoot, args.deliveringVersion);

  // Create standard .radorch subdirectories matching the shell script behavior.
  // FR-12: projects/ is user-owned; mkdir is recursive (no-op when present), never written into.
  fs.mkdirSync(args.paths.projects, { recursive: true });
  fs.mkdirSync(args.paths.logs, { recursive: true });
  fs.mkdirSync(args.paths.runtime, { recursive: true });

  // The CLI bundle lands at <harnessRoot>/skills/rad-orchestration/scripts/radorch.mjs
  // via the manifest copy below — the manifest entry routes through
  // resolveBundleTarget (skills/ → harnessRoot) and installManifestFiles
  // chmods it 0o755 on POSIX (NFR-6).
  installManifestFiles(newManifest, args.opts.pluginRoot, args.opts.harness, { sharedRoot: args.sharedRoot });
  await writeInstallJson(args.paths.installJson, {
    package_version: args.deliveringVersion,
    installed_at: new Date().toISOString(),
    last_writer_version: args.deliveringVersion,
    state_schema_version: 'v5',
  });
  // Base files (config.yml, registry.yml, .harness, .gitignore) — shared helper
  // also used by `radorch install` so doctor's bootstrap-skeleton check passes
  // on plugin-installed homes too.
  await writeBaseFiles(args.paths.root, args.opts.harness);
  return { action: args.action, code: 0, deliveringVersion: args.deliveringVersion, installedVersion: args.installedVersion };
}

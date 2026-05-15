import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { userDataPaths } from '../../lib/upgrade/user-data-paths.js';
import {
  readInstallJson,
  writeInstallJson,
  readInstallJsonMigrated,
} from '../../lib/upgrade/install-json-access.js';
import { acquireBootstrapLock } from '../../lib/upgrade/bootstrap-lock.js';
import { loadBundledManifest } from '../../lib/upgrade/catalog.js';
import { detectModifiedFiles } from '../../lib/upgrade/hash-check.js';
import { removeManifestFiles } from '../../lib/upgrade/remove.js';
import { installManifestFiles } from '../../lib/upgrade/install.js';
import {
  cmpSemver,
  detectChannelOverlap,
  resolveFolderConflict,
  isInstallJsonV6,
  migrateInstallJson,
  detectChannelHeuristic,
} from '../../lib/install-json.js';
import type { InstallJsonV6, InstallKey, InstallEntry, InstallChannel } from '../../lib/config.js';
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

/**
 * Section 6: derive the install-key from the channel + harness.
 *   - Plugin channel (no sharedRoot) targeting `claude`     → 'claude-plugin'
 *   - Legacy-installer channel targeting `claude`           → 'claude'
 *   - Legacy-installer channel targeting copilot-cli/vscode → matching key
 */
function deriveInstallKey(harness: HarnessName, channel: InstallChannel): InstallKey {
  if (channel === 'plugin') {
    // The plugin channel only ever installs into the claude harness today.
    return 'claude-plugin';
  }
  // Legacy-installer / unknown: install-key === harness.
  return harness as InstallKey;
}

/**
 * Emit the cross-channel warning text to stderr. Both warnings are loud but
 * do not block — friction-free continue.
 */
function emitCrossChannelWarning(installKey: InstallKey, partner: InstallKey): void {
  if (installKey === 'claude-plugin' && partner === 'claude') {
    process.stderr.write(
      'WARNING: A legacy install of rad-orchestration is also registered for the `claude` harness.\n' +
      'The plugin is the recommended channel. Both installs coexist in ~/.claude/ — the most recent\n' +
      "install's files will be on disk.\n" +
      '\n' +
      'To remove the legacy install and use only the plugin, run:\n' +
      '  npx rad-orchestration uninstall\n' +
      '\n' +
      'Continuing plugin install of `claude-plugin`.\n',
    );
    return;
  }
  if (installKey === 'claude' && partner === 'claude-plugin') {
    process.stderr.write(
      'WARNING: A Claude Code plugin install of rad-orchestration is already registered (claude-plugin).\n' +
      'The plugin is the recommended install channel. The legacy installer\'s `claude` harness will\n' +
      'coexist with the plugin in ~/.claude/ — the most recent install\'s files will be on disk.\n' +
      '\n' +
      'To use only the plugin (recommended), cancel this install and remove the legacy install you\n' +
      'were about to create. To use only the legacy installer, first run `/plugin uninstall\n' +
      'rad-orchestration` inside Claude Code, then re-run this installer.\n' +
      '\n' +
      'Continuing legacy install of `claude` harness.\n',
    );
  }
}

/**
 * Emit the folder-mutex notification (copilot-cli ↔ copilot-vscode replacement)
 * to stderr.
 */
function emitFolderMutexNotice(
  installKey: InstallKey,
  installingVersion: string,
  removed: { key: InstallKey; entry: InstallEntry },
): void {
  process.stderr.write(
    `[install] Replaced ${removed.key} (${removed.entry.version}) with ${installKey} (${installingVersion}) — both share ~/.copilot/, only one can be registered at a time.\n`,
  );
}

/** Build a fresh InstallEntry. */
function buildEntry(version: string, channel: InstallChannel): InstallEntry {
  return {
    version,
    channel,
    installed_at: new Date().toISOString(),
    last_writer_version: version,
  };
}

export async function runPluginBootstrap(opts: RunOpts): Promise<BootstrapResult> {
  const paths = userDataPaths();
  const sharedRoot = opts.sharedRoot ?? opts.pluginRoot;
  const isLegacy = !!opts.sharedRoot;
  const logChannel: InstallLogChannel = isLegacy ? 'legacy-installer' : 'claude-plugin';
  const channel: InstallChannel = isLegacy ? 'legacy-installer' : 'plugin';
  const installKey = deriveInstallKey(opts.harness, channel);
  const require_ = createRequire(import.meta.url);
  const pluginPkg = require_(path.join(opts.pluginRoot, 'package.json')) as { version: string };
  const deliveringVersion = pluginPkg.version;
  const haveInstallJson = fs.existsSync(paths.installJson);

  // Fresh-install short-circuit when no install.json present.
  if (!haveInstallJson) {
    const result = await doInstall({ paths, opts, sharedRoot, deliveringVersion, channel, installKey, action: 'fresh-install' });
    appendInstallLogEntry({ channel: logChannel, action: result.action, deliveringVersion, installedVersionBefore: null });
    return result;
  }

  // Load + lazy-migrate install.json. Use installKey as the migration default
  // when the file is v5 (single record represents this install identity).
  const ij: InstallJsonV6 | undefined = await readInstallJsonMigrated(paths.installJson, {
    activeKey: installKey,
    channel,
  });
  // readInstallJsonMigrated returns undefined only when install.json is absent;
  // corrupt JSON propagates as a throw. Treat absence as fresh install.
  if (!ij) {
    const result = await doInstall({ paths, opts, sharedRoot, deliveringVersion, channel, installKey, action: 'fresh-install' });
    appendInstallLogEntry({ channel: logChannel, action: result.action, deliveringVersion, installedVersionBefore: null });
    return result;
  }

  const existingEntry: InstallEntry | undefined = ij.harnesses[installKey];
  const installedVersion = existingEntry?.version;
  const installedVersionBefore: string | null = installedVersion ?? null;

  // Sentinel sanity check applies only when we believe a prior install exists
  // for this install-key. The CLI now lives inside the rad-orchestration skill
  // (no ~/.radorch/bin/), so check the plugin payload's copy as the
  // install-completion sentinel.
  const expectedSentinel = path.join(
    opts.pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs',
  );
  if (!existingEntry || !fs.existsSync(expectedSentinel)) {
    const result = await doInstall({ paths, opts, sharedRoot, deliveringVersion, channel, installKey, action: 'fresh-install', installedVersion });
    appendInstallLogEntry({ channel: logChannel, action: result.action, deliveringVersion, installedVersionBefore });
    return result;
  }

  const cmp = cmpSemver(deliveringVersion, installedVersion!);
  if (cmp === 0 && !opts.force) {
    appendInstallLogEntry({ channel: logChannel, action: 'noop', deliveringVersion, installedVersionBefore });
    return { action: 'noop', code: 0, deliveringVersion, installedVersion };
  }
  if (cmp < 0) {
    appendInstallLogEntry({ channel: logChannel, action: 'downgrade-noop', deliveringVersion, installedVersionBefore });
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
    appendInstallLogEntry({ channel: logChannel, action: 'lock-busy', deliveringVersion, installedVersionBefore });
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
    fs.mkdirSync(paths.projects, { recursive: true });
    fs.mkdirSync(paths.logs, { recursive: true });
    fs.mkdirSync(paths.runtime, { recursive: true });
    // Self-heal: existing-but-broken installs missing the base files (config.yml,
    // registry.yml, .harness, .gitignore) get them on next session bootstrap.
    await writeBaseFiles(paths.root, opts.harness);
    const priorManifest = loadBundledManifest(opts.pluginRoot, installedVersion!);
    const modified = detectModifiedFiles(priorManifest, opts.harness);
    if (modified.length > 0) {
      // plugin-bootstrap is always headless — log the modified-paths list to
      // stderr for diagnostic visibility and proceed with the upgrade.
      // Locally modified files are overwritten by the manifest install below.
      console.warn(`[plugin-bootstrap] overwriting ${modified.length} locally-modified file(s):`);
      for (const rel of modified) console.warn(`  ${path.join(paths.root, rel)}`);
    }
    removeManifestFiles(priorManifest, opts.harness);
    const newManifest = loadBundledManifest(opts.pluginRoot, deliveringVersion);
    installManifestFiles(newManifest, opts.pluginRoot, opts.harness, { sharedRoot });

    // Folder mutex: replace partner copilot variant if registered.
    const mutexResult = resolveFolderConflict(ij.harnesses, installKey);
    if (mutexResult.removed) {
      emitFolderMutexNotice(installKey, deliveringVersion, mutexResult.removed);
    }
    // Cross-channel coexistence warning (claude ↔ claude-plugin).
    const overlap = detectChannelOverlap(ij.harnesses, installKey);
    if (overlap) {
      emitCrossChannelWarning(installKey, overlap);
    }
    // Stamp per-key entry (preserve installed_at, bump version + last_writer).
    ij.harnesses[installKey] = {
      version: deliveringVersion,
      channel,
      installed_at: existingEntry.installed_at,
      last_writer_version: deliveringVersion,
    };
    await writeInstallJson(paths.installJson, ij);
    appendInstallLogEntry({ channel: logChannel, action: 'upgrade-complete', deliveringVersion, installedVersionBefore });
    return { action: 'upgrade-complete', code: 0, deliveringVersion, installedVersion };
  } catch (err) {
    appendInstallLogEntry({ channel: logChannel, action: 'error', deliveringVersion, installedVersionBefore });
    throw err;
  } finally {
    lock.release?.();
  }
}

async function doInstall(args: {
  paths: ReturnType<typeof userDataPaths>,
  opts: RunOpts,
  sharedRoot: string,
  deliveringVersion: string,
  channel: InstallChannel,
  installKey: InstallKey,
  action: BootstrapResult['action'],
  installedVersion?: string,
}): Promise<BootstrapResult> {
  // Fresh install path: skip hash-check + remove, run install + stamp install.json.
  const newManifest = loadBundledManifest(args.opts.pluginRoot, args.deliveringVersion);

  // Create standard .radorch subdirectories matching the shell script behavior.
  // FR-12: projects/ is user-owned; mkdir is recursive (no-op when present), never written into.
  fs.mkdirSync(args.paths.projects, { recursive: true });
  fs.mkdirSync(args.paths.logs, { recursive: true });
  fs.mkdirSync(args.paths.runtime, { recursive: true });

  installManifestFiles(newManifest, args.opts.pluginRoot, args.opts.harness, { sharedRoot: args.sharedRoot });

  // Read-modify-write the v6 registry. If install.json already exists (e.g.
  // sentinel-missing fresh re-install), preserve other harness entries.
  let registry: InstallJsonV6;
  if (fs.existsSync(args.paths.installJson)) {
    const existing = await readInstallJson(args.paths.installJson);
    if (isInstallJsonV6(existing)) {
      registry = existing;
    } else {
      const fallbackChannel = detectChannelHeuristic();
      registry = migrateInstallJson(existing, args.installKey, fallbackChannel);
    }
  } else {
    registry = { state_schema_version: 'v6', harnesses: {} };
  }

  // Folder mutex: remove partner copilot variant if registered.
  const mutexResult = resolveFolderConflict(registry.harnesses, args.installKey);
  if (mutexResult.removed) {
    emitFolderMutexNotice(args.installKey, args.deliveringVersion, mutexResult.removed);
  }
  // Cross-channel coexistence warning (claude ↔ claude-plugin).
  const overlap = detectChannelOverlap(registry.harnesses, args.installKey);
  if (overlap) {
    emitCrossChannelWarning(args.installKey, overlap);
  }
  registry.harnesses[args.installKey] = buildEntry(args.deliveringVersion, args.channel);
  await writeInstallJson(args.paths.installJson, registry);
  // Base files (config.yml, registry.yml, .harness, .gitignore) — shared helper
  // also used by `radorch install` so doctor's bootstrap-skeleton check passes
  // on plugin-installed homes too.
  await writeBaseFiles(args.paths.root, args.opts.harness);
  return { action: args.action, code: 0, deliveringVersion: args.deliveringVersion, installedVersion: args.installedVersion };
}

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
import type { HarnessName } from '../../lib/upgrade/harness-paths.js';
import type { BootstrapResult } from './envelope.js';

export interface RunOpts {
  pluginRoot: string;
  harness: HarnessName;
  force?: boolean;
  quiet?: boolean;
}

export async function runPluginBootstrap(opts: RunOpts): Promise<BootstrapResult> {
  const paths = userDataPaths();
  const require_ = createRequire(import.meta.url);
  const pluginPkg = require_(path.join(opts.pluginRoot, 'package.json')) as { version: string };
  const deliveringVersion = pluginPkg.version;
  const haveInstallJson = fs.existsSync(paths.installJson);
  // Fresh-install short-circuit when no install.json present.
  if (!haveInstallJson) {
    return await doInstall({ paths, opts, deliveringVersion, action: 'fresh-install' });
  }
  const ij = await readInstallJson(paths.installJson);
  const installedVersion = ij.package_version;
  // Sanity: if expected files are missing, treat as fresh.
  const expectedSentinel = path.join(paths.bin, 'radorch.mjs');
  if (!fs.existsSync(expectedSentinel)) {
    return await doInstall({ paths, opts, deliveringVersion, action: 'fresh-install', installedVersion });
  }
  const cmp = cmpSemver(deliveringVersion, installedVersion);
  if (cmp === 0 && !opts.force) {
    return { action: 'noop', code: 0, deliveringVersion, installedVersion };
  }
  if (cmp < 0) {
    return {
      action: 'downgrade-noop',
      code: 0,
      deliveringVersion,
      installedVersion,
      message: `Delivering v${deliveringVersion} is older than installed v${installedVersion}; no-op.`,
    };
  }
  // Upgrade path (or --force re-install).
  const lock = acquireBootstrapLock(paths.bootstrapLock);
  if (!lock.acquired) {
    return {
      action: 'lock-busy',
      code: 0,
      deliveringVersion,
      installedVersion,
      message: 'another bootstrap in progress',
    };
  }
  try {
    const priorManifest = loadBundledManifest(opts.pluginRoot, installedVersion);
    const modified = detectModifiedFiles(priorManifest, opts.harness);
    if (modified.length > 0) {
      const proceed = await confirmModifiedFiles(modified, paths.root);
      if (!proceed) {
        return { action: 'cancelled-modified-files', code: 0, deliveringVersion, installedVersion, modifiedFiles: modified };
      }
    }
    removeManifestFiles(priorManifest, opts.harness);
    const newManifest = loadBundledManifest(opts.pluginRoot, deliveringVersion);
    installManifestFiles(newManifest, opts.pluginRoot, opts.harness);
    await writeInstallJson(paths.installJson, {
      ...ij,
      package_version: deliveringVersion,
      last_writer_version: deliveringVersion,
    });
    return { action: 'upgrade-complete', code: 0, deliveringVersion, installedVersion };
  } finally {
    lock.release?.();
  }
}

async function doInstall(args: { paths: ReturnType<typeof userDataPaths>, opts: RunOpts, deliveringVersion: string, action: BootstrapResult['action'], installedVersion?: string }): Promise<BootstrapResult> {
  // Fresh install path: skip hash-check + remove, run install + stamp install.json.
  const newManifest = loadBundledManifest(args.opts.pluginRoot, args.deliveringVersion);
  installManifestFiles(newManifest, args.opts.pluginRoot, args.opts.harness);
  await writeInstallJson(args.paths.installJson, {
    package_version: args.deliveringVersion,
    installed_at: new Date().toISOString(),
    last_writer_version: args.deliveringVersion,
    state_schema_version: 'v5',
  });
  return { action: args.action, code: 0, deliveringVersion: args.deliveringVersion, installedVersion: args.installedVersion };
}

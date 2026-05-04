// installer/lib/uninstall.js — `radorch uninstall` orchestrator. Drives off
// the user's `package_version` (in <orchRoot>/skills/rad-orchestration/
// config/orchestration.yml) and the bundled-catalog manifest. No on-disk
// metadata is read or written outside that one yaml field.

import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { THEME, sectionHeader } from './theme.js';
import { readInstalledPackageVersion } from './installed-version.js';
import { loadBundledManifest } from './catalog.js';
import { detectModifiedFiles, confirmModifiedFiles } from './hash-check.js';
import { removeManifestFiles } from './remove.js';

/**
 * @param {Object} opts
 * @param {string} opts.installerRoot - Absolute path to the installer package root
 * @param {string} opts.resolvedOrchRoot - Absolute path to the user's orchRoot
 * @param {'claude-code'|'copilot-vscode'|'copilot-cli'} opts.tool
 * @param {(message: string, def?: boolean) => Promise<boolean>} [opts.promptConfirm] - injectable for tests
 * @returns {Promise<{ status: string, removedCount?: number, packageVersion?: string }>}
 */
export async function runUninstall(opts) {
  const { installerRoot, resolvedOrchRoot, tool } = opts;
  const promptConfirm = opts.promptConfirm
    ?? (async (message, def) => confirm({ message, default: def ?? false }));

  // 1. Detect prior install via package_version field.
  const installed = readInstalledPackageVersion(resolvedOrchRoot);
  if (installed === null) {
    console.log(THEME.body(`No rad-orchestration install detected at ${resolvedOrchRoot}.`));
    return { status: 'no-install-detected' };
  }
  if (installed.packageVersion === null) {
    // Pre-manifest install — print guidance, exit without modifying files.
    console.log('');
    sectionHeader('::', 'Pre-Manifest Install Detected');
    console.log('');
    console.log(THEME.body(
      `The orchestration.yml at ${resolvedOrchRoot} was installed by a pre-manifest version `
      + `(v1.0.0-alpha.7 or earlier). Auto-uninstall is not supported for these installs.`,
    ));
    console.log(THEME.body(
      `Follow the manual cleanup guidance in the MULTI-HARNESS-1 release notes:`,
    ));
    console.log('  ' + THEME.command(
      'https://github.com/MetalHexx/RadOrchestration/blob/main/README.md',
    ));
    console.log(THEME.body(
      `(back up local edits → delete ${resolvedOrchRoot} → re-run \`radorch\` for a clean install)`,
    ));
    return { status: 'pre-manifest' };
  }

  const packageVersion = installed.packageVersion;
  const fullManifest = loadBundledManifest(installerRoot, tool, packageVersion);

  // Filter orchestration.yml out of the manifest slice passed to
  // removeManifestFiles. It must be removed LAST — it is the signal to future
  // installer runs that no prior install exists at this orchRoot. Removing it
  // mid-stream (at its real position 51 of 1872) would orphan the remaining
  // files if any later removal throws or is interrupted.
  const ORC_YML_PATH = 'skills/rad-orchestration/config/orchestration.yml';
  const manifest = {
    ...fullManifest,
    files: fullManifest.files.filter((f) => f.bundlePath !== ORC_YML_PATH),
  };

  // 2. Detect-and-warn for locally-modified files via the shared primitive.
  // Use the full manifest so the yml entry is included in the hash check.
  const modified = detectModifiedFiles(fullManifest, resolvedOrchRoot);
  if (modified.length > 0) {
    // Bridge the positional promptConfirm used by runUninstall into the
    // options-object form that confirmModifiedFiles expects.
    const promptConfirmObj = async (confirmOpts) => promptConfirm(confirmOpts.message, confirmOpts.default);
    const proceedModified = await confirmModifiedFiles(modified, resolvedOrchRoot, promptConfirmObj, { message: 'Continue and delete these files?' });
    if (!proceedModified) {
      console.log(THEME.body('Uninstall cancelled.'));
      return { status: 'cancelled-modified-files' };
    }
  }

  // 3. Uninstall summary + confirm.
  console.log('');
  sectionHeader('::', 'Uninstall Summary');
  console.log('');
  console.log('  ' + THEME.label('Target:') + '         ' + THEME.body(resolvedOrchRoot));
  console.log('  ' + THEME.label('Version:') + '        ' + THEME.body(packageVersion));
  console.log('  ' + THEME.label('Files removed:') + '  ' + THEME.body(String(fullManifest.files.length)));
  console.log('');
  const proceed = await promptConfirm(
    `Uninstall rad-orchestration v${packageVersion} from ${resolvedOrchRoot}?`,
    false,
  );
  if (!proceed) {
    console.log(THEME.body('Uninstall cancelled.'));
    return { status: 'cancelled' };
  }

  // 4. Remove manifest files with per-category spinners matching the install
  //    flow's visual style (DD-3). Groups: agents/, skills/, everything else.
  //    orchestration.yml is excluded from this slice — it is handled last in step 5.
  const CATEGORIES = [
    { label: 'agents', prefix: 'agents/' },
    { label: 'skills', prefix: 'skills/' },
  ];
  let totalRemovedCount = 0;
  for (const cat of CATEGORIES) {
    const catFiles = manifest.files.filter((f) => f.bundlePath.startsWith(cat.prefix));
    if (catFiles.length === 0) continue;
    const catManifest = { ...manifest, files: catFiles };
    const catSpin = ora({ text: `Removing ${cat.label}…`, color: THEME.spinner }).start();
    const catResult = removeManifestFiles(catManifest, resolvedOrchRoot);
    catSpin.succeed(`Removed ${cat.label} (${catResult.removedCount} files)`);
    totalRemovedCount += catResult.removedCount;
  }
  // Catch any manifest entries not covered by the named categories above.
  const otherFiles = manifest.files.filter(
    (f) => !CATEGORIES.some((c) => f.bundlePath.startsWith(c.prefix)),
  );
  if (otherFiles.length > 0) {
    const otherManifest = { ...manifest, files: otherFiles };
    const otherSpin = ora({ text: 'Removing remaining files…', color: THEME.spinner }).start();
    const otherResult = removeManifestFiles(otherManifest, resolvedOrchRoot);
    otherSpin.succeed(`Removed remaining files (${otherResult.removedCount} files)`);
    totalRemovedCount += otherResult.removedCount;
  }

  // 5. Remove orchestration.yml LAST — this is the signal to future
  //    installer runs that no prior install exists at this orchRoot.
  const ymlSpin = ora({ text: 'Removing orchestration.yml…', color: THEME.spinner }).start();
  const ymlPath = path.join(
    resolvedOrchRoot, 'skills', 'rad-orchestration', 'config', 'orchestration.yml',
  );
  if (fs.existsSync(ymlPath)) fs.rmSync(ymlPath, { force: true });
  ymlSpin.succeed('Removed orchestration.yml');

  console.log('');
  console.log(THEME.body(`Uninstalled rad-orchestration v${packageVersion} from ${resolvedOrchRoot}`));
  return { status: 'completed', removedCount: totalRemovedCount, packageVersion };
}

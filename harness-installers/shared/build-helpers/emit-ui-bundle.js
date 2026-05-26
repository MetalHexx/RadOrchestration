// emit-ui-bundle.js — Builds Next.js standalone inside <source>/ui/, then
// packs standalone + static + public/ into a single gzipped tarball at
// <target> (a .tgz file path, not a directory). The tarball is opaque to
// both git (satellite `.gitignore` strips `node_modules/` and `.next/`) and
// npm-packlist (hardcoded strip of `node_modules/`), so the UI runtime
// survives both publish transports. Installers extract the tarball into
// `~/.radorch/ui/` at install time.
//
// Dev workflows (npm run dev inside ui/) remain unaffected — they create
// .next/ on demand and own it themselves; this helper applies only to
// installer builds.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';

/**
 * @param {{ source: string, target: string, runner?: () => Promise<void> }} opts
 *   - source: the ui/ source directory (contains package.json + next.config.mjs)
 *   - target: the .tgz file path to write (e.g. `<out>/_install-source/ui.tgz`)
 *   - runner: optional override for the `next build` invocation (test fast path)
 */
export async function emitUiBundle(opts) {
  const { source, target } = opts;
  const runner = opts.runner ?? (async () => {
    execSync('npm run build-standalone', {
      cwd: source,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  });
  await runner();

  // Stage the runtime layout under a sibling temp dir so tar.c sees a clean
  // tree rooted at the same shape installers will extract into ~/.radorch/ui/.
  const staging = target + '.staging';
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const standalone = path.join(source, '.next/standalone');
  if (fs.existsSync(standalone)) {
    fs.cpSync(standalone, staging, { recursive: true });
  }
  const staticSrc = path.join(source, '.next/static');
  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, path.join(staging, '.next/static'), { recursive: true });
  }
  const publicSrc = path.join(source, 'public');
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, path.join(staging, 'public'), { recursive: true });
  }

  // Pack into a single gzipped tarball. `portable: true` strips OS-specific
  // metadata so the output hashes deterministically across Win/macOS/Linux.
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { force: true });
  await tar.c(
    { gzip: true, file: target, cwd: staging, portable: true },
    ['.'],
  );

  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(path.join(source, '.next'), { recursive: true, force: true });
}

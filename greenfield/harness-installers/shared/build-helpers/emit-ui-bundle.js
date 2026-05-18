// emit-ui-bundle.js — Builds Next.js standalone inside <source>/ui/, copies
// standalone + static + public/ to <target>, then removes <source>/.next/.
// Dev workflows (npm run dev inside ui/) remain unaffected — they create
// .next/ on demand and own it themselves; this helper applies only to
// installer builds.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {{ source: string, target: string, runner?: () => Promise<void> }} opts
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
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  const standalone = path.join(source, '.next/standalone');
  fs.cpSync(standalone, target, { recursive: true });
  fs.cpSync(path.join(source, '.next/static'), path.join(target, '.next/static'), { recursive: true });
  const publicSrc = path.join(source, 'public');
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, path.join(target, 'public'), { recursive: true });
  }
  fs.rmSync(path.join(source, '.next'), { recursive: true, force: true });
}

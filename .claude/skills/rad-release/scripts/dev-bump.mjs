import { spawnSync } from 'node:child_process';
import { bumpVersion as defaultBump } from './bump-version.mjs';

export function suggestNextDev(current) {
  const m = /^(\d+\.\d+\.\d+)-alpha\.(\d+)$/.exec(current);
  if (!m) throw new Error('not an alpha pre-release: ' + current);
  return `${m[1]}-alpha.${Number(m[2]) + 1}`;
}

export async function runDevBump({
  repoRoot, from, to,
  bumpVersion = defaultBump, spawn = spawnSync,
}) {
  await bumpVersion({ from, to, repoRoot });
  const add = spawn('git', ['add', '-A'], { cwd: repoRoot, encoding: 'utf8' });
  if (add.status !== 0) throw new Error('git add failed: ' + add.stderr);
  const commit = spawn('git', ['commit', '-m', `chore: post-release dev bump to v${to}`], { cwd: repoRoot, encoding: 'utf8' });
  if (commit.status !== 0) throw new Error('git commit failed: ' + commit.stderr);
  const push = spawn('git', ['push', 'origin', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  if (push.status !== 0) throw new Error('git push failed: ' + push.stderr);
}

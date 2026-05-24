import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export async function gatherContext({ repoRoot }) {
  const cliPkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'cli', 'package.json'), 'utf8')
  );
  const currentVersion = cliPkg.version;
  const currentBranch = execSync('git branch --show-current', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const workingTreeDirty = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' }).trim() !== '';
  let lastReleaseTag = null;
  try {
    lastReleaseTag = execSync('git describe --tags --abbrev=0 --match "v*"', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch { /* no tags yet — fine */ }
  return { currentVersion, currentBranch, workingTreeDirty, lastReleaseTag };
}

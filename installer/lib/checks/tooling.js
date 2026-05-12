// installer/lib/checks/tooling.js — FR-17, AD-11.
// Unconditional install-time tooling availability checks. Non-blocking.
import { execFileSync } from 'node:child_process';

export function checkGit() {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return null; }
  catch { return 'git not found on PATH — install git before running projects with auto_commit.'; }
}

export function checkGh() {
  try { execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' }); return null; }
  catch (err) {
    if (err && err.code === 'ENOENT') return 'gh CLI not found on PATH — install from https://cli.github.com before running projects with auto_pr.';
    return 'gh CLI is not authenticated — run `gh auth login` before running projects with auto_pr.';
  }
}

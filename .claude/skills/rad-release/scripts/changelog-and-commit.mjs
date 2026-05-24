#!/usr/bin/env node
// FR-10 step 5-6: CHANGELOG approval gate and AD-4 atomic release commit.
//
// draftChangelog — produces a ## v{version} — {date} block with three sections:
//   ### What's New  (feat: commits)
//   ### What's Fixed (fix: commits)
//   ### Changes     (all other commits)
//
// commitRelease — prepends the approved CHANGELOG entry and lands exactly one
//   git commit with subject "chore: bump version to v{version}" (AD-4 atomicity).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Draft a CHANGELOG entry for the given version.
 *
 * @param {{ version: string, commits: string[], date?: string }} opts
 * @returns {Promise<string>} Markdown text for the new CHANGELOG block.
 */
export async function draftChangelog({ version, commits, date = new Date().toISOString().slice(0, 10) }) {
  const newFeatures = commits.filter(c => c.startsWith('feat')).map(c => `- ${c}`).join('\n');
  const fixes = commits.filter(c => c.startsWith('fix')).map(c => `- ${c}`).join('\n');
  const changes = commits.filter(c => !c.startsWith('feat') && !c.startsWith('fix')).map(c => `- ${c}`).join('\n');
  return [
    `## v${version} — ${date}`,
    '',
    `### What's New`,
    newFeatures || '_(none)_',
    '',
    `### What's Fixed`,
    fixes || '_(none)_',
    '',
    `### Changes`,
    changes || '_(none)_',
    '',
  ].join('\n');
}

/**
 * Prepend the approved CHANGELOG entry then land exactly one git commit (AD-4).
 *
 * @param {{
 *   repoRoot: string,
 *   version: string,
 *   approvedChangelog: string,
 *   spawn?: Function,
 *   writeFile?: Function,
 * }} opts
 */
export async function commitRelease({
  repoRoot,
  version,
  approvedChangelog,
  spawn = spawnSync,
  writeFile = fs.promises.writeFile,
}) {
  // Prepend the approved entry to CHANGELOG.md above the previous most-recent entry.
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
  const existing = fs.existsSync(changelogPath)
    ? await fs.promises.readFile(changelogPath, 'utf8')
    : '# Changelog\n\n---\n\n';
  const insertionPoint = existing.indexOf('## v');
  const updated =
    insertionPoint === -1
      ? existing + approvedChangelog + '\n'
      : existing.slice(0, insertionPoint) + approvedChangelog + '\n' + existing.slice(insertionPoint);
  await writeFile(changelogPath, updated, 'utf8');

  // AD-4: stage everything (bumped carriers, renamed manifest catalogs already
  // git-mv'd by bump-version.mjs, regenerated per-harness manifest files, CHANGELOG)
  // and land exactly one commit.
  const add = spawn('git', ['add', '-A'], { cwd: repoRoot, encoding: 'utf8' });
  if (add.status !== 0) throw new Error('git add failed: ' + add.stderr);

  const commit = spawn(
    'git',
    ['commit', '-m', `chore: bump version to v${version}`],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (commit.status !== 0) throw new Error('git commit failed: ' + commit.stderr);
}

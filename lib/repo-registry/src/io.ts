import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { Registry, RepoIdentity, RepoGroup } from './types.js';

const IDENTITY = 'repo-registry.yml';
const LOCAL = 'repo-registry.local.yml';

function readYaml<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return (yaml.load(fs.readFileSync(file, 'utf8')) as T) ?? fallback;
}

function atomicWrite(file: string, text: string): void {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

export function readRegistry({ root }: { root: string }): Registry {
  const id = readYaml<{ repos?: Record<string, RepoIdentity>; repo_groups?: Record<string, RepoGroup> }>(path.join(root, IDENTITY), {});
  const local = readYaml<{ paths?: Record<string, string> }>(path.join(root, LOCAL), {});
  return { repos: id.repos ?? {}, repoGroups: id.repo_groups ?? {}, localPaths: local.paths ?? {} };
}

export function writeIdentity({ root, repos, repoGroups }: { root: string; repos: Record<string, RepoIdentity>; repoGroups: Record<string, RepoGroup> }): void {
  atomicWrite(path.join(root, IDENTITY), yaml.dump({ repos, repo_groups: repoGroups }, { indent: 2, lineWidth: 80, noRefs: true }));
}

export function writeLocal({ root, localPaths }: { root: string; localPaths: Record<string, string> }): void {
  atomicWrite(path.join(root, LOCAL), yaml.dump({ paths: localPaths }, { indent: 2, noRefs: true }));
  ensureLocalGitignored({ root });
}

export function ensureLocalGitignored({ root }: { root: string }): void {
  const gi = path.join(root, '.gitignore');
  const existing = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (existing.split(/\r?\n/).includes(LOCAL)) return;
  const next = existing && !existing.endsWith('\n') ? existing + '\n' + LOCAL + '\n' : existing + LOCAL + '\n';
  atomicWrite(gi, next);
}

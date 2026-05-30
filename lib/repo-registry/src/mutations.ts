import type { RepoIdentity, RepoGroup } from './types.js';
import { readRegistry, writeIdentity, writeLocal } from './io.js';
import { isSlug, assertUniqueName } from './validate.js';

export interface AddRepoOpts { root: string; name: string; identity: RepoIdentity; localPath: string }
export interface RemoveRepoOpts { root: string; name: string }
export interface CreateGroupOpts { root: string; name: string; members: string[]; description?: string }
export interface GroupMemberOpts { root: string; group: string; repo: string }
export interface DeleteGroupOpts { root: string; name: string }

export function addRepo({ root, name, identity, localPath }: AddRepoOpts): void {
  if (!isSlug(name)) throw new Error(`name '${name}' is not a valid slug`);
  const reg = readRegistry({ root });
  assertUniqueName(reg, name);
  reg.repos[name] = identity;
  reg.localPaths[name] = localPath;
  writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
  writeLocal({ root, localPaths: reg.localPaths });
}

export function removeRepo({ root, name }: RemoveRepoOpts): void {
  const reg = readRegistry({ root });
  delete reg.repos[name];
  delete reg.localPaths[name];
  for (const group of Object.values(reg.repoGroups)) {
    group.members = group.members.filter(m => m !== name);
  }
  writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
  writeLocal({ root, localPaths: reg.localPaths });
}

export function createGroup({ root, name, members, description = '' }: CreateGroupOpts): void {
  if (!isSlug(name)) throw new Error(`name '${name}' is not a valid slug`);
  const reg = readRegistry({ root });
  assertUniqueName(reg, name);
  const group: RepoGroup = { description, members: [...members] };
  reg.repoGroups[name] = group;
  writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}

export function addGroupMember({ root, group, repo }: GroupMemberOpts): void {
  const reg = readRegistry({ root });
  const grp = reg.repoGroups[group];
  if (!grp) throw new Error(`group '${group}' does not exist`);
  if (!grp.members.includes(repo)) {
    grp.members.push(repo);
  }
  writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}

export function removeGroupMember({ root, group, repo }: GroupMemberOpts): void {
  const reg = readRegistry({ root });
  const grp = reg.repoGroups[group];
  if (!grp) return;
  grp.members = grp.members.filter(m => m !== repo);
  writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}

export function deleteGroup({ root, name }: DeleteGroupOpts): void {
  const reg = readRegistry({ root });
  delete reg.repoGroups[name];
  writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}

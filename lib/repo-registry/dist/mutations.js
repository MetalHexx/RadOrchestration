import { readRegistry, writeIdentity, writeLocal } from './io.js';
import { isSlug, assertUniqueName } from './validate.js';
export function addRepo({ root, name, identity, localPath }) {
    if (!isSlug(name))
        throw new Error(`name '${name}' is not a valid slug`);
    const reg = readRegistry({ root });
    assertUniqueName(reg, name);
    reg.repos[name] = identity;
    reg.localPaths[name] = localPath;
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
    writeLocal({ root, localPaths: reg.localPaths });
}
export function removeRepo({ root, name }) {
    const reg = readRegistry({ root });
    const hadLocalPath = name in reg.localPaths;
    delete reg.repos[name];
    delete reg.localPaths[name];
    for (const group of Object.values(reg.repoGroups)) {
        group.members = group.members.filter(m => m !== name);
    }
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
    if (hadLocalPath) {
        writeLocal({ root, localPaths: reg.localPaths });
    }
}
export function createGroup({ root, name, members, description = '' }) {
    if (!isSlug(name))
        throw new Error(`name '${name}' is not a valid slug`);
    const reg = readRegistry({ root });
    assertUniqueName(reg, name);
    const group = { description, members: [...members] };
    reg.repoGroups[name] = group;
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}
export function addGroupMember({ root, group, repo }) {
    const reg = readRegistry({ root });
    const grp = reg.repoGroups[group];
    if (!grp)
        throw new Error(`group '${group}' does not exist`);
    if (!grp.members.includes(repo)) {
        grp.members.push(repo);
    }
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}
export function removeGroupMember({ root, group, repo }) {
    const reg = readRegistry({ root });
    const grp = reg.repoGroups[group];
    if (!grp)
        return;
    grp.members = grp.members.filter(m => m !== repo);
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}
export function deleteGroup({ root, name }) {
    const reg = readRegistry({ root });
    delete reg.repoGroups[name];
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}
export function editRepo({ root, name, description, remote, defaultBranch }) {
    const reg = readRegistry({ root });
    const identity = reg.repos[name];
    if (!identity)
        throw new Error(`repo '${name}' does not exist`);
    if (description !== undefined)
        identity.description = description;
    if (remote !== undefined)
        identity.remote = remote;
    if (defaultBranch !== undefined)
        identity.default_branch = defaultBranch;
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
    return identity;
}
export function bindRepo({ root, name, localPath }) {
    const reg = readRegistry({ root });
    if (!(name in reg.repos))
        throw new Error(`repo '${name}' does not exist`);
    reg.localPaths[name] = localPath;
    writeLocal({ root, localPaths: reg.localPaths });
}
export function editGroup({ root, name, description }) {
    const reg = readRegistry({ root });
    const grp = reg.repoGroups[name];
    if (!grp)
        throw new Error(`group '${name}' does not exist`);
    grp.description = description;
    writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
}
//# sourceMappingURL=mutations.js.map
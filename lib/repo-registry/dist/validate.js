export function isSlug(name) { return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name); }
export function assertUniqueName(reg, name) {
    if (name in reg.repos || name in reg.repoGroups) {
        throw new Error(`name '${name}' already exists as a repo or repo-group`);
    }
}
//# sourceMappingURL=validate.js.map
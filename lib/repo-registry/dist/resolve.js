export function resolveRepoPath(reg, name) {
    const local = reg.localPaths[name];
    if (local)
        return { name, bound: true, path: local, hint: null };
    return { name, bound: false, path: null, hint: `run \`radorch repo bind ${name} <path>\`` };
}
//# sourceMappingURL=resolve.js.map
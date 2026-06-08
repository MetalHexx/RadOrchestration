export function slugify(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export function groupId(name) {
    return `group:${slugify(name)}`;
}
export function isGroupId(id) {
    return id.startsWith('group:');
}
//# sourceMappingURL=ids.js.map
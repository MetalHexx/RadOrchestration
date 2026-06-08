export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export function groupId(name: string): string {
  return `group:${slugify(name)}`;
}
export function isGroupId(id: string): boolean {
  return id.startsWith('group:');
}

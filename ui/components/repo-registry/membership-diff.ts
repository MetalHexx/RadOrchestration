export type RowStatus = 'plain' | 'checked' | 'pending-add' | 'pending-remove';

export function rowStatus(
  slug: string,
  saved: string[],
  checked: Set<string>,
  mode: 'detail' | 'create',
): RowStatus {
  const isChecked = checked.has(slug);
  if (mode === 'create') return isChecked ? 'checked' : 'plain';
  const wasSaved = saved.includes(slug);
  if (isChecked && !wasSaved) return 'pending-add';
  if (!isChecked && wasSaved) return 'pending-remove';
  return 'plain';
}

export function desiredSet(checked: Set<string>): string[] {
  return [...checked].sort();
}

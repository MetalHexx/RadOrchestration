import type { RepoGroupRead } from './types';
import { isRequiredFilled, requiredMessage } from './validation-mirror';

export interface GroupDraft { description: string; members: string[] }

export function groupDraftFrom(g: RepoGroupRead): GroupDraft {
  return { description: g.description, members: [...g.members] };
}

export function validateGroupDraft(d: GroupDraft): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!isRequiredFilled(d.description)) errs.description = requiredMessage('description');
  return errs;
}

export function validateGroupDraftField(field: string, d: GroupDraft): string | undefined {
  return validateGroupDraft(d)[field];
}

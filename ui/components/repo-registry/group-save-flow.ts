import type { RepoGroupRead } from './types';
import { isRequiredFilled } from './validation-mirror';

export interface GroupDraft { description: string; members: string[] }

export function groupDraftFrom(g: RepoGroupRead): GroupDraft {
  return { description: g.description, members: [...g.members] };
}

export function validateGroupDraft(d: GroupDraft): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!isRequiredFilled(d.description)) errs.description = 'description is required.';
  return errs;
}

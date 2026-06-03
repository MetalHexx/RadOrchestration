import type { Registry } from '@rad-orchestration/repo-registry';

export type ErrorCode =
  | 'SLUG_INVALID' | 'NAME_TAKEN' | 'REQUIRED'
  | 'PATH_INVALID' | 'NOT_FOUND' | 'IMMUTABLE_SLUG';

const STATUS: Record<ErrorCode, number> = {
  SLUG_INVALID: 400, NAME_TAKEN: 409, REQUIRED: 400,
  PATH_INVALID: 400, NOT_FOUND: 404, IMMUTABLE_SLUG: 400,
};

export function statusForCode(code: ErrorCode): number { return STATUS[code]; }

export class RegistryError extends Error {
  constructor(public code: ErrorCode, message: string, public field: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

export type { Registry };

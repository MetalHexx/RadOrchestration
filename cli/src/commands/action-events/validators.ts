import { UserError } from '../../framework/errors.js';

const NAME_RE = /^[a-z0-9_]+$/;

export function validateKind(kind: unknown): 'action' | 'event' {
  if (kind !== 'action' && kind !== 'event') {
    throw new UserError(`--kind must be 'action' or 'event' (got '${String(kind)}')`);
  }
  return kind;
}

export function validateName(name: unknown): string {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new UserError(`--name must match /^[a-z0-9_]+$/ (got '${String(name)}')`);
  }
  return name;
}

export function validateSlot(slot: unknown, kind: 'action' | 'event'): 'pre' | 'post' {
  if (slot !== 'pre' && slot !== 'post') {
    throw new UserError(`--slot must be 'pre' or 'post' (got '${String(slot)}')`);
  }
  if (kind === 'action' && slot === 'post') {
    throw new UserError(`--slot 'post' is not valid for kind 'action'`);
  }
  return slot;
}

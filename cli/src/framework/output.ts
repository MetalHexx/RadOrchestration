import type { ErrorType } from './errors.js';

export interface SuccessEnvelope<TData = unknown> {
  ok: true;
  data: TData;
  warnings?: string[];
  prompt?: string;
  next_action?: string;
}

export interface FailureEnvelope {
  ok: false;
  error: { type: ErrorType; message: string };
  warnings?: string[];
}

export type Envelope<TData = unknown> = SuccessEnvelope<TData> | FailureEnvelope;

const ALLOWED_ERROR_TYPES: readonly ErrorType[] = ['user_error', 'system_error'];

export function validateEnvelope(env: unknown): asserts env is Envelope {
  if (!env || typeof env !== 'object') throw new Error('envelope must be an object');
  const e = env as Record<string, unknown>;
  if (typeof e.ok !== 'boolean') throw new Error('envelope missing boolean `ok`');
  if (e.ok === true) {
    if (!('data' in e)) throw new Error('success envelope must carry `data`');
    if ('error' in e) throw new Error('success envelope must not carry `error` (data xor error)');
  } else {
    if (!('error' in e) || !e.error || typeof e.error !== 'object') {
      throw new Error('failure envelope must carry an `error` object');
    }
    if ('data' in e) throw new Error('failure envelope must not carry `data` (data xor error)');
    const err = e.error as Record<string, unknown>;
    if (typeof err.message !== 'string') throw new Error('error.message must be a string');
    if (!ALLOWED_ERROR_TYPES.includes(err.type as ErrorType)) {
      throw new Error(`error.type must be one of ${ALLOWED_ERROR_TYPES.join(' | ')}`);
    }
  }
}

/**
 * The single permitted call site for `console.log` in the package.
 * ESLint's no-console rule is disabled exclusively for this file (see eslint.config.js).
 */
export function emit(env: Envelope): void {
  validateEnvelope(env);
  console.log(JSON.stringify(env));
}

import type { ErrorType } from './errors.js';

export interface SuccessEnvelope<TData = unknown> {
  ok: true;
  data: TData;
  warnings?: string[];
  prompt?: string;
  next_action?: string;
  /**
   * Optional exit-code override for commands whose exit semantics differ from the
   * default (`ok: true` → 0). Doctor uses this to express "envelope is `ok: true`
   * but the run encountered findings and should exit 1" (FR-21). When unset,
   * runCommand falls back to the default mapping.
   */
  exit_code?: number;
}

export interface FailureEnvelope {
  ok: false;
  error: { type: ErrorType; message: string };
  warnings?: string[];
  /**
   * Optional failure-context envelope extension used by pipeline-signal (FR-5)
   * to carry the offending event and field so the orchestrator can diagnose
   * malformed input without parsing the human message. Other failure-emitting
   * callers never set `data` on failure, preserving the data-xor-error invariant
   * for those paths.
   */
  data?: { event: string; field?: string };
}

export type Envelope<TData = unknown> = SuccessEnvelope<TData> | FailureEnvelope;

const ALLOWED_ERROR_TYPES: readonly ErrorType[] = ['user_error', 'system_error'];

export function validateEnvelope(env: unknown): asserts env is Envelope {
  if (!env || typeof env !== 'object') throw new Error('envelope must be an object');
  const e = env as Record<string, unknown>;
  if (typeof e['ok'] !== 'boolean') throw new Error('envelope missing boolean `ok`');
  if (e['ok'] === true) {
    if (!('data' in e)) throw new Error('success envelope must carry `data`');
    if ('error' in e) throw new Error('success envelope must not carry `error` (data xor error)');
    if ('exit_code' in e && typeof e['exit_code'] !== 'number') {
      throw new Error('success envelope `exit_code` must be a number when present');
    }
  } else {
    if (!('error' in e) || !e['error'] || typeof e['error'] !== 'object') {
      throw new Error('failure envelope must carry an `error` object');
    }
    const err = e['error'] as Record<string, unknown>;
    if (typeof err['message'] !== 'string') throw new Error('error.message must be a string');
    if (!ALLOWED_ERROR_TYPES.includes(err['type'] as ErrorType)) {
      throw new Error(`error.type must be one of ${ALLOWED_ERROR_TYPES.join(' | ')}`);
    }
    if ('data' in e) {
      const d = e['data'];
      if (!d || typeof d !== 'object') {
        throw new Error('failure envelope `data` must be an object when present');
      }
      if (typeof (d as Record<string, unknown>)['event'] !== 'string') {
        throw new Error('failure envelope `data.event` must be a string when `data` is present');
      }
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

export type ParseErrorFlagResult =
  | { ok: true; value: { line: number; expected: string; found: string; message: string } }
  | { ok: false; error: { field: 'parse-error'; message: string } };

export function parseParseErrorFlag(raw: string): ParseErrorFlagResult {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { ok: false, error: { field: 'parse-error', message: `Invalid JSON for --parse-error: ${(e as Error).message}` } }; }
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, error: { field: 'parse-error', message: `Invalid --parse-error shape: expected an object, got ${parsed === null ? 'null' : typeof parsed}` } };
  }
  const p = parsed as Record<string, unknown>;
  if (!Number.isInteger(p['line']) || (p['line'] as number) < 1 ||
      typeof p['expected'] !== 'string' || typeof p['found'] !== 'string' || typeof p['message'] !== 'string') {
    return { ok: false, error: { field: 'parse-error', message: 'Invalid --parse-error shape: expected { line: positive integer, expected: string, found: string, message: string }' } };
  }
  return { ok: true, value: { line: p['line'] as number, expected: p['expected'] as string, found: p['found'] as string, message: p['message'] as string } };
}

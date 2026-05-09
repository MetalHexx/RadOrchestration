import type { LogEntry, LogLevel, LogSource, Logger, Sink } from './types.js';
import { LOG_LEVELS } from './types.js';

const RANK: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

export interface CreateLoggerOptions {
  level: LogLevel;
  sink: Sink;
  source: LogSource;
}

export function resolveLogLevel(env: NodeJS.ProcessEnv = process.env, fallback: LogLevel = 'info'): LogLevel {
  const raw = env['RADORCH_LOG_LEVEL'];
  if (raw && (LOG_LEVELS as readonly string[]).includes(raw)) return raw as LogLevel;
  return fallback;
}

export function createLogger(opts: CreateLoggerOptions): Logger {
  async function emit(level: LogLevel, message: string, payload: Record<string, unknown> = {}): Promise<void> {
    if (RANK[level] > RANK[opts.level]) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source: opts.source,
      ...payload,
      message,
    };
    await opts.sink.write(entry);
  }
  return {
    error: (m, p) => emit('error', m, p),
    warn: (m, p) => emit('warn', m, p),
    info: (m, p) => emit('info', m, p),
    debug: (m, p) => emit('debug', m, p),
    flush: () => opts.sink.flush(),
  };
}

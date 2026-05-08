export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogSource = 'cli' | 'skill' | 'pipeline' | 'runtime';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  command?: string;
  args?: unknown;
  duration_ms?: number;
  result?: string;
  project?: string;
  error?: { type: string; message: string };
  [extra: string]: unknown;
}

export interface Sink {
  write(entry: LogEntry): Promise<void>;
  flush(): Promise<void>;
}

export interface Logger {
  error(message: string, payload?: Record<string, unknown>): Promise<void>;
  warn(message: string, payload?: Record<string, unknown>): Promise<void>;
  info(message: string, payload?: Record<string, unknown>): Promise<void>;
  debug(message: string, payload?: Record<string, unknown>): Promise<void>;
  flush(): Promise<void>;
}

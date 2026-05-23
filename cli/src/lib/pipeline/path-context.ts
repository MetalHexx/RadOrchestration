import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PathContext } from './types.js';

export function resolvePathContext(): PathContext {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const templatesDir = path.join(os.homedir(), '.radorch', 'templates');
  return { scriptsDir, templatesDir };
}

export function resolveDiscoveredConfigPath(): string {
  return path.join(os.homedir(), '.radorch', 'orchestration.yml');
}

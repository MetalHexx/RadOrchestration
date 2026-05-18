import fs from 'node:fs/promises';
import { writeFileAtomic } from './fs-helpers.js';

export interface InstallEntry {
  version: string;
  channel: InstallChannel;
  installed_at: string;
  last_writer_version: string;
}
export type InstallChannel = 'plugin' | 'legacy-installer' | 'unknown';
export type InstallKey = 'claude' | 'claude-plugin' | 'copilot-cli' | 'copilot-vscode';
export interface InstallJson {
  harnesses: Partial<Record<InstallKey, InstallEntry>>;
}

export async function readInstallJson(file: string): Promise<InstallJson> {
  const text = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(text) as Record<string, unknown>;
  // Structural lift — drop any state_schema_version field on read.
  if ('state_schema_version' in parsed) delete (parsed as Record<string, unknown>).state_schema_version;
  // Treat any shape without a `harnesses` object as "not installed" (empty registry).
  if (typeof parsed.harnesses !== 'object' || parsed.harnesses === null) {
    return { harnesses: {} };
  }
  return parsed as unknown as InstallJson;
}
export async function writeInstallJson(file: string, value: InstallJson): Promise<void> {
  const sanitized: Record<string, unknown> = { ...value };
  delete sanitized.state_schema_version;
  await writeFileAtomic(file, JSON.stringify(sanitized, null, 2) + '\n');
}

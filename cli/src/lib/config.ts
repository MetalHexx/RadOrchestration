import fs from 'node:fs/promises';
import { writeFileAtomic } from './fs-helpers.js';
import { parseYaml, stringifyYaml } from './yaml.js';
import type { HarnessName } from '../framework/harness.js';

/** v5: flat single-record install.json (pre-multi-harness). All fields optional
 * for back-compat with older test fixtures and pre-iter-02 installs that lacked
 * `last_writer_version` / `state_schema_version`. */
export interface InstallJsonV5 {
  package_version: string;
  installed_at: string;
  last_writer_version?: string;
  state_schema_version?: 'v5';
  // (No `harnesses` key — distinguishes from v6.)
}

/** A single harness's install record under the v6 registry. */
export interface InstallEntry {
  version: string;
  channel: InstallChannel;
  installed_at: string;
  last_writer_version: string;
}

export type InstallChannel = 'plugin' | 'legacy-installer' | 'unknown';

/** The four valid install-keys (install identities). See `INSTALL_KEYS` in
 * install-json.ts for the runtime value list. */
export type InstallKey = 'claude' | 'claude-plugin' | 'copilot-cli' | 'copilot-vscode';

/** v6: multi-harness/multi-channel registry. Top-level discriminator is
 * `state_schema_version: 'v6'`. */
export interface InstallJsonV6 {
  state_schema_version: 'v6';
  harnesses: Partial<Record<InstallKey, InstallEntry>>;
}

/** Discriminated union over v5 and v6. Readers obtain this union and narrow
 * via `isInstallJsonV6` (from ./install-json.ts) or by calling
 * `migrateInstallJson` to coerce to v6. */
export type InstallJson = InstallJsonV5 | InstallJsonV6;

export interface ConfigYml {
  default_active_harness: HarnessName;
}

export async function readInstallJson(file: string): Promise<InstallJson> {
  const text = await fs.readFile(file, 'utf8');
  return JSON.parse(text) as InstallJson;
}
export async function writeInstallJson(file: string, value: InstallJson): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n');
}
export async function readConfigYml(file: string): Promise<ConfigYml> {
  const text = await fs.readFile(file, 'utf8');
  const parsed = parseYaml<ConfigYml>(text);
  if (parsed === undefined) throw new Error(`config.yml at ${file} is empty`);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`config.yml at ${file} is malformed: expected an object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }
  return parsed;
}
export async function writeConfigYml(file: string, value: ConfigYml): Promise<void> {
  await writeFileAtomic(file, stringifyYaml(value));
}

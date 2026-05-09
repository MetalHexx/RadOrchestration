import fs from 'node:fs/promises';
import { writeFileAtomic } from './fs-helpers.js';
import { parseYaml, stringifyYaml } from './yaml.js';
import type { HarnessName } from '../framework/harness.js';

export interface InstallJson {
  package_version: string;
  installed_at: string;
  last_writer_version: string;
  state_schema_version: string;
}
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

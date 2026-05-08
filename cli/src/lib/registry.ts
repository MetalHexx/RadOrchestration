import fs from 'node:fs/promises';
import { writeFileAtomic } from './fs-helpers.js';
import { parseYaml, stringifyYaml } from './yaml.js';

export interface RegistryYml {
  repos: unknown[];
  workspaces: unknown[];
  [extra: string]: unknown;
}
const SKELETON: RegistryYml = { repos: [], workspaces: [] };

export async function writeRegistrySkeleton(file: string): Promise<void> {
  await writeFileAtomic(file, stringifyYaml(SKELETON));
}
export async function readRegistry(file: string): Promise<RegistryYml> {
  const text = await fs.readFile(file, 'utf8');
  const parsed = parseYaml<RegistryYml>(text);
  if (parsed === undefined) return { ...SKELETON };
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`registry.yml at ${file} is malformed: expected an object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }
  return parsed;
}

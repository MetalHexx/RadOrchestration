import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineCommand } from '../../framework/command.js';
import type { CommandContext } from '../../framework/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProjectContextResult {
  repoRoot: string;
  repoName: string;
  repoParent: string;
  currentBranch: string;
  defaultBranch: string;
  platform: 'windows' | 'mac' | 'linux';
  orchRoot: string;
  projectsBasePath: string;
  configAutoCommit: string;
  configAutoPr: string;
  remoteUrl: string;
  projectDir: string | null;
  sourceControlInitialized: boolean | null;
}

type Exec = (file: string, args: string[], opts?: { cwd?: string; encoding: 'utf8' }) => string;

export interface ProjectContextOptions { projectName?: string; exec?: Exec }

function deriveRemoteUrl(raw: string): string {
  if (!raw) return '';
  const ssh = raw.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (ssh) return `https://github.com/${ssh[1]}`;
  if (raw.startsWith('https://')) return raw.replace(/\.git$/, '');
  return '';
}

function parseSimpleYaml(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const stack: { indent: number; prefix: string }[] = [];
  for (const raw of content.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const indent = raw.search(/\S/);
    const trimmed = raw.trim();
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)/);
    if (!m) continue;
    const prefix = stack.length > 0 ? `${stack[stack.length - 1]!.prefix}.${m[1]}` : m[1]!;
    let value = m[2] ?? '';
    if (value === '') { stack.push({ indent, prefix }); continue; }
    value = value.replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
    out[prefix] = value;
  }
  return out;
}

function isSourceControlInitialized(state: unknown): boolean {
  const sc = (state as { pipeline?: { source_control?: { auto_commit?: unknown; auto_pr?: unknown } } } | undefined)
    ?.pipeline?.source_control;
  return !!sc && typeof sc === 'object' && !Array.isArray(sc)
    && typeof sc.auto_commit === 'string' && sc.auto_commit !== ''
    && typeof sc.auto_pr === 'string' && sc.auto_pr !== '';
}

export function projectContext(opts: ProjectContextOptions = {}): ProjectContextResult {
  const exec = opts.exec ?? ((f, a, o) => execFileSync(f, a, { ...o, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) as unknown as string);
  const repoRootRaw = String(exec('git', ['rev-parse', '--show-toplevel'])).trim();
  const repoRoot = path.resolve(repoRootRaw);
  const repoName = path.basename(repoRoot);
  const repoParent = path.dirname(repoRoot);

  let currentBranch = 'HEAD';
  try { currentBranch = String(exec('git', ['branch', '--show-current'])).trim() || 'HEAD'; } catch { /* keep */ }

  let defaultBranch = 'main';
  try {
    const ref = String(exec('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'])).trim();
    defaultBranch = ref.split('/').pop() || 'main';
  } catch {
    try {
      const branches = String(exec('git', ['branch', '-r'])).trim();
      if (branches.includes('origin/master') && !branches.includes('origin/main')) defaultBranch = 'master';
    } catch { /* keep main */ }
  }

  const platformMap: Record<string, 'windows' | 'mac' | 'linux'> = { win32: 'windows', darwin: 'mac' };
  const platform = platformMap[process.platform] ?? 'linux';

  const orchRoot = path.resolve(__dirname, '..', '..', '..');
  const projectsBasePath = path.join(os.homedir(), '.radorch', 'projects');
  const configPath = path.join(os.homedir(), '.radorch', 'orchestration.yml');

  let configAutoCommit = 'ask';
  let configAutoPr = 'ask';
  if (fs.existsSync(configPath)) {
    try {
      const yaml = parseSimpleYaml(fs.readFileSync(configPath, 'utf8'));
      if (yaml['source_control.auto_commit']) configAutoCommit = yaml['source_control.auto_commit'];
      if (yaml['source_control.auto_pr']) configAutoPr = yaml['source_control.auto_pr'];
    } catch { /* defaults */ }
  }

  let remoteUrl = '';
  try { remoteUrl = deriveRemoteUrl(String(exec('git', ['remote', 'get-url', 'origin'])).trim()); } catch { /* none */ }

  let projectDir: string | null = null;
  let sourceControlInitialized: boolean | null = null;
  if (opts.projectName) {
    projectDir = path.join(projectsBasePath, opts.projectName);
    const stateJson = path.join(projectDir, 'state.json');
    if (fs.existsSync(stateJson)) {
      try { sourceControlInitialized = isSourceControlInitialized(JSON.parse(fs.readFileSync(stateJson, 'utf8'))); }
      catch { sourceControlInitialized = false; }
    } else {
      sourceControlInitialized = false;
    }
  }

  return {
    repoRoot, repoName, repoParent, currentBranch, defaultBranch, platform,
    orchRoot, projectsBasePath, configAutoCommit, configAutoPr, remoteUrl,
    projectDir, sourceControlInitialized,
  };
}

interface Args { 'project-name'?: string }

export const projectContextCommand = defineCommand({
  name: 'project-context',
  description: 'Return the shared context block for the workspace and optional project',
  args: {
    'project-name': { description: 'When set, result includes the project-state block' },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => projectContext({ projectName: args['project-name'] }),
});

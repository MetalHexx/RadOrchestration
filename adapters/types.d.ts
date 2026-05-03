// adapters/types.d.ts — The five capability surfaces every adapter implements.

/** Produces the harness-specific output filename for a canonical agent or skill. */
export type FilenameRule = (input: {
  kind: 'agent' | 'skill';
  canonicalName: string;
}) => string;

/** Projects canonical Claude-shape agent frontmatter to the harness's frontmatter. */
export type AgentFrontmatterProjector = (
  canonical: Record<string, unknown>,
  ctx: { adapter: Adapter },
) => Record<string, unknown>;

/** Projects canonical Claude-shape skill frontmatter to the harness's frontmatter. */
export type SkillFrontmatterProjector = (
  canonical: Record<string, unknown>,
  ctx: { adapter: Adapter },
) => Record<string, unknown>;

/** Maps Claude PascalCase tool names ('Read', 'Bash', 'Edit', ...) to the harness's tool vocabulary. */
export type ToolDictionary = Readonly<Record<string, string>>;

/** Maps Claude tier aliases ('haiku' | 'sonnet' | 'opus') to the harness's accepted model identifier. */
export type ModelAliasMap = Readonly<{
  haiku: string;
  sonnet: string;
  opus: string;
}>;

/** One row of the per-file metadata stream emitted alongside the bundle. */
export interface MetadataStreamEntry {
  bundlePath: string;          // path of emitted file relative to bundle root
  sourcePath: string;          // path of canonical source relative to repo root
  ownership: 'orchestration-system';
  version: string;             // orchestration-system version that produced the file
  harness: string;             // adapter folder name, e.g. 'claude'
  sha256: string;              // hex SHA-256 of the emitted file's bytes
}

/** A single self-contained adapter exposing all five capability surfaces. */
export interface Adapter {
  readonly name: string;          // adapter folder name (e.g. 'claude', 'copilot-vscode')
  readonly targetDir: string;     // relative to repo root, e.g. '.claude' or '.github'
  readonly filenameRule: FilenameRule;
  readonly agentFrontmatter: AgentFrontmatterProjector;
  readonly skillFrontmatter: SkillFrontmatterProjector;
  readonly toolDictionary: ToolDictionary;
  readonly modelAliases: ModelAliasMap;
}

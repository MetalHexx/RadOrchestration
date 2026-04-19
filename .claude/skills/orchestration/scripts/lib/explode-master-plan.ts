import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { readState, writeState, readDocument } from './state-io.js';
import { validateFrontmatter } from './frontmatter-validators.js';
import type {
  PipelineState,
  IterationEntry,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  StepNodeState,
} from './types.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ParsedTask {
  /** Compound id, e.g. "P01-T01". */
  id: string;
  /** 1-based phase index this task belongs to. */
  phaseIndex: number;
  /** 1-based task index within the phase. */
  taskIndex: number;
  /** Human-readable title (after the colon). */
  title: string;
  /** Requirement tags mentioned in the task body (e.g. ["FR-1", "DD-1"]). */
  requirementTags: string[];
  /** Raw lines of the task body, preserved for downstream emission. */
  body: string;
}

export interface ParsedPhase {
  /** Phase id, e.g. "P01". */
  id: string;
  /** 1-based phase index. */
  index: number;
  /** Human-readable title (after the colon). */
  title: string;
  /** Pre-task phase body (description, execution order, etc). */
  body: string;
  /** Tasks nested under this phase. */
  tasks: ParsedTask[];
}

export interface ParsedMasterPlan {
  phases: ParsedPhase[];
  /** Original frontmatter, if any. */
  frontmatter: Record<string, unknown>;
  /** Everything in the body above the first phase heading (e.g. the Intro). */
  preamble: string;
}

export class ParseError extends Error {
  readonly line: number;
  readonly expected: string;
  readonly found: string;
  constructor(detail: { line: number; expected: string; found: string; message: string }) {
    super(detail.message);
    this.name = 'ParseError';
    this.line = detail.line;
    this.expected = detail.expected;
    this.found = detail.found;
  }
  toDetail(): { line: number; expected: string; found: string; message: string } {
    return {
      line: this.line,
      expected: this.expected,
      found: this.found,
      message: this.message,
    };
  }
}

export interface ExplodeResult {
  emittedPhaseFiles: string[];
  emittedTaskFiles: string[];
  /** Timestamped backup dir path, or null if no pre-existing phases/ or tasks/ contents were moved. */
  backupDir: string | null;
}

// ── Regexes (line-anchored; the parser iterates lines, not the whole text) ────

const PHASE_HEADING_RE = /^##\s+P(\d{2}):\s*(.+?)\s*$/;
const TASK_HEADING_RE = /^###\s+P(\d{2})-T(\d{2}):\s*(.+?)\s*$/;
// Used to distinguish "looks like a phase/task heading with a bad id" from
// genuinely unrelated headings. Only flag when the shape is clearly intended
// to be a phase/task heading: `## P` or `## Phase` / `### P`.
// Generic `## Introduction` or `## Execution Order` must NOT trip this.
const LOOKS_LIKE_PHASE_RE = /^##\s+(P\d|Phase\b)/i;
const LOOKS_LIKE_TASK_RE = /^###\s+P\d/;

/**
 * Split a master plan text into frontmatter + preamble (= body before first phase) + parsed phases/tasks.
 *
 * Parse-only, no filesystem side effects. Throws ParseError on malformed input.
 */
export function parseMasterPlan(masterPlanPath: string): ParsedMasterPlan {
  const doc = readDocument(masterPlanPath);
  if (doc === null) {
    throw new ParseError({
      line: 0,
      expected: 'Master Plan file at ' + masterPlanPath,
      found: 'missing file',
      message: `Master Plan file not found at ${masterPlanPath}`,
    });
  }

  const frontmatter = doc.frontmatter;
  const body = doc.content;
  // We track 1-based line numbers in error messages relative to the body (not the frontmatter).
  const lines = body.split(/\r?\n/);

  const phases: ParsedPhase[] = [];
  let preambleLines: string[] = [];
  let currentPhase: ParsedPhase | null = null;
  let currentTask: ParsedTask | null = null;
  let currentBodyLines: string[] = [];

  const flushTask = () => {
    if (currentTask !== null) {
      currentTask.body = currentBodyLines.join('\n').trimEnd();
      currentTask.requirementTags = extractRequirementTags(currentTask.body);
      currentPhase!.tasks.push(currentTask);
      currentTask = null;
      currentBodyLines = [];
    }
  };

  const flushPhase = () => {
    flushTask();
    if (currentPhase !== null) {
      if (currentPhase.tasks.length === 0) {
        // currentBodyLines still hold the phase body up to end of phase.
        currentPhase.body = currentBodyLines.join('\n').trimEnd();
      }
      phases.push(currentPhase);
      currentPhase = null;
      currentBodyLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1;

    const phaseMatch = line.match(PHASE_HEADING_RE);
    if (phaseMatch) {
      const [, numStr, title] = phaseMatch;
      const phaseIndex = Number.parseInt(numStr!, 10);
      if (Number.isNaN(phaseIndex) || phaseIndex < 1) {
        throw new ParseError({
          line: lineNumber,
          expected: 'a two-digit positive phase number (e.g. "P01")',
          found: `P${numStr}`,
          message: `Invalid phase number at line ${lineNumber}: "${line}"`,
        });
      }
      if (currentPhase !== null) {
        // Close the current phase. flushPhase() is the single owner of body
        // capture — it handles both task-bearing and task-less phases correctly
        // using the still-populated currentBodyLines.
        flushPhase();
      } else {
        // First phase — the lines accumulated so far are the preamble.
        preambleLines = currentBodyLines;
        currentBodyLines = [];
      }
      currentPhase = {
        id: `P${numStr}`,
        index: phaseIndex,
        title: (title ?? '').trim(),
        body: '',
        tasks: [],
      };
      continue;
    }

    // Check for a "looks like a phase heading but invalid id" — e.g. `## Some Phase Without ID`
    if (LOOKS_LIKE_PHASE_RE.test(line) && !line.match(PHASE_HEADING_RE)) {
      throw new ParseError({
        line: lineNumber,
        expected: '"## P{NN}: {Title}" phase heading',
        found: line,
        message: `Malformed phase heading at line ${lineNumber}: expected "## P{NN}: {Title}", found "${line}"`,
      });
    }

    const taskMatch = line.match(TASK_HEADING_RE);
    if (taskMatch) {
      const [, phaseNumStr, taskNumStr, title] = taskMatch;
      const phaseIndex = Number.parseInt(phaseNumStr!, 10);
      const taskIndex = Number.parseInt(taskNumStr!, 10);

      if (currentPhase === null) {
        throw new ParseError({
          line: lineNumber,
          expected: 'a "## P{NN}:" phase heading before any "### P{NN}-T{MM}:" task heading',
          found: line,
          message: `Task heading at line ${lineNumber} appears before any phase heading: "${line}"`,
        });
      }
      if (phaseIndex !== currentPhase.index) {
        throw new ParseError({
          line: lineNumber,
          expected: `task under current phase P${String(currentPhase.index).padStart(2, '0')}`,
          found: `P${phaseNumStr}`,
          message: `Task phase id mismatch at line ${lineNumber}: task claims phase P${phaseNumStr} but the enclosing phase is ${currentPhase.id}`,
        });
      }

      // Flush any prior task and capture phase body if this is the first task.
      if (currentTask === null && currentPhase.tasks.length === 0) {
        currentPhase.body = currentBodyLines.join('\n').trimEnd();
        currentBodyLines = [];
      }
      flushTask();

      currentTask = {
        id: `P${phaseNumStr}-T${taskNumStr}`,
        phaseIndex,
        taskIndex,
        title: (title ?? '').trim(),
        requirementTags: [],
        body: '',
      };
      continue;
    }

    // Task-heading-shaped line that failed the strict regex — e.g. `### P01-TX: Bad ID`
    if (LOOKS_LIKE_TASK_RE.test(line) && !line.match(TASK_HEADING_RE)) {
      throw new ParseError({
        line: lineNumber,
        expected: '"### P{NN}-T{MM}: {Title}" task heading',
        found: line,
        message: `Malformed task heading at line ${lineNumber}: expected "### P{NN}-T{MM}: {Title}", found "${line}"`,
      });
    }

    // Accumulate body line.
    currentBodyLines.push(line);
  }

  // End of file — flush whatever is open.
  flushPhase();

  if (phases.length === 0) {
    throw new ParseError({
      line: 1,
      expected: 'at least one "## P{NN}:" phase heading',
      found: 'no phase headings',
      message: 'Master Plan contains no parseable phase headings',
    });
  }

  return {
    phases,
    frontmatter,
    preamble: preambleLines.join('\n').trimEnd(),
  };
}

function extractRequirementTags(body: string): string[] {
  const tags = new Set<string>();
  const tagLineMatch = body.match(/\*\*Requirements:\*\*\s*([^\n]+)/);
  if (tagLineMatch) {
    const items = (tagLineMatch[1] ?? '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    for (const item of items) tags.add(item);
  }
  return [...tags];
}

// ── Filename helpers ──────────────────────────────────────────────────────────

/**
 * Slugify a phase/task title into the filename suffix. Mirrors the existing
 * hand-authored convention (SCREAMING-KEBAB-CASE).
 */
export function titleToFilenameSlug(title: string): string {
  const cleaned = title
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'UNTITLED';
}

export function phaseFilename(projectName: string, phase: ParsedPhase): string {
  const idx = String(phase.index).padStart(2, '0');
  return `${projectName}-PHASE-${idx}-${titleToFilenameSlug(phase.title)}.md`;
}

export function taskFilename(projectName: string, task: ParsedTask): string {
  const pidx = String(task.phaseIndex).padStart(2, '0');
  const tidx = String(task.taskIndex).padStart(2, '0');
  return `${projectName}-TASK-P${pidx}-T${tidx}-${titleToFilenameSlug(task.title)}.md`;
}

// ── Emission ──────────────────────────────────────────────────────────────────

function buildPhaseFrontmatter(opts: {
  projectName: string;
  phase: ParsedPhase;
  createdIso: string;
}): Record<string, unknown> {
  return {
    project: opts.projectName,
    phase: opts.phase.index,
    title: opts.phase.title,
    status: 'active',
    tasks: opts.phase.tasks.map(t => ({ id: `T${String(t.taskIndex).padStart(2, '0')}`, title: t.title })),
    author: 'explosion-script',
    created: opts.createdIso,
    type: 'phase_plan',
  };
}

function buildTaskFrontmatter(opts: {
  projectName: string;
  task: ParsedTask;
  createdIso: string;
}): Record<string, unknown> {
  return {
    project: opts.projectName,
    phase: opts.task.phaseIndex,
    task: opts.task.taskIndex,
    title: opts.task.title,
    status: 'pending',
    requirement_tags: opts.task.requirementTags,
    author: 'explosion-script',
    created: opts.createdIso,
    type: 'task_handoff',
  };
}

function renderDoc(frontmatter: Record<string, unknown>, body: string): string {
  const frontmatterYaml = yaml.dump(frontmatter, { lineWidth: 120, noRefs: true }).trimEnd();
  return `---\n${frontmatterYaml}\n---\n\n${body.trimEnd()}\n`;
}

function renderPhaseBody(phase: ParsedPhase): string {
  const header = `# Phase ${phase.index}: ${phase.title}`;
  const sections: string[] = [header, ''];
  if (phase.body.trim().length > 0) {
    sections.push(phase.body.trim(), '');
  }
  sections.push('## Tasks', '');
  if (phase.tasks.length === 0) {
    sections.push('_(no tasks emitted by explosion script — phase has no task headings in the Master Plan)_');
  } else {
    for (const t of phase.tasks) {
      const tidx = String(t.taskIndex).padStart(2, '0');
      sections.push(`- **T${tidx}**: ${t.title}`);
    }
  }
  return sections.join('\n');
}

function renderTaskBody(task: ParsedTask): string {
  const pidx = String(task.phaseIndex).padStart(2, '0');
  const tidx = String(task.taskIndex).padStart(2, '0');
  const header = `# P${pidx}-T${tidx}: ${task.title}`;
  const sections: string[] = [header, ''];
  if (task.body.trim().length > 0) {
    sections.push(task.body.trim());
  } else {
    sections.push('_(empty body in Master Plan)_');
  }
  return sections.join('\n');
}

// ── Backup-on-rerun helper ────────────────────────────────────────────────────

function hasContents(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir);
    return entries.length > 0;
  } catch (err) {
    return false;
  }
}

function moveContentsTo(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const destPath = path.join(destDir, entry);
    // Try rename (atomic on same filesystem); fall back to cpSync + rmSync on cross-device errors.
    try {
      fs.renameSync(srcPath, destPath);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'EXDEV' || code === 'EPERM' || code === 'ENOTEMPTY') {
        fs.cpSync(srcPath, destPath, { recursive: true });
        fs.rmSync(srcPath, { recursive: true, force: true });
      } else {
        throw err;
      }
    }
  }
}

export function makeBackupDir(projectDir: string, nowIso?: string): string {
  const iso = nowIso ?? new Date().toISOString();
  const stamp = iso.replace(/[:.]/g, '-');
  return path.join(projectDir, 'backups', stamp);
}

// ── Public API: explodeMasterPlan ─────────────────────────────────────────────

export interface ExplodeOptions {
  projectDir: string;
  masterPlanPath: string;
  projectName: string;
  /** Override for deterministic tests; defaults to `new Date().toISOString()`. */
  nowIso?: string;
}

export function explodeMasterPlan(opts: ExplodeOptions): ExplodeResult {
  const { projectDir, masterPlanPath, projectName } = opts;
  const nowIso = opts.nowIso ?? new Date().toISOString();

  // 1. Parse first — NO filesystem side effects yet. Propagate ParseError up.
  const parsed = parseMasterPlan(masterPlanPath);

  const phasesDir = path.join(projectDir, 'phases');
  const tasksDir = path.join(projectDir, 'tasks');

  // 2. Backup-on-rerun.
  let backupDir: string | null = null;
  const phasesHas = hasContents(phasesDir);
  const tasksHas = hasContents(tasksDir);
  if (phasesHas || tasksHas) {
    backupDir = makeBackupDir(projectDir, nowIso);
    if (phasesHas) moveContentsTo(phasesDir, path.join(backupDir, 'phases'));
    if (tasksHas) moveContentsTo(tasksDir, path.join(backupDir, 'tasks'));
  }

  // 3. Ensure target dirs exist (they may have been removed by the move).
  fs.mkdirSync(phasesDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });

  // 4. Emit fresh files.
  const emittedPhaseFiles: string[] = [];
  const emittedTaskFiles: string[] = [];

  for (const phase of parsed.phases) {
    const fname = phaseFilename(projectName, phase);
    const fpath = path.join(phasesDir, fname);
    const frontmatter = buildPhaseFrontmatter({ projectName, phase, createdIso: nowIso });

    // 5a. Validate the emitted frontmatter — script-produced docs go through the same validator.
    // `phase_plan_created` rule exists (validates tasks non-empty array). For phases with zero tasks
    // we skip validation since the rule would reject empty-tasks-arrays (legit shape here), BUT
    // phases with tasks must pass.
    if (phase.tasks.length > 0) {
      const err = validateFrontmatter('phase_plan_created', frontmatter, fpath);
      if (err !== null) {
        throw new Error(
          `Explosion emitter produced invalid phase frontmatter for ${fname}: ${err.error} (field: ${err.field})`,
        );
      }
    }

    fs.writeFileSync(fpath, renderDoc(frontmatter, renderPhaseBody(phase)), 'utf-8');
    emittedPhaseFiles.push(fpath);

    for (const task of phase.tasks) {
      const tname = taskFilename(projectName, task);
      const tpath = path.join(tasksDir, tname);
      const tfront = buildTaskFrontmatter({ projectName, task, createdIso: nowIso });
      // task_handoff_created has no rule today; validator returns null → pass.
      const terr = validateFrontmatter('task_handoff_created', tfront, tpath);
      if (terr !== null) {
        throw new Error(
          `Explosion emitter produced invalid task frontmatter for ${tname}: ${terr.error} (field: ${terr.field})`,
        );
      }
      fs.writeFileSync(tpath, renderDoc(tfront, renderTaskBody(task)), 'utf-8');
      emittedTaskFiles.push(tpath);
    }
  }

  // 6. Seed state.json iterations if a state.json exists for the project.
  const state = readState(projectDir);
  if (state !== null) {
    seedIterations(state, parsed, projectName, emittedPhaseFiles, emittedTaskFiles, projectDir);
    writeState(projectDir, state);
  }

  return {
    emittedPhaseFiles,
    emittedTaskFiles,
    backupDir,
  };
}

function toRelativeDocPath(absPath: string, projectDir: string): string {
  const rel = path.relative(projectDir, absPath);
  // Normalize to forward slashes — matches the legacy state.json convention
  // (phases/NAME-PHASE-NN-TITLE.md, tasks/NAME-TASK-PNN-TMM-TITLE.md) and
  // keeps state.json portable across platforms + check-in/check-out.
  return rel.split(path.sep).join('/');
}

function seedIterations(
  state: PipelineState,
  parsed: ParsedMasterPlan,
  _projectName: string,
  emittedPhaseFiles: string[],
  emittedTaskFiles: string[],
  projectDir: string,
): void {
  // Locate phase_loop; if absent (partial template such as default.yml), create a minimal one.
  let phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
  if (phaseLoop === undefined) {
    phaseLoop = {
      kind: 'for_each_phase',
      status: 'not_started',
      iterations: [],
    };
    state.graph.nodes['phase_loop'] = phaseLoop;
  } else if (phaseLoop.kind !== 'for_each_phase') {
    throw new Error(
      `explosion script: expected state.graph.nodes.phase_loop to be 'for_each_phase', got '${phaseLoop.kind}'`,
    );
  }

  // Wipe and re-seed.
  phaseLoop.iterations = [];
  let taskFilePointer = 0;
  for (let i = 0; i < parsed.phases.length; i++) {
    const phase = parsed.phases[i]!;
    const phaseFileAbs = emittedPhaseFiles[i] ?? null;
    const phaseFile = phaseFileAbs !== null ? toRelativeDocPath(phaseFileAbs, projectDir) : null;

    const taskLoopIterations: IterationEntry[] = [];
    for (let j = 0; j < phase.tasks.length; j++) {
      const taskFileAbs = emittedTaskFiles[taskFilePointer++] ?? null;
      const taskFile = taskFileAbs !== null ? toRelativeDocPath(taskFileAbs, projectDir) : null;
      const taskHandoffNode: StepNodeState = {
        kind: 'step',
        status: 'completed',
        doc_path: taskFile,
        retries: 0,
      };
      taskLoopIterations.push({
        index: j,
        status: 'not_started',
        nodes: { task_handoff: taskHandoffNode },
        corrective_tasks: [],
        commit_hash: null,
      });
    }
    const taskLoop: ForEachTaskNodeState = {
      kind: 'for_each_task',
      status: 'not_started',
      iterations: taskLoopIterations,
    };

    const phasePlanningNode: StepNodeState = {
      kind: 'step',
      status: 'completed',
      doc_path: phaseFile,
      retries: 0,
    };

    const phaseEntry: IterationEntry = {
      index: i,
      status: 'not_started',
      nodes: { phase_planning: phasePlanningNode, task_loop: taskLoop },
      corrective_tasks: [],
      commit_hash: null,
    };
    phaseLoop.iterations.push(phaseEntry);
  }
}

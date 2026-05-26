import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadTemplate } from './template-loader.js';
import { resolveTemplateName, snapshotTemplate } from './template-resolver.js';
import { preRead } from './pre-reads.js';
import { getMutation } from './mutations.js';
import { walkDAG, resolveNodeStatePath } from './dag-walker.js';
import { enrichActionContext } from './context-enrichment.js';
import { OUT_OF_BAND_EVENTS } from './constants.js';
import { composeActionPrompt } from './composer.js';
import { parseActionEventFile } from './action-event-loader.js';
import { userDataPaths } from '../paths.js';
import type {
  PipelineState,
  PipelineResult,
  PipelineTemplate,
  OrchestrationConfig,
  EventContext,
  IOAdapter,
  NodeDef,
  NodeState,
  PathContext,
  StepNodeDef,
} from './types.js';
import { scaffoldNodeState } from './scaffold.js';
import { validateState } from './validator.js';

// Canonical user-data projects directory. Mirrors cli/src/lib/upgrade/user-data-paths.ts
// (userDataPaths().projects); inlined here because the pipeline runtime in
// skills/rad-orchestration/scripts/ has no shared TS surface with cli/.
const PROJECTS_BASE_PATH = path.join(os.homedir(), '.radorc', 'projects');

// ── Catalog-root test override (FR-4, AD-6) ──────────────────────────────────
// Production reads the action/event catalog root from `userDataPaths().actionEvents`.
// Tests inject a temp catalog via `__setActionEventsRootForTests(dir)` so the
// engine composer reads from a synthetic catalog without touching the user's
// real ~/.radorc/action-events/ tree. Passing `null` resets to the production
// path. This is a deliberate test seam; no production code path uses it.
let __actionEventsRootOverride: string | null = null;
export function __setActionEventsRootForTests(root: string | null): void {
  __actionEventsRootOverride = root;
}
function resolveActionEventsRoot(): string {
  return __actionEventsRootOverride ?? userDataPaths().actionEvents;
}

/**
 * Cold-read the catalog action file's frontmatter (AD-6) and return its
 * `completion_event` field. Returns `null` if the action's completion event
 * is explicitly null in the catalog. Returns `undefined` if the catalog file
 * does not exist on disk — callers treat this as "skip prompt attachment"
 * (the catalog will be populated incrementally; missing files must not break
 * success envelope routing). All other parse errors propagate.
 */
function resolveCompletionEvent(
  actionName: string,
  _template: PipelineTemplate,
): string | null | undefined {
  const root = resolveActionEventsRoot();
  const filename = `action.${actionName}.md`;
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) return undefined;
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseActionEventFile(text, filename);
  if (parsed.kind !== 'action') {
    throw new Error(`Catalog file '${filePath}' parsed kind '${parsed.kind}' but action expected.`);
  }
  const fm = parsed.frontmatter as { kind: 'action'; completion_event: string | null };
  return fm.completion_event;
}

/**
 * Attach `prompt` (composed catalog text) and `completion_event` (resolved
 * event name) to the engine's success envelope context. Failure envelopes
 * never reach this helper — they construct their context inline with the
 * `error: { ... }` field (FR-7).
 *
 * Skips attachment entirely when the action's catalog file does not exist
 * on disk; the envelope still surfaces `action` and the enriched context so
 * downstream consumers that do not depend on the composed prompt continue
 * to operate (catalog population proceeds independently of pipeline routing).
 */
function attachPromptIfActionResolved(
  next: { action: string; context: Record<string, unknown> } | null,
  template: PipelineTemplate,
): { action: string | null; context: Record<string, unknown> } {
  if (!next) return { action: null, context: {} };
  const completion_event = resolveCompletionEvent(next.action, template);
  if (completion_event === undefined) {
    // No catalog file → skip composer; preserve existing envelope shape.
    return { action: next.action, context: next.context };
  }
  const prompt = composeActionPrompt({
    actionName: next.action,
    completionEvent: completion_event,
    catalogRoot: resolveActionEventsRoot(),
  });
  return { action: next.action, context: { ...next.context, prompt, completion_event } };
}

// ── optimisticallyMarkStepInProgress ─────────────────────────────────────────
//
// Marks a top-level step node in_progress on the same writeState as the action
// return so the UI sees the transition immediately (FR-10). Container-node
// transitions remain walker-driven (AD-2). The nodePath must be a key in
// state.graph.nodes; nested iteration nodes (phase_loop[0].task_loop[1].foo)
// are intentionally skipped via the `if (!node) return` guard. No new fields
// are introduced — only the existing `status` field is updated (FR-12).

function optimisticallyMarkStepInProgress(state: PipelineState, nodePath: string | null): void {
  if (!nodePath) return;
  const node = state.graph.nodes[nodePath];
  if (!node) return;
  if (node.kind && node.kind !== 'step') return; // containers stay walker-driven (AD-2).
  if (node.status === 'not_started') {
    node.status = 'in_progress';
  }
}

// ── scaffoldState ─────────────────────────────────────────────────────────────

function scaffoldState(
  template: PipelineTemplate,
  projectName: string,
  config: OrchestrationConfig,
): PipelineState {
  const now = new Date().toISOString();
  const nodes: Record<string, NodeState> = {};

  for (const node of template.nodes) {
    nodes[node.id] = scaffoldNodeState(node);
  }

  return {
    $schema: 'orchestration-state-v5',
    project: {
      name: projectName,
      created: now,
      updated: now,
    },
    config: {
      gate_mode: config.human_gates.execution_mode,
      limits: {
        max_phases: config.limits.max_phases,
        max_tasks_per_phase: config.limits.max_tasks_per_phase,
        max_retries_per_task: config.limits.max_retries_per_task,
        max_consecutive_review_rejections: config.limits.max_consecutive_review_rejections,
      },
      source_control: {
        auto_commit: config.source_control.auto_commit,
        auto_pr: config.source_control.auto_pr,
      },
    },
    pipeline: {
      gate_mode: null,
      source_control: null,
      current_tier: 'planning',
      halt_reason: null,
    },
    graph: {
      template_id: template.template.id,
      status: 'in_progress',
      current_node_path: null,
      nodes,
    },
  };
}

// ── normalizeDocPath ────────────────────────────────────────────────────────────

export function normalizeDocPath(docPath: string, basePath: string, projectName: string): string {
  if (!docPath) return docPath;
  const normalized = docPath.replace(/\\/g, '/');
  const normalizedBase = basePath.replace(/\\/g, '/');
  const prefix = normalizedBase + '/' + projectName + '/';
  if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) return normalized.slice(prefix.length);
  return normalized;
}

// ── resolveGateApproved ───────────────────────────────────────────────────────

function resolveGateApproved(context: Partial<EventContext>): string {
  const gateType = (context as Record<string, unknown>).gate_type;
  if (gateType === 'task') return 'task_gate_approved';
  if (gateType === 'phase') return 'phase_gate_approved';
  throw new Error(gateType
    ? `Unknown gate type '${gateType}': expected task or phase`
    : 'gate_approved requires --gate-type task|phase');
}

// ── processEvent (main engine entry point) ────────────────────────────────────

export function processEvent(
  event: string,
  projectDir: string,
  context: Partial<EventContext>,
  io: IOAdapter,
  pathContext: PathContext,
  configPath?: string,
): PipelineResult {
  const { templatesDir } = pathContext;

  try {
    const config = io.readConfig(configPath);

    const state = io.readState(projectDir);

    const resolution = resolveTemplateName(state, context.template, config, projectDir, templatesDir);
    // For new-project creation (state === null) always load from the global templates directory.
    // This avoids reading a project-local snapshot that may be mid-write in concurrent scenarios
    // or stale from a prior failed run. The snapshot step below overwrites any stale file.
    const effectiveLoadPath = state !== null
      ? resolution.templatePath
      : path.join(templatesDir, resolution.templateName + '.yml');
    const loadedTemplate = loadTemplate(effectiveLoadPath);
    const { template, eventIndex } = loadedTemplate;

    const wrappedReadDocument = (docPath: string) => {
      if (path.isAbsolute(docPath)) {
        return io.readDocument(docPath);
      }

      const resolvedProjectDir = path.resolve(projectDir);
      const resolved = path.resolve(resolvedProjectDir, docPath);
      const relativeToProject = path.relative(resolvedProjectDir, resolved);

      if (relativeToProject === '..' || relativeToProject.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToProject)) {
        throw new Error(`Document path escapes project directory: ${docPath}`);
      }

      return io.readDocument(resolved);
    };

    // ── Start event (pre-index routing) ────────────────────────────────
    if (event === 'start') {
      if (state === null) {
        const projectName = path.basename(projectDir);
        io.ensureDirectories(projectDir);
        // Always snapshot the global template for new projects. This also handles
        // the stale re-start case where a prior failed run left template.yml but
        // no state.json — the stale file is overwritten with the correct global template.
        try {
          snapshotTemplate(
            path.join(templatesDir, resolution.templateName + '.yml'),
            projectDir,
          );
        } catch (err) {
          console.error('[engine] snapshotTemplate failed; project will use global template on future events:', err);
        }
        const scaffolded = scaffoldState(template, projectName, config);
        scaffolded.project.updated = new Date().toISOString();

        const nextAction = walkDAG(scaffolded, template, config, wrappedReadDocument);

        const postWalkErrors = validateState(null, scaffolded, config, template);
        if (postWalkErrors.length > 0) {
          return {
            action: null,
            context: { error: postWalkErrors[0] },
            error: {
              message: postWalkErrors[0],
              event,
            },
          };
        }

        optimisticallyMarkStepInProgress(scaffolded, nextAction?.action ?? null);
        io.writeState(projectDir, scaffolded);

        const enrichedContext = nextAction
          ? enrichActionContext({
              action: nextAction.action,
              walkerContext: nextAction.context,
              state: scaffolded,
              config,
              cliContext: context,
            })
          : {};

        return attachPromptIfActionResolved(
          nextAction ? { action: nextAction.action, context: enrichedContext } : null,
          template,
        );
      } else {
        const walkerResult = walkDAG(state, template, config, wrappedReadDocument);

        state.project.updated = new Date().toISOString();

        const validationErrors = validateState(null, state, config, template);
        if (validationErrors.length > 0) {
          return {
            action: null,
            context: { error: validationErrors[0] },
            error: { message: validationErrors[0], event },
          };
        }

        optimisticallyMarkStepInProgress(state, walkerResult?.action ?? null);
        io.writeState(projectDir, state);

        const enrichedContext = walkerResult
          ? enrichActionContext({
              action: walkerResult.action,
              walkerContext: walkerResult.context,
              state,
              config,
              cliContext: context,
            })
          : {};
        return attachPromptIfActionResolved(
          walkerResult ? { action: walkerResult.action, context: enrichedContext } : null,
          template,
        );
      }
    }

    // ── Null-state guard (non-start events) ────────────────────────────
    if (state === null) {
      return {
        action: null,
        context: { error: 'No state.json found; use --event start' },
        error: {
          message: 'No state.json found; use --event start',
          event,
        },
      };
    }
    // ── Out-of-band event routing (pre-index) ──────────────────────────
    if (OUT_OF_BAND_EVENTS.has(event)) {
      const mutation = getMutation(event);
      // Defensive guard: all 6 OUT_OF_BAND_EVENTS are unconditionally registered in mutations.ts,
      // so this branch is currently unreachable. Retained as a safety net against future deregistration.
      if (!mutation) {
        return {
          action: null,
          context: { error: `No mutation registered for event: ${event}` },
          error: { message: `No mutation registered for event: ${event}`, event },
        };
      }

      const normalizedContext = { ...context };
      if (normalizedContext.doc_path) {
        normalizedContext.doc_path = normalizeDocPath(
          normalizedContext.doc_path,
          PROJECTS_BASE_PATH,
          path.basename(projectDir),
        );
      }
      const mutationResult = mutation(state, normalizedContext, config, template);
      const mutatedState = mutationResult.state;

      const validationErrors = validateState(state, mutatedState, config, template);
      if (validationErrors.length > 0) {
        return {
          action: null,
          context: { error: validationErrors[0] },
          error: { message: validationErrors[0], event },
        };
      }

      mutatedState.project.updated = new Date().toISOString();

      const walkerResult = walkDAG(mutatedState, template, config, wrappedReadDocument);

      const postWalkErrors = validateState(state, mutatedState, config, template);
      if (postWalkErrors.length > 0) {
        return {
          action: null,
          context: { error: postWalkErrors[0] },
          error: { message: postWalkErrors[0], event },
        };
      }

      optimisticallyMarkStepInProgress(mutatedState, mutatedState.graph.current_node_path);
      io.writeState(projectDir, mutatedState);

      const enrichedContext = walkerResult
        ? enrichActionContext({
            action: walkerResult.action,
            walkerContext: walkerResult.context,
            state: mutatedState,
            config,
            cliContext: context,
          })
        : {};

      return attachPromptIfActionResolved(
        walkerResult ? { action: walkerResult.action, context: enrichedContext } : null,
        template,
      );
    }

    // ── gate_approved alias resolution ──────────────────────────────────
    if (event === 'gate_approved') {
      try {
        event = resolveGateApproved(context);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          action: null,
          context: { error: message },
          error: {
            message,
            event,
          },
        };
      }
    }
    // ── Standard route (state exists) ───────────────────────────────────
    const entry = eventIndex.get(event);
    if (!entry) {
      return {
        action: null,
        context: { error: `Unknown event: ${event}` },
        error: {
          message: `Unknown event: ${event}`,
          event,
        },
      };
    }
    const preReadResult = preRead(event, context, io.readDocument, projectDir, state, entry);
    if (preReadResult.error) {
      return {
        action: null,
        context: { error: preReadResult.error.message },
        error: preReadResult.error,
      };
    }

    const mutation = getMutation(event);
    if (!mutation) {
      return {
        action: null,
        context: { error: `No mutation registered for event: ${event}` },
        error: {
          message: `No mutation registered for event: ${event}`,
          event,
        },
      };
    }

    const normalizedContext = { ...preReadResult.context };
    if (normalizedContext.doc_path) {
      normalizedContext.doc_path = normalizeDocPath(
        normalizedContext.doc_path,
        PROJECTS_BASE_PATH,
        path.basename(projectDir),
      );
    }
    const mutationResult = mutation(state, normalizedContext, config, template);
    const mutatedState = mutationResult.state;

    const validationErrors = validateState(state, mutatedState, config, template);
    if (validationErrors.length > 0) {
      return {
        action: null,
        context: { error: validationErrors[0] },
        error: {
          message: validationErrors[0],
          event,
        },
      };
    }

    mutatedState.project.updated = new Date().toISOString();
    mutatedState.graph.current_node_path = resolveNodeStatePath(entry.templatePath, context);

    let nextAction;
    if (entry.eventPhase === 'started') {
      const stepNode = entry.nodeDef as StepNodeDef;
      const rawContext = stepNode.context ?? {};
      const enrichedCtx = enrichActionContext({
        action: stepNode.action,
        walkerContext: rawContext,
        state: mutatedState,
        config,
        cliContext: context,
      });
      nextAction = { action: stepNode.action, context: enrichedCtx };
      optimisticallyMarkStepInProgress(mutatedState, mutatedState.graph.current_node_path);
      io.writeState(projectDir, mutatedState);
    } else {
      const walkerResult = walkDAG(mutatedState, template, config, wrappedReadDocument);

      const postWalkErrors = validateState(state, mutatedState, config, template);
      if (postWalkErrors.length > 0) {
        return {
          action: null,
          context: { error: postWalkErrors[0] },
          error: {
            message: postWalkErrors[0],
            event,
          },
        };
      }

      optimisticallyMarkStepInProgress(mutatedState, mutatedState.graph.current_node_path);
      io.writeState(projectDir, mutatedState);

      if (walkerResult) {
        nextAction = {
          action: walkerResult.action,
          context: enrichActionContext({
            action: walkerResult.action,
            walkerContext: walkerResult.context,
            state: mutatedState,
            config,
            cliContext: context,
          }),
        };
      } else {
        nextAction = walkerResult;
      }
    }

    return attachPromptIfActionResolved(nextAction ?? null, template);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      action: null,
      context: { error: message },
      error: {
        message,
        event,
      },
    };
  }
}

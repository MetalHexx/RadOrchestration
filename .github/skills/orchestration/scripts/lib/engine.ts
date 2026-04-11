import * as path from 'node:path';
import { loadTemplate } from './template-loader.js';
import { resolveTemplateName, snapshotTemplate } from './template-resolver.js';
import { preRead } from './pre-reads.js';
import { getMutation } from './mutations.js';
import { walkDAG, resolveNodeStatePath } from './dag-walker.js';
import { enrichActionContext } from './context-enrichment.js';
import { OUT_OF_BAND_EVENTS } from './constants.js';
import type {
  PipelineState,
  PipelineResult,
  PipelineTemplate,
  OrchestrationConfig,
  EventContext,
  IOAdapter,
  NodeDef,
  NodeState,
  StepNodeDef,
} from './types.js';
import { scaffoldNodeState } from './scaffold.js';
import { validateState } from './validator.js';

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
  configPath?: string,
): PipelineResult {
  let orchRoot = '.github';

  try {
    const config = io.readConfig(configPath);
    orchRoot = config.system.orch_root;

    const state = io.readState(projectDir);

    const templatesDir = path.join(orchRoot, 'skills/orchestration/templates');
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
      const resolved = path.isAbsolute(docPath) ? docPath : path.join(projectDir, docPath);
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
            success: false,
            action: null,
            context: { error: postWalkErrors[0] },
            mutations_applied: [],
            orchRoot,
            error: {
              message: postWalkErrors[0],
              event,
            },
          };
        }

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

        return {
          success: true,
          action: nextAction?.action ?? null,
          context: enrichedContext,
          mutations_applied: ['scaffold_initial_state'],
          orchRoot,
        };
      } else {
        const walkerResult = walkDAG(state, template, config, wrappedReadDocument);

        state.project.updated = new Date().toISOString();

        const validationErrors = validateState(null, state, config, template);
        if (validationErrors.length > 0) {
          return {
            success: false,
            action: null,
            context: { error: validationErrors[0] },
            mutations_applied: [],
            orchRoot,
            error: { message: validationErrors[0], event },
          };
        }

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
        return {
          success: true,
          action: walkerResult?.action ?? null,
          context: enrichedContext,
          mutations_applied: [],
          orchRoot,
        };
      }
    }

    // ── Null-state guard (non-start events) ────────────────────────────
    if (state === null) {
      return {
        success: false,
        action: null,
        context: { error: 'No state.json found; use --event start' },
        mutations_applied: [],
        orchRoot,
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
          success: false,
          action: null,
          context: { error: `No mutation registered for event: ${event}` },
          mutations_applied: [],
          orchRoot,
          error: { message: `No mutation registered for event: ${event}`, event },
        };
      }

      const normalizedContext = { ...context };
      if (normalizedContext.doc_path) {
        normalizedContext.doc_path = normalizeDocPath(
          normalizedContext.doc_path,
          config.projects.base_path,
          path.basename(projectDir),
        );
      }
      const mutationResult = mutation(state, normalizedContext, config, template);
      const mutatedState = mutationResult.state;

      const validationErrors = validateState(state, mutatedState, config, template);
      if (validationErrors.length > 0) {
        return {
          success: false,
          action: null,
          context: { error: validationErrors[0] },
          mutations_applied: [],
          orchRoot,
          error: { message: validationErrors[0], event },
        };
      }

      mutatedState.project.updated = new Date().toISOString();

      const walkerResult = walkDAG(mutatedState, template, config, wrappedReadDocument);

      const postWalkErrors = validateState(state, mutatedState, config, template);
      if (postWalkErrors.length > 0) {
        return {
          success: false,
          action: null,
          context: { error: postWalkErrors[0] },
          mutations_applied: [],
          orchRoot,
          error: { message: postWalkErrors[0], event },
        };
      }

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

      return {
        success: true,
        action: walkerResult?.action ?? null,
        context: enrichedContext,
        mutations_applied: mutationResult.mutations_applied,
        orchRoot,
      };
    }

    // ── gate_approved alias resolution ──────────────────────────────────
    if (event === 'gate_approved') {
      try {
        event = resolveGateApproved(context);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          action: null,
          context: { error: message },
          mutations_applied: [],
          orchRoot,
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
        success: false,
        action: null,
        context: { error: `Unknown event: ${event}` },
        mutations_applied: [],
        orchRoot,
        error: {
          message: `Unknown event: ${event}`,
          event,
        },
      };
    }
    const preReadResult = preRead(event, context, io.readDocument, projectDir, state, entry);
    if (preReadResult.error) {
      return {
        success: false,
        action: null,
        context: { error: preReadResult.error.message },
        mutations_applied: [],
        orchRoot,
        error: preReadResult.error,
      };
    }

    const mutation = getMutation(event);
    if (!mutation) {
      return {
        success: false,
        action: null,
        context: { error: `No mutation registered for event: ${event}` },
        mutations_applied: [],
        orchRoot,
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
        config.projects.base_path,
        path.basename(projectDir),
      );
    }
    const mutationResult = mutation(state, normalizedContext, config, template);
    const mutatedState = mutationResult.state;

    const validationErrors = validateState(state, mutatedState, config, template);
    if (validationErrors.length > 0) {
      return {
        success: false,
        action: null,
        context: { error: validationErrors[0] },
        mutations_applied: [],
        orchRoot,
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
      io.writeState(projectDir, mutatedState);
    } else {
      const walkerResult = walkDAG(mutatedState, template, config, wrappedReadDocument);

      const postWalkErrors = validateState(state, mutatedState, config, template);
      if (postWalkErrors.length > 0) {
        return {
          success: false,
          action: null,
          context: { error: postWalkErrors[0] },
          mutations_applied: [],
          orchRoot,
          error: {
            message: postWalkErrors[0],
            event,
          },
        };
      }

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

    return {
      success: true,
      action: nextAction?.action ?? null,
      context: nextAction?.context ?? {},
      mutations_applied: mutationResult.mutations_applied,
      orchRoot,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      action: null,
      context: { error: message },
      mutations_applied: [],
      orchRoot,
      error: {
        message,
        event,
      },
    };
  }
}

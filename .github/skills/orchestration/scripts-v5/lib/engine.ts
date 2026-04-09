import * as path from 'node:path';
import { loadTemplate } from './template-loader.js';
import { preRead } from './pre-reads.js';
import { getMutation } from './mutations.js';
import { walkDAG, resolveNodeStatePath } from './dag-walker.js';
import { enrichActionContext } from './context-enrichment.js';
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
  if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
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

    const templatePath = path.join(orchRoot, 'skills/orchestration/scripts-v5/templates/full.yml');
    const loadedTemplate = loadTemplate(templatePath);
    const { template, eventIndex } = loadedTemplate;

    // ── Start event (pre-index routing) ────────────────────────────────
    if (event === 'start') {
      if (state === null) {
        const projectName = path.basename(projectDir);
        const scaffolded = scaffoldState(template, projectName, config);
        scaffolded.project.updated = new Date().toISOString();

        io.ensureDirectories(projectDir);
        const nextAction = walkDAG(scaffolded, template, config, io.readDocument);

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
        const walkerResult = walkDAG(state, template, config, io.readDocument);
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
    const preReadResult = preRead(event, context, io.readDocument, projectDir, entry);
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
      const walkerResult = walkDAG(mutatedState, template, config, io.readDocument);

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

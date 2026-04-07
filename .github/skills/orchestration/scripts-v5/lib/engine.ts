import * as path from 'node:path';
import { loadTemplate } from './template-loader.js';
import { preRead } from './pre-reads.js';
import { getMutation } from './mutations.js';
import { walkDAG, resolveNodeStatePath } from './dag-walker.js';
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
    graph: {
      template_id: template.template.id,
      status: 'not_started',
      current_node_path: null,
      nodes,
    },
  };
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

    const entry = eventIndex.get(event);
    if (!entry) {
      return {
        success: false,
        action: null,
        context: {},
        mutations_applied: [],
        orchRoot,
        error: {
          message: `Unknown event: ${event}`,
          event,
        },
      };
    }

    // ── Init route (state is null) ──────────────────────────────────────
    if (state === null) {
      const projectName = path.basename(projectDir);
      const scaffolded = scaffoldState(template, projectName, config);
      scaffolded.project.updated = new Date().toISOString();

      io.ensureDirectories(projectDir);
      const nextAction = walkDAG(scaffolded, template, config, io.readDocument);
      io.writeState(projectDir, scaffolded);

      return {
        success: true,
        action: nextAction?.action ?? null,
        context: nextAction?.context ?? {},
        mutations_applied: ['scaffold_initial_state'],
        orchRoot,
      };
    }

    // ── Standard route (state exists) ───────────────────────────────────
    const preReadResult = preRead(event, context, io.readDocument, projectDir, entry);
    if (preReadResult.error) {
      return {
        success: false,
        action: null,
        context: {},
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
        context: {},
        mutations_applied: [],
        orchRoot,
        error: {
          message: `No mutation registered for event: ${event}`,
          event,
        },
      };
    }

    const mutationResult = mutation(state, preReadResult.context, config, template);
    const mutatedState = mutationResult.state;

    const validationErrors = validateState(state, mutatedState, config, template);
    if (validationErrors.length > 0) {
      return {
        success: false,
        action: null,
        context: {},
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
      nextAction = { action: stepNode.action, context: stepNode.context ?? {} };
      io.writeState(projectDir, mutatedState);
    } else {
      const walkerResult = walkDAG(mutatedState, template, config, io.readDocument);
      io.writeState(projectDir, mutatedState);
      nextAction = walkerResult;
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
      context: {},
      mutations_applied: [],
      orchRoot,
      error: {
        message,
        event,
      },
    };
  }
}

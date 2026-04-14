// ui/types/template.ts
import type { CSSProperties } from 'react';

/** The five node kinds that appear in template YAML files. */
export type TemplateNodeKind = 'step' | 'gate' | 'conditional' | 'for_each_phase' | 'for_each_task';

/** Condition block for conditional nodes. */
export interface TemplateCondition {
  config_ref: string;
  operator: string;
  value: string;
}

/** A single node as it appears in template YAML (parsed from YAML object). */
export interface TemplateYamlNode {
  id: string;
  kind: TemplateNodeKind;
  label: string;
  depends_on: string[];
  // step-specific
  action?: string;
  events?: Record<string, string>;
  context?: Record<string, string>;
  doc_output_field?: string;
  retries_ref?: string;
  // gate-specific
  mode_ref?: string;
  action_if_needed?: string;
  approved_event?: string;
  auto_approve_modes?: string[];
  // conditional-specific
  condition?: TemplateCondition;
  branches?: {
    true: TemplateYamlNode[];
    false: TemplateYamlNode[];
  };
  // loop-specific
  source_doc_ref?: string;
  total_field?: string;
  tasks_field?: string;
  body?: TemplateYamlNode[];
}

/** Top-level template definition as parsed from YAML. */
export interface TemplateDefinition {
  template: {
    id: string;
    version: string;
    description: string;
  };
  nodes: TemplateYamlNode[];
}

/** Metadata for a template file in list responses. */
export interface TemplateSummary {
  id: string;
  description: string;
  version: string;
}

/** ReactFlow graph node data payload. */
export interface TemplateGraphNodeData {
  id: string;
  kind: TemplateNodeKind;
  label: string;
  meta: Record<string, string>;
  [key: string]: unknown;
}

/** The serializer's output: ReactFlow-compatible nodes and edges. */
export interface TemplateGraph {
  nodes: TemplateGraphNode[];
  edges: TemplateGraphEdge[];
}

/** A ReactFlow node with template-specific data and optional parent. */
export interface TemplateGraphNode {
  id: string;
  type: 'templateNode' | 'templateGroup';
  position: { x: number; y: number };
  data: TemplateGraphNodeData;
  parentId?: string;
  extent?: 'parent';
  style?: CSSProperties;
}

/** A ReactFlow edge representing a depends_on relationship. */
export interface TemplateGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'smoothstep';
  markerEnd: { type: 'arrowclosed' };
  label?: string;
  animated: false;
  hidden?: boolean;
}

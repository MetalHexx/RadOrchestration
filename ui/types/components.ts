import type { PipelineTier, PlanningStatus, ExecutionStatus } from './state';

/** Sidebar project entry */
export interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
  planningStatus?: PlanningStatus;
  executionStatus?: ExecutionStatus;
}

/** Gate history entry for the timeline */
export interface GateEntry {
  gate: string;           // e.g., "Post-Planning", "Phase 1", "Final Review"
  approved: boolean;
  timestamp?: string;     // ISO 8601 if available
}

/** Document frontmatter metadata */
export interface DocumentFrontmatter {
  [key: string]: unknown;
  project?: string;
  status?: string;
  author?: string;
  created?: string;
  verdict?: string;
  severity?: string;
  phase?: number;
  task?: number;
  title?: string;
}

/** API response for document content */
export interface DocumentResponse {
  frontmatter: DocumentFrontmatter;
  content: string;        // Markdown body (frontmatter stripped)
  filePath: string;       // Resolved absolute path (for display)
}

/** A document in the ordered navigation sequence */
export interface OrderedDoc {
  /** Relative path to the document (same format as state.json paths) */
  path: string;
  /** Display title for the navigation button label */
  title: string;
  /** Category for grouping: planning, phase, task, review, error-log, other */
  category: 'planning' | 'phase' | 'task' | 'review' | 'error-log' | 'other';
}

/** Response from GET /api/projects/[name]/files */
export interface FilesResponse {
  files: string[];
}

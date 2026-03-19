import type { ProjectState } from './state';

/** SSE event types sent from server to client */
export type SSEEventType = 'state_change' | 'project_added' | 'project_removed' | 'connected' | 'heartbeat';

export interface SSEEvent<T extends SSEEventType = SSEEventType> {
  type: T;
  timestamp: string;      // ISO 8601
  payload: SSEPayloadMap[T];
}

export interface SSEPayloadMap {
  state_change: {
    projectName: string;
    state: ProjectState;
  };
  project_added: {
    projectName: string;
  };
  project_removed: {
    projectName: string;
  };
  connected: {
    projects: string[];
  };
  heartbeat: Record<string, never>;
}

/** Connection status for the SSE client hook */
export type SSEConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

import type { NodeStatus } from '../types.js';
export declare function mapStatus(raw: string | undefined): NodeStatus;
export declare function combineStatuses(statuses: NodeStatus[]): NodeStatus;
export declare function rollupProjectStatus(state: unknown): NodeStatus;

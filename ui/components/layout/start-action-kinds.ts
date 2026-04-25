export const START_ACTION_KINDS = ["start-planning", "start-brainstorming", "execute-plan"] as const;
export type StartActionKind = typeof START_ACTION_KINDS[number];

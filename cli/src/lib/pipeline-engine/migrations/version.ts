/**
 * Single source of truth for the current schema version.
 * Consumed by fresh-state construction (engine.ts scaffoldState) and the
 * migration ladder (P04) to stamp and upgrade state.json files.
 */
export const CURRENT_SCHEMA_VERSION = 'orchestration-state-v6' as const;

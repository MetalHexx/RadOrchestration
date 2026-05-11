/**
 * Result envelope for the plugin-bootstrap event flow.
 * Carries the outcome action, an exit code, and contextual fields.
 */
export interface BootstrapResult {
  /** Outcome discriminant. */
  action: 'noop' | 'downgrade-noop' | 'fresh-install' | 'upgrade-complete' | 'lock-busy' | 'cancelled-modified-files';
  /** Process exit code (always 0 for expected outcomes). */
  code: number;
  /** Human-readable explanation, present for non-trivial outcomes. */
  message?: string;
  /** Paths (bundle-relative) of modified files, present when action === 'cancelled-modified-files'. */
  modifiedFiles?: string[];
  /** Version being delivered by this invocation. */
  deliveringVersion: string;
  /** Previously installed version, absent on fresh install with no prior state. */
  installedVersion?: string;
}

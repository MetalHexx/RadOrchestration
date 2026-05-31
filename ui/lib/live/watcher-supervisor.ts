interface SupervisorArgs {
  maxRestarts: number;
  start: () => void;
  onDegraded: () => void;
}

export function createWatcherSupervisor(args: SupervisorArgs) {
  let restarts = 0;
  let degraded = false;

  function reportError(err: unknown): void {
    console.error('[live] watcher error:', err);
    if (degraded) return;
    if (restarts < args.maxRestarts) {
      restarts += 1;
      args.start();
      return;
    }
    degraded = true;
    args.onDegraded();
  }

  return {
    start: () => args.start(),
    reportError,
    reportHealthy: () => { restarts = 0; },
    isDegraded: () => degraded,
  };
}

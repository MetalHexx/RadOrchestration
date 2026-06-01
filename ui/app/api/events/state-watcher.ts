import path from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────

/** Minimal watcher surface this helper needs — satisfied by a chokidar
 *  FSWatcher and by a test EventEmitter wrapper exposing the same shape. */
export interface MinimalStateWatcher {
  on(event: string, cb: (filePath: string) => void): unknown;
  close(): Promise<void>;
}

export type StateWatcherEventType =
  | 'state_change'
  | 'project_added'
  | 'project_removed';

/** Normalized event emitted by the helper. The route adapts these into SSE
 *  events, preserving the exact existing event names. */
export interface StateWatcherEvent {
  type: StateWatcherEventType;
  projectName: string;
  filePath: string;
}

export interface WireProjectStateWatcherArgs {
  projectsDir: string;
  /** Factory that constructs the underlying watcher for the given path. The
   *  route supplies the real chokidar factory (which receives the projects
   *  directory directly — no glob); tests supply a fake. */
  makeWatcher: (watchPath: string) => MinimalStateWatcher;
  emit: (event: StateWatcherEvent) => void;
}

export interface StateWatcherHandle {
  close(): Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractProjectName(filePath: string, projectsDir: string): string {
  const relative = path.relative(projectsDir, filePath);
  return relative.split(path.sep)[0];
}

/** chokidar v4 removed glob support: a glob string is treated as a literal
 *  path, so `**​/state.json` matches nothing. Instead we watch the projects
 *  directory recursively (see the route's watch options) and filter to files
 *  whose basename is exactly `state.json` ourselves. */
function isStateFile(filePath: string): boolean {
  return path.basename(filePath) === 'state.json';
}

// ─── Wiring ───────────────────────────────────────────────────────────────

/**
 * Attaches add/change/unlink handlers to a watcher of the projects directory
 * and normalizes them into {@link StateWatcherEvent}s, preserving the exact
 * SSE semantics the route has always had:
 *   - a `state.json` `change`  → `state_change`
 *   - a `state.json` `add`     → `project_added`
 *   - a `state.json` `unlink`  → `project_removed`
 *
 * The watcher is created on a plain directory path (no glob) because chokidar
 * v4 dropped glob support; basename filtering replaces the old `**​/state.json`
 * glob. Pure and injectable: the route passes the real chokidar factory, tests
 * pass a fake watcher.
 */
export function wireProjectStateWatcher(
  args: WireProjectStateWatcherArgs,
): StateWatcherHandle {
  const { projectsDir, makeWatcher, emit } = args;

  // v4: watch the directory itself, never a glob pattern.
  const watcher = makeWatcher(projectsDir);

  const emitFor = (type: StateWatcherEventType) => (filePath: string) => {
    if (!isStateFile(filePath)) return;
    const projectName = extractProjectName(filePath, projectsDir);
    emit({ type, projectName, filePath });
  };

  watcher.on('change', emitFor('state_change'));
  watcher.on('add', emitFor('project_added'));
  watcher.on('unlink', emitFor('project_removed'));

  return {
    close: () => watcher.close(),
  };
}

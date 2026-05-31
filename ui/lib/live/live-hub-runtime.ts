import { classifyArtifactEvent, type ArtifactSemanticEvent } from './artifact-adapter';
import { createTopicHub } from './topic-hub';
import { createWatcherSupervisor } from './watcher-supervisor';

export interface ArtifactChangeNotification {
  type: 'artifact_change';
  payload: { projectName: string; kind: 'added' | 'changed' | 'removed' };
  timestamp: string;
}
export interface DegradedNotification {
  type: 'live_degraded';
  payload: { degraded: boolean };
}

interface RuntimeScheduler { schedule(cb: () => void): unknown; cancel(handle: unknown): void; }
interface RuntimeArgs {
  projectsRoot: string;
  makeWatcher?: () => { on: (e: string, cb: (p: unknown) => void) => unknown; close: () => Promise<void> };
  coalesceWindowMs?: number;
  maxRestarts?: number;
  // Optional injected scheduler so a test can drive coalescing deterministically
  // with a manual clock; production leaves it undefined and the hub uses real timers.
  scheduler?: RuntimeScheduler;
}

const GLOBAL_KEY = '__radLiveRuntime__';

function build(args: RuntimeArgs) {
  const hub = createTopicHub({
    coalesceWindowMs: args.coalesceWindowMs ?? 50,
    maxQueuePerTopic: 1,
    scheduler: args.scheduler,
  });
  const degradedListeners = new Set<(n: DegradedNotification) => void>();
  let watcher: { on: (e: string, cb: (p: unknown) => void) => unknown; close: () => Promise<void> } | null = null;

  const supervisor = createWatcherSupervisor({
    maxRestarts: args.maxRestarts ?? 3,
    start: () => { startWatcher(); },
    onDegraded: () => {
      const n: DegradedNotification = { type: 'live_degraded', payload: { degraded: true } };
      for (const l of degradedListeners) l(n);
    },
  });

  function startWatcher(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chokidarMod = require('chokidar');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildWatchOptions } = require('./watch-config');
    const usePolling = process.env.CHOKIDAR_USEPOLLING === '1';
    // Defect 1: capture the outgoing watcher so we can close it once the new one is
    // wired. Without this, a supervisor restart leaks the previous watcher's fs
    // handles and add/change/unlink listeners (bounded by maxRestarts).
    const previous = watcher;
    const w = args.makeWatcher
      ? args.makeWatcher()
      : (chokidarMod.watch(args.projectsRoot, buildWatchOptions(usePolling)) as never);
    (['add', 'change', 'unlink'] as const).forEach((type) => {
      w.on(type, (filePath: unknown) => {
        const sem = classifyArtifactEvent({ type, filePath: String(filePath) }, args.projectsRoot);
        if (sem) hub.publish(sem);
      });
    });
    w.on('error', (err: unknown) => supervisor.reportError(err));
    // Defect 2: chokidar emits 'ready' after the initial scan, signalling a healthy
    // (re)start. Reset the supervisor's restart budget so transient errors that each
    // recover do not accumulate into a permanent degrade over the process lifetime.
    w.on('ready', () => supervisor.reportHealthy());
    watcher = w;
    // Defect 1: startWatcher is synchronous, so close the outgoing watcher
    // fire-and-forget (with error logging). Skipped on the very first start.
    if (previous) {
      void previous.close().catch((e) => console.error('[live] watcher close failed:', e));
    }
  }

  // Start the watcher eagerly so the error handler is registered immediately,
  // allowing supervisor.reportError to fire even before any subscriber connects.
  startWatcher();

  function toNotif(e: ArtifactSemanticEvent): ArtifactChangeNotification {
    return { type: 'artifact_change', payload: { projectName: e.projectName, kind: e.kind }, timestamp: new Date().toISOString() };
  }

  return {
    subscribeAllArtifactTopics(listener: (n: ArtifactChangeNotification) => void): () => void {
      // Connection-level all-topics subscription (AD-4): one registration fed every
      // coalesced event regardless of project topic, so a single SSE connection fans
      // in every project's artifact topic. The hub still owns coalescing and bounding;
      // we only adapt each delivered event into an SSE-ready notification.
      return hub.subscribeAll((e) => listener(toNotif(e)));
    },
    subscribeDegraded(listener: (n: DegradedNotification) => void): () => void {
      degradedListeners.add(listener);
      return () => degradedListeners.delete(listener);
    },
  };
}

// Process-level singleton guarded on globalThis so Next.js hot-reloads in dev
// share one watcher rather than leaking a new instance on every module reload.
type LiveRuntime = ReturnType<typeof build>;

declare const globalThis: {
  [GLOBAL_KEY]?: LiveRuntime;
} & typeof global;

export function getLiveRuntime(args: RuntimeArgs): LiveRuntime {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = build(args);
  }
  return globalThis[GLOBAL_KEY]!;
}

// Test-only reset: deletes the process-level singleton so each test starts fresh.
export function __resetLiveRuntimeForTest(): void {
  delete globalThis[GLOBAL_KEY];
}

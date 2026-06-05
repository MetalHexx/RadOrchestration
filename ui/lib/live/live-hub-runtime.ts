import { readFileSync } from 'node:fs';
import path from 'node:path';
import { classifyArtifactEvent, type ArtifactSemanticEvent } from './artifact-adapter';
import {
  classifyStateEvent,
  classifyLifecycleEvent,
  stateTopicForProject,
  lifecycleTopic,
  type RawFsEvent,
} from './state-adapter';
import { createTopicHub } from './topic-hub';
import { createWatcherSupervisor } from './watcher-supervisor';

export interface ArtifactChangeNotification {
  type: 'artifact_change';
  payload: { projectName: string; kind: 'added' | 'changed' | 'removed' };
  timestamp: string;
}
export interface StateChangeNotification {
  type: 'state_change';
  payload: { projectName: string; state: unknown };
  timestamp: string;
}
export interface LifecycleNotification {
  type: 'project_added' | 'project_removed';
  payload: { projectName: string };
  timestamp: string;
}
export interface DegradedNotification {
  type: 'live_degraded';
  payload: { degraded: boolean };
}
export interface RegistryChangeNotification {
  type: 'registry_change';
  payload: Record<string, never>;
  timestamp: string;
}

interface RuntimeScheduler { schedule(cb: () => void): unknown; cancel(handle: unknown): void; }
type MinimalWatcher = { on: (e: string, cb: (p: unknown) => void) => unknown; close: () => Promise<void> };
interface RuntimeArgs {
  projectsRoot: string;
  makeWatcher?: () => MinimalWatcher;
  // The radorc-home root (e.g. ~/.radorc) watched for registry-file changes,
  // distinct from projectsRoot. When provided, build() warms a second
  // process-level singleton watch scoped to it (FR-2, AD-1, AD-2).
  registryRoot?: string;
  // Optional injected registry watcher so a test can drive registry events
  // deterministically; production constructs a real chokidar watch.
  makeRegistryWatcher?: () => MinimalWatcher;
  coalesceWindowMs?: number;
  maxRestarts?: number;
  // Optional injected scheduler so a test can drive coalescing deterministically
  // with a manual clock; production leaves it undefined and the hub uses real timers.
  scheduler?: RuntimeScheduler;
  // Optional injected state-file reader so a test can supply deterministic content
  // without touching disk; production defaults to a synchronous readFileSync.
  readStateFile?: (filePath: string) => string;
}

const GLOBAL_KEY = '__radLiveRuntime__';

// Explicitly chosen settle window for the registry watch, matching the route's
// registry-watcher (REGISTRY_SETTLE_WINDOW_MS = 300) — distinct from lib/live's
// 500ms projects-tree window (DD-2).
const REGISTRY_SETTLE_WINDOW_MS = 300;
// The two registry files a change on either of which fires a nudge (FR-2, DD-2).
const REGISTRY_FILES = new Set(['repo-registry.yml', 'repo-registry.local.yml']);
function isRegistryFile(filePath: string): boolean {
  return REGISTRY_FILES.has(path.basename(filePath));
}
// The single topic every registry nudge publishes on; subscribeRegistry fans it
// in. Distinct from the artifact/state/lifecycle topics so the same hub carries
// all four without collision (AD-2).
const REGISTRY_TOPIC = 'registry';

function build(args: RuntimeArgs) {
  const hub = createTopicHub({
    coalesceWindowMs: args.coalesceWindowMs ?? 50,
    maxQueuePerTopic: 1,
    scheduler: args.scheduler,
  });
  const degradedListeners = new Set<(n: DegradedNotification) => void>();
  let watcher: MinimalWatcher | null = null;
  let registryWatcher: MinimalWatcher | null = null;

  const emitDegraded = () => {
    const n: DegradedNotification = { type: 'live_degraded', payload: { degraded: true } };
    for (const l of degradedListeners) l(n);
  };

  const supervisor = createWatcherSupervisor({
    maxRestarts: args.maxRestarts ?? 3,
    start: () => { startWatcher(); },
    onDegraded: emitDegraded,
  });

  // The registry watch runs under its OWN supervisor so a registry-watch failure
  // restarts the registry watcher (not the projects watcher) on a SEPARATE restart
  // budget. Without this, registry errors route into the projects supervisor whose
  // restart only re-runs startWatcher() — a registry fault would consume the
  // projects budget and never recreate the registry watcher, leaving registry live
  // updates permanently dead. Both supervisors share one degrade emit: a degrade of
  // either surface degrades "live" for the UI banner (NFR-6).
  const registrySupervisor = createWatcherSupervisor({
    maxRestarts: args.maxRestarts ?? 3,
    start: () => { startRegistryWatcher(); },
    onDegraded: emitDegraded,
  });

  // Default disk read; tests inject readStateFile for deterministic content.
  const readStateFile = args.readStateFile ?? ((filePath: string) => readFileSync(filePath, 'utf-8'));

  // Classify a raw fs event as a state.json write and, if so, read + parse the
  // file once here at the hub (NFR-5, DD-1) so every connection rides one parse.
  // The parsed notification is attached to the hub event's `notif` field and
  // coalesces latest-wins under maxQueuePerTopic = 1 (NFR-4). Read/parse failures
  // are caught and logged so a malformed write never crashes the watcher,
  // matching the route's readFile().catch() behavior.
  function publishStateEvent(type: RawFsEvent['type'], filePath: string): void {
    const sem = classifyStateEvent({ type, filePath }, args.projectsRoot);
    if (!sem) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readStateFile(filePath));
    } catch (e) {
      console.error(`[live] state read/parse failed for ${filePath}:`, e);
      return;
    }
    const notif: StateChangeNotification = {
      type: 'state_change',
      payload: { projectName: sem.projectName, state: parsed },
      timestamp: new Date().toISOString(),
    };
    hub.publish({ topic: sem.topic, kind: 'changed', projectName: sem.projectName, notif });
  }

  // Classify a raw fs event as a project add/remove and publish a lifecycle
  // notification on the single lifecycle topic (FR-3, FR-4, DD-3).
  function publishLifecycleEvent(type: RawFsEvent['type'], filePath: string): void {
    const sem = classifyLifecycleEvent({ type, filePath }, args.projectsRoot);
    if (!sem) return;
    const notif: LifecycleNotification = {
      type: sem.kind,
      payload: { projectName: sem.projectName },
      timestamp: new Date().toISOString(),
    };
    hub.publish({ topic: sem.topic, kind: 'changed', projectName: sem.projectName, notif });
  }

  // A registry-file add/change/unlink fires an empty nudge on the registry topic.
  // The contract carries no payload (DD-2): the client refetches GET /api/registry
  // on receipt, so the watch only needs to signal "something changed".
  function publishRegistryEvent(filePath: string): void {
    if (!isRegistryFile(filePath)) return;
    const notif: RegistryChangeNotification = {
      type: 'registry_change',
      payload: {},
      timestamp: new Date().toISOString(),
    };
    hub.publish({ topic: REGISTRY_TOPIC, kind: 'changed', projectName: '__registry__', notif });
  }

  // Second process-level singleton watch scoped to registryRoot (~/.radorc),
  // distinct from the projects-tree watcher (AD-1, AD-2). Only constructed when
  // registryRoot is provided. Errors route through the dedicated registrySupervisor
  // (its own restart budget) and share the projects watcher's degrade emit, so a
  // registry-watch failure restarts the registry watcher itself and still degrades
  // "live" through the existing path (NFR-6).
  function startRegistryWatcher(): void {
    if (!args.registryRoot) return;
    // Capture the outgoing registry watcher so a supervisor restart closes it once
    // the new one is wired, rather than leaking its fs handles + listeners (parity
    // with startWatcher's Defect 1). Skipped on the very first start.
    const previous = registryWatcher;
    let w: MinimalWatcher;
    if (args.makeRegistryWatcher) {
      w = args.makeRegistryWatcher();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chokidarMod = require('chokidar');
      const usePolling = process.env.CHOKIDAR_USEPOLLING === '1';
      w = chokidarMod.watch(args.registryRoot, {
        usePolling,
        depth: 0,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: REGISTRY_SETTLE_WINDOW_MS, pollInterval: 50 },
      }) as never;
    }
    (['add', 'change', 'unlink'] as const).forEach((type) => {
      w.on(type, (filePath: unknown) => publishRegistryEvent(String(filePath)));
    });
    // Route registry-watch errors into the registry supervisor so the registry
    // watcher is the thing that gets restarted, on its own budget (NFR-6).
    w.on('error', (err: unknown) => registrySupervisor.reportError(err));
    // chokidar 'ready' marks a healthy (re)start — reset the registry budget so
    // transient registry errors that each recover do not accumulate into a
    // permanent degrade (parity with startWatcher's Defect 2).
    w.on('ready', () => registrySupervisor.reportHealthy());
    registryWatcher = w;
    if (previous) {
      void previous.close().catch((e) => console.error('[live] registry watcher close failed:', e));
    }
  }

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
    // addDir/unlinkDir join add/change/unlink so a project directory created or
    // removed without ever writing state.json still drives a lifecycle topic.
    (['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const).forEach((type) => {
      w.on(type, (filePath: unknown) => {
        const fp = String(filePath);
        // addDir/unlinkDir are never artifacts (classifyArtifactEvent only handles
        // add/change/unlink), so only run the artifact classifier for file events.
        if (type === 'add' || type === 'change' || type === 'unlink') {
          const artifact = classifyArtifactEvent({ type, filePath: fp }, args.projectsRoot);
          if (artifact) hub.publish(artifact);
        }
        publishStateEvent(type, fp);
        publishLifecycleEvent(type, fp);
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
  // Start the registry watch eagerly too (no-op when registryRoot is absent),
  // so registry nudges flow without waiting for a subscriber to connect.
  startRegistryWatcher();

  function toNotif(e: ArtifactSemanticEvent): ArtifactChangeNotification {
    return { type: 'artifact_change', payload: { projectName: e.projectName, kind: e.kind }, timestamp: new Date().toISOString() };
  }

  // 'state:' — the prefix every per-project state topic shares (stateTopicForProject
  // returns `state:<name>`), so subscribeAll can fan in every project's state topic.
  const STATE_TOPIC_PREFIX = stateTopicForProject('');
  const LIFECYCLE_TOPIC = lifecycleTopic();

  return {
    subscribeAllArtifactTopics(listener: (n: ArtifactChangeNotification) => void): () => void {
      // Connection-level all-topics subscription (AD-4): one registration fed every
      // coalesced event regardless of project topic, so a single SSE connection fans
      // in every project's artifact topic. The hub still owns coalescing and bounding;
      // we only adapt each delivered event into an SSE-ready notification.
      return hub.subscribeAll((e) => {
        if (
          !e.topic.startsWith(STATE_TOPIC_PREFIX) &&
          e.topic !== LIFECYCLE_TOPIC &&
          e.topic !== REGISTRY_TOPIC
        )
          listener(toNotif(e));
      });
    },
    subscribeAllStateTopics(listener: (n: StateChangeNotification) => void): () => void {
      // Rides hub.subscribeAll filtered to state: topics. The parsed notification
      // was attached at publish time, so we deliver it as-is after coalescing —
      // a burst collapses to the newest parse under maxQueuePerTopic = 1 (NFR-4).
      return hub.subscribeAll((e) => {
        if (e.topic.startsWith(STATE_TOPIC_PREFIX) && e.notif) listener(e.notif as StateChangeNotification);
      });
    },
    subscribeLifecycle(listener: (n: LifecycleNotification) => void): () => void {
      // Rides the single lifecycle topic; the classified notification rides on the
      // hub event's notif field, so we deliver it directly.
      return hub.subscribeAll((e) => {
        if (e.topic === LIFECYCLE_TOPIC && e.notif) listener(e.notif as LifecycleNotification);
      });
    },
    subscribeRegistry(listener: (n: RegistryChangeNotification) => void): () => void {
      // Rides the single registry topic. The empty-payload notification was built
      // at publish time and rides the hub event's notif field, so we deliver it
      // directly after coalescing (a burst collapses under maxQueuePerTopic = 1).
      return hub.subscribeAll((e) => {
        if (e.topic === REGISTRY_TOPIC && e.notif) listener(e.notif as RegistryChangeNotification);
      });
    },
    subscribeDegraded(listener: (n: DegradedNotification) => void): () => void {
      degradedListeners.add(listener);
      return () => degradedListeners.delete(listener);
    },
    // Tear down both process-level watchers (projects + registry). The singleton
    // normally stays warm for the process lifetime; teardown exists so a host that
    // owns the runtime lifecycle can close both fs handles together.
    teardown(): void {
      if (watcher) {
        void watcher.close().catch((e) => console.error('[live] watcher close failed:', e));
        watcher = null;
      }
      if (registryWatcher) {
        void registryWatcher.close().catch((e) => console.error('[live] registry watcher close failed:', e));
        registryWatcher = null;
      }
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

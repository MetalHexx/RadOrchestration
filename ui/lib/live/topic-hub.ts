import type { ArtifactSemanticEvent } from './artifact-adapter';

interface Scheduler {
  schedule(cb: () => void): unknown;
  cancel(handle: unknown): void;
}
interface HubOptions {
  coalesceWindowMs: number;
  maxQueuePerTopic: number;
  scheduler?: Scheduler;
}
type HubListener = (e: ArtifactSemanticEvent) => void;

interface Subscriber {
  topics: Set<string>;
  all: boolean; // connection-level all-topics subscriber: matches every publish
  listener: HubListener;
  // Coalesced state keyed by topic; depth per topic key is bounded by
  // maxQueuePerTopic (latest-per-topic). The number of distinct topics is
  // NOT capped — an all-topics subscriber legitimately holds one entry per
  // project topic within a window.
  pending: Map<string, ArtifactSemanticEvent[]>;
  timer: unknown | null;
}

function defaultScheduler(windowMs: number): Scheduler {
  return {
    schedule: (cb) => setTimeout(cb, windowMs),
    cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

export function createTopicHub(opts: HubOptions) {
  const scheduler = opts.scheduler ?? defaultScheduler(opts.coalesceWindowMs);
  const subscribers = new Set<Subscriber>();

  function flush(sub: Subscriber): void {
    sub.timer = null;
    const events = [...sub.pending.values()].flat();
    sub.pending.clear();
    for (const e of events) sub.listener(e);
  }

  function add(sub: Subscriber): () => void {
    subscribers.add(sub);
    return () => {
      if (sub.timer) scheduler.cancel(sub.timer);
      subscribers.delete(sub);
    };
  }

  function subscribe(topics: string[], listener: HubListener): () => void {
    return add({ topics: new Set(topics), all: false, listener, pending: new Map(), timer: null });
  }

  // Connection-level all-topics subscription (AD-4): one registration fed on
  // every publish regardless of topic, so a single SSE connection fans in
  // every project's artifact topic without enumerating them. It rides the
  // exact same per-topic coalescing + bounded-queue machinery as subscribe().
  function subscribeAll(listener: HubListener): () => void {
    return add({ topics: new Set(), all: true, listener, pending: new Map(), timer: null });
  }

  function publish(e: ArtifactSemanticEvent): void {
    for (const sub of subscribers) {
      if (!sub.all && !sub.topics.has(e.topic)) continue;
      // Bounded per topic key (drop/coalesce, keep latest): the queue for a
      // given topic never grows past maxQueuePerTopic, identically for
      // topic and all-topics subscribers. Distinct topics each get their
      // own bounded queue, so a multi-project all-topics subscriber retains
      // one coalesced event per project topic within the window.
      const q = sub.pending.get(e.topic) ?? [];
      q.push(e);
      while (q.length > opts.maxQueuePerTopic) q.shift();
      sub.pending.set(e.topic, q);
      if (!sub.timer) sub.timer = scheduler.schedule(() => flush(sub));
    }
  }

  return { subscribe, subscribeAll, publish };
}

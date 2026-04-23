// ui/lib/sse/broadcaster.ts
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Handle, Subscriber } from './types';
import { SubscriberRegistry } from './subscriber-registry';
import { DebounceMap } from './debounce-map';

export interface BroadcasterOptions {
  projectsDir: string;
  debounceMs: number;
  heartbeatMs: number;
}

export class SSEBroadcaster {
  readonly projectsDir: string;
  private readonly registry = new SubscriberRegistry();
  private readonly debounce: DebounceMap;
  private readonly fileWatcher: FSWatcher;
  private readonly dirWatcher: FSWatcher;
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor(opts: BroadcasterOptions) {
    this.projectsDir = opts.projectsDir;
    this.debounce = new DebounceMap(opts.debounceMs);
    const usePolling = process.env.CHOKIDAR_USEPOLLING === '1';

    this.fileWatcher = chokidar.watch(
      path.join(opts.projectsDir, '**', 'state.json'),
      {
        usePolling,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        ignored: [/state\.json\.(proposed|empty)$/],
        ignoreInitial: true,
      },
    );
    this.dirWatcher = chokidar.watch(opts.projectsDir, {
      usePolling,
      depth: 0,
      ignoreInitial: true,
    });

    this.heartbeatTimer = setInterval(() => {
      // fan-out implementation lands in P02
    }, opts.heartbeatMs);
  }

  subscribe(sub: Subscriber): Handle {
    return this.registry.add(sub);
  }

  unsubscribe(h: Handle): void {
    this.registry.remove(h);
  }

  subscriberCount(): number {
    return this.registry.size();
  }

  watcherCount(): number {
    return 2;
  }

  /** Test-only teardown. Production code never calls this (AD-3). */
  async shutdownForTest(): Promise<void> {
    clearInterval(this.heartbeatTimer);
    this.debounce.clearAll();
    await this.fileWatcher.close();
    await this.dirWatcher.close();
  }
}

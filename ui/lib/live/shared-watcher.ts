import chokidar from 'chokidar';
import { buildWatchOptions } from './watch-config';

export type RawWatchEventType = 'add' | 'change' | 'unlink';
export interface RawWatchEvent { type: RawWatchEventType; filePath: string; }
type Listener = (e: RawWatchEvent) => void;

interface MakeWatcherArgs { projectsRoot: string; makeWatcher?: () => MinimalWatcher; }
interface MinimalWatcher {
  on(event: string, cb: (p: string) => void): unknown;
  close(): Promise<void>;
}
interface SharedWatcher { subscribe(l: Listener): () => void; }

const GLOBAL_KEY = '__radLiveSharedWatcher__';
type GlobalHolder = { [GLOBAL_KEY]?: SharedWatcherImpl };

class SharedWatcherImpl implements SharedWatcher {
  private listeners = new Set<Listener>();
  private watcher: MinimalWatcher | null = null;
  constructor(private root: string, private factory: () => MinimalWatcher) {}
  private ensureWatcher(): void {
    if (this.watcher) return;
    const w = this.factory();
    (['add', 'change', 'unlink'] as RawWatchEventType[]).forEach((type) => {
      w.on(type, (filePath: string) => {
        for (const l of this.listeners) l({ type, filePath });
      });
    });
    w.on('error', (err: unknown) => console.error('[live] shared watcher error:', err));
    this.watcher = w;
  }
  subscribe(l: Listener): () => void {
    this.ensureWatcher();
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }
}

export function getSharedWatcher(args: MakeWatcherArgs): SharedWatcher {
  const holder = globalThis as unknown as GlobalHolder;
  if (!holder[GLOBAL_KEY]) {
    const usePolling = process.env.CHOKIDAR_USEPOLLING === '1';
    const factory =
      args.makeWatcher ??
      (() => chokidar.watch(args.projectsRoot, buildWatchOptions(usePolling)) as unknown as MinimalWatcher);
    holder[GLOBAL_KEY] = new SharedWatcherImpl(args.projectsRoot, factory);
  }
  return holder[GLOBAL_KEY]!;
}

export function __resetSharedWatcherForTest(): void {
  const holder = globalThis as unknown as GlobalHolder;
  delete holder[GLOBAL_KEY];
}

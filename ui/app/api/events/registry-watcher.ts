import path from 'node:path';

export interface MinimalRegistryWatcher {
  on(event: string, cb: (filePath: string) => void): unknown;
  close(): Promise<void>;
}
export interface WireRegistryWatcherArgs {
  registryRoot: string;
  makeWatcher: (watchPath: string) => MinimalRegistryWatcher;
  emit: () => void;
}
export interface RegistryWatcherHandle { close(): Promise<void> }

// Explicitly chosen settle window for the registry watch — distinct from the
// events route's 200ms stability + 300ms debounce and lib/live's 500ms.
export const REGISTRY_SETTLE_WINDOW_MS = 300;

const REGISTRY_FILES = new Set(['repo-registry.yml', 'repo-registry.local.yml']);

function isRegistryFile(filePath: string): boolean {
  return REGISTRY_FILES.has(path.basename(filePath));
}

export function wireRegistryWatcher(args: WireRegistryWatcherArgs): RegistryWatcherHandle {
  const { registryRoot, makeWatcher, emit } = args;
  const watcher = makeWatcher(registryRoot);
  const handler = (filePath: string) => { if (isRegistryFile(filePath)) emit(); };
  watcher.on('change', handler);
  watcher.on('add', handler);
  watcher.on('unlink', handler);
  return { close: () => watcher.close() };
}

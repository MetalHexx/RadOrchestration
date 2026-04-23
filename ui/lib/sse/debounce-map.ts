export class DebounceMap {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly windowMs: number) {}

  schedule(key: string, cb: () => void): void {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        cb();
      }, this.windowMs),
    );
  }

  clearAll(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }
}

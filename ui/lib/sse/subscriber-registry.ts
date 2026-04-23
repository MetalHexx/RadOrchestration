import type { Handle, Subscriber } from './types';

export class SubscriberRegistry {
  private readonly subs = new Map<Handle, Subscriber>();

  add(sub: Subscriber): Handle {
    const h: Handle = Symbol('sse-sub');
    this.subs.set(h, sub);
    return h;
  }

  remove(h: Handle): void {
    this.subs.delete(h);
  }

  size(): number {
    return this.subs.size;
  }

  forEach(fn: (sub: Subscriber, h: Handle) => void): void {
    this.subs.forEach((sub, h) => fn(sub, h));
  }
}

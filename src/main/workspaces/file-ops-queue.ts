class ConcurrencyQueue {
  private chains = new Map<string, Promise<unknown>>();

  async enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    const next = prev.then(() => task(), () => task());
    this.chains.set(key, next.then(() => undefined, () => undefined));
    return next;
  }
}

const fileOpsQueue = new ConcurrencyQueue();

export { ConcurrencyQueue, fileOpsQueue };
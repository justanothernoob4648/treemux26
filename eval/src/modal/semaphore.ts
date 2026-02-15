export class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (this.current < this.maxConcurrent) {
          this.current++;
          resolve(() => {
            this.current--;
            const next = this.queue.shift();
            if (next) next();
          });
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}

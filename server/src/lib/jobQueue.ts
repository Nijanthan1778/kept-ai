export type Job = () => Promise<void>;

/**
 * A minimal in-process queue that runs at most `concurrency` jobs at once.
 * Limiting concurrency keeps a burst of new items from hammering the rate-limited AI API.
 *
 * Limitation: jobs live in memory, so they are lost if the process stops. Startup
 * recovery re-queues unfinished items; production would use a durable queue (e.g. BullMQ).
 */
export function createJobQueue(concurrency: number, onUnhandledError: (err: unknown) => void) {
  const waiting: Job[] = [];
  let running = 0;

  function startNext(): void {
    while (running < concurrency && waiting.length > 0) {
      const job = waiting.shift()!;
      running++;
      job()
        .catch(onUnhandledError)
        .finally(() => {
          running--;
          startNext();
        });
    }
  }

  return {
    push(job: Job): void {
      waiting.push(job);
      startNext();
    },
  };
}

export type JobQueue = ReturnType<typeof createJobQueue>;

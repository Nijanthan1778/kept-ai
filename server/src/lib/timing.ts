/** Runs `fn` and returns its result with the elapsed wall-clock time in milliseconds. */
export async function timed<T>(fn: () => T | Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}

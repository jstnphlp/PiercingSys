import "server-only";

export async function measureServerTiming<T>(
  label: string,
  operation: () => PromiseLike<T>,
): Promise<T> {
  if (process.env.NODE_ENV !== "development") return operation();

  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const duration = performance.now() - startedAt;
    console.info(`[server-timing] ${label}: ${duration.toFixed(1)}ms`);
  }
}

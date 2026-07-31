/**
 * Connection-pool capacity calculator — Phase 17.
 * Prisma uses DATABASE_URL; optional ?connection_limit=N.
 */

export function parseConnectionLimitFromUrl(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    const u = new URL(databaseUrl);
    const raw = u.searchParams.get('connection_limit');
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ appProcesses?: number, workerProcesses?: number, poolPerProcess?: number, postgresMaxConnections?: number, reservedAdminConnections?: number }} cfg
 */
export function calculatePoolBudget(cfg = {}) {
  const appProcesses = Math.max(1, Number(cfg.appProcesses) || 1);
  const workerProcesses = Math.max(0, Number(cfg.workerProcesses) || 0);
  const poolPerProcess = Math.max(1, Number(cfg.poolPerProcess) || 5);
  const postgresMaxConnections = Math.max(1, Number(cfg.postgresMaxConnections) || 100);
  const reservedAdminConnections = Math.max(0, Number(cfg.reservedAdminConnections) || 5);

  const totalApp = (appProcesses + workerProcesses) * poolPerProcess;
  const safeBudget = postgresMaxConnections - reservedAdminConnections;
  const headroom = safeBudget - totalApp;

  return {
    appProcesses,
    workerProcesses,
    poolPerProcess,
    postgresMaxConnections,
    reservedAdminConnections,
    totalPossibleConnections: totalApp,
    safeBudget,
    headroom,
    withinBudget: headroom >= 0,
    recommendation:
      headroom >= 0
        ? 'Within safe budget.'
        : `Reduce poolPerProcess or process count; oversubscribed by ${Math.abs(headroom)}.`,
  };
}

export function defaultPoolRecommendation() {
  return calculatePoolBudget({
    appProcesses: Number(process.env.WEB_CONCURRENCY) || 1,
    workerProcesses: Number(process.env.WORKER_CONCURRENCY) || 0,
    poolPerProcess: parseConnectionLimitFromUrl(process.env.DATABASE_URL) || 5,
    postgresMaxConnections: Number(process.env.POSTGRES_MAX_CONNECTIONS) || 100,
    reservedAdminConnections: 5,
  });
}

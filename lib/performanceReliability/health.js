/**
 * Liveness / readiness probes — keep cheap; never run financial reports here.
 */

import { TIMEOUTS_MS, withTimeout } from './timeouts.js';
import { defaultPoolRecommendation } from './connectionPool.js';
import { snapshotMetrics } from './metrics.js';
import { circuitSnapshot } from './circuitBreaker.js';
import { getBackpressureGauges } from './backpressure.js';

export function liveness() {
  return {
    status: 'ok',
    check: 'liveness',
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

/**
 * @param {{ prisma?: { $queryRaw: Function }, deep?: boolean }} opts
 */
export async function readiness(opts = {}) {
  const pool = defaultPoolRecommendation();
  const result = {
    status: 'ok',
    check: 'readiness',
    database: 'skipped',
    pool,
    timestamp: new Date().toISOString(),
  };

  if (opts.prisma) {
    try {
      await withTimeout(
        opts.prisma.$queryRaw`SELECT 1 AS ok`,
        TIMEOUTS_MS.HEALTH_DB_PING,
        'db_ping'
      );
      result.database = 'up';
    } catch (e) {
      result.status = 'degraded';
      result.database = 'down';
      result.error = e.code || e.message;
    }
  }

  if (!pool.withinBudget) {
    result.status = result.status === 'ok' ? 'degraded' : result.status;
    result.poolWarning = pool.recommendation;
  }

  return result;
}

export async function deepDiagnostics(opts = {}) {
  const ready = await readiness(opts);
  return {
    ...ready,
    check: 'deep',
    metrics: snapshotMetrics(),
    circuits: circuitSnapshot(),
    backpressure: getBackpressureGauges(),
    memory: process.memoryUsage(),
    node: process.version,
  };
}

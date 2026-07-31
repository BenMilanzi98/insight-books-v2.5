/**
 * Phase 17 — performance/reliability unit tests (no production load claims).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculatePoolBudget,
  parseConnectionLimitFromUrl,
  checkTenantQuota,
  acquireTenantSlot,
  releaseTenantSlot,
  _resetTenantFairness,
  evaluateBackpressure,
  setBackpressureGauges,
  circuitAllow,
  circuitFailure,
  circuitSuccess,
  _resetCircuits,
  getCircuit,
  isRetryableError,
  withBoundedRetry,
  clampPageSize,
  encodeCursor,
  decodeCursor,
  liveness,
  readiness,
  incr,
  observeMs,
  snapshotMetrics,
  resetMetrics,
  PERFORMANCE_FLAGS,
  isPerformanceFlagEnabled,
  clearPerformanceFlagOverrides,
} from '../lib/performanceReliability/index.js';
import { _resetRateLimits } from '../lib/securityGovernance/domain/rateLimit.js';

describe('Connection pool budget', () => {
  it('parses connection_limit from DATABASE_URL', () => {
    expect(
      parseConnectionLimitFromUrl('postgresql://u:p@localhost:5432/db?connection_limit=8')
    ).toBe(8);
    expect(parseConnectionLimitFromUrl('postgresql://u:p@localhost:5432/db')).toBeNull();
  });

  it('flags oversubscription when processes * pool exceed max', () => {
    const over = calculatePoolBudget({
      appProcesses: 10,
      workerProcesses: 10,
      poolPerProcess: 10,
      postgresMaxConnections: 100,
      reservedAdminConnections: 5,
    });
    expect(over.totalPossibleConnections).toBe(200);
    expect(over.withinBudget).toBe(false);

    const ok = calculatePoolBudget({
      appProcesses: 2,
      workerProcesses: 1,
      poolPerProcess: 5,
      postgresMaxConnections: 100,
    });
    expect(ok.withinBudget).toBe(true);
  });
});

describe('Tenant fairness', () => {
  beforeEach(() => {
    _resetRateLimits();
    _resetTenantFairness();
  });

  it('enforces per-business report quota', () => {
    const biz = 'biz_PERF_001';
    let last;
    for (let i = 0; i < 35; i++) {
      last = checkTenantQuota(biz, 'REPORT');
    }
    expect(last.allowed).toBe(false);
    expect(checkTenantQuota('biz_PERF_002', 'REPORT').allowed).toBe(true);
  });

  it('limits concurrent slots per tenant', () => {
    const biz = 'biz_SLOT';
    expect(acquireTenantSlot(biz, 'EXPORT', 2).acquired).toBe(true);
    expect(acquireTenantSlot(biz, 'EXPORT', 2).acquired).toBe(true);
    expect(acquireTenantSlot(biz, 'EXPORT', 2).acquired).toBe(false);
    releaseTenantSlot(biz, 'EXPORT');
    expect(acquireTenantSlot(biz, 'EXPORT', 2).acquired).toBe(true);
  });
});

describe('Backpressure', () => {
  it('admits financial writes under pressure but rejects optional work', () => {
    setBackpressureGauges({ queueDepth: 999, outboxLag: 0, memoryPressure: false });
    const fin = evaluateBackpressure({ workloadClass: 'FINANCIAL_WRITE', isFinancialWrite: true });
    expect(fin.admit).toBe(true);
    expect(fin.mode).toBe('DEGRADED_FINANCIAL_PRIORITY');
    const report = evaluateBackpressure({ workloadClass: 'REPORT', isFinancialWrite: false });
    expect(report.admit).toBe(false);
    setBackpressureGauges({ queueDepth: 0, outboxLag: 0, memoryPressure: false });
  });
});

describe('Circuit breaker', () => {
  beforeEach(() => _resetCircuits());

  it('opens after threshold failures and recovers', () => {
    const name = 'email';
    for (let i = 0; i < 5; i++) circuitFailure(name);
    expect(circuitAllow(name, { recoveryMs: 60_000 })).toBe(false);
    const c = getCircuit(name);
    c.openedAt = Date.now() - 61_000;
    expect(circuitAllow(name, { recoveryMs: 60_000 })).toBe(true);
    circuitSuccess(name);
    expect(circuitAllow(name)).toBe(true);
  });
});

describe('Retry policy', () => {
  it('does not retry validation / permission errors', () => {
    expect(isRetryableError({ code: 'VALIDATION' })).toBe(false);
    expect(isRetryableError({ code: 'PERMISSION_DENIED' })).toBe(false);
    expect(isRetryableError({ code: '40P01' })).toBe(true);
  });

  it('bounds retries', async () => {
    let n = 0;
    await expect(
      withBoundedRetry(
        async () => {
          n += 1;
          const e = new Error('deadlock');
          e.code = '40P01';
          throw e;
        },
        { maxAttempts: 3, baseDelayMs: 1 }
      )
    ).rejects.toThrow(/deadlock/);
    expect(n).toBe(3);
  });
});

describe('Pagination', () => {
  it('clamps page size', () => {
    expect(clampPageSize(9999)).toBe(100);
    expect(clampPageSize(0)).toBe(25);
  });

  it('round-trips cursor', () => {
    const c = encodeCursor({ id: 'je_1', sort: '2026-01-01' });
    expect(decodeCursor(c)).toEqual({ id: 'je_1', sort: '2026-01-01' });
  });
});

describe('Health & metrics', () => {
  beforeEach(() => resetMetrics());

  it('liveness is lightweight', () => {
    const l = liveness();
    expect(l.status).toBe('ok');
    expect(l.check).toBe('liveness');
  });

  it('readiness without prisma skips DB', async () => {
    const r = await readiness({});
    expect(r.database).toBe('skipped');
    expect(r.pool).toBeTruthy();
  });

  it('records counters and timings', () => {
    incr('posting.success');
    observeMs('posting.latency', 12);
    const snap = snapshotMetrics();
    expect(snap.counters['posting.success']).toBe(1);
    expect(snap.timings['posting.latency'].count).toBe(1);
  });
});

describe('Performance flags', () => {
  beforeEach(() => clearPerformanceFlagOverrides());

  it('defaults core flags on', () => {
    expect(isPerformanceFlagEnabled(PERFORMANCE_FLAGS.OBSERVABILITY)).toBe(true);
    expect(isPerformanceFlagEnabled(PERFORMANCE_FLAGS.READ_REPLICA)).toBe(false);
  });
});

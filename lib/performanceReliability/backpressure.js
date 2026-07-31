/**
 * Backpressure signals — queue / pool / memory pressure.
 * Conservative defaults; integrate with real gauges when available.
 */

import { defaultPoolRecommendation } from './connectionPool.js';
import { incr } from './metrics.js';

/** @type {{ queueDepth: number, outboxLag: number, memoryPressure: boolean }} */
const state = {
  queueDepth: 0,
  outboxLag: 0,
  memoryPressure: false,
};

export function setBackpressureGauges(partial = {}) {
  Object.assign(state, partial);
}

export function getBackpressureGauges() {
  return { ...state };
}

/**
 * Decide whether to accept optional (non-financial) work.
 * Financial writes should still be attempted; callers decide.
 */
export function evaluateBackpressure({ workloadClass = 'REPORT', isFinancialWrite = false } = {}) {
  const pool = defaultPoolRecommendation();
  const reasons = [];

  if (!pool.withinBudget) reasons.push('POOL_OVERSUBSCRIBED');
  if (state.queueDepth > 500) reasons.push('QUEUE_DEPTH_HIGH');
  if (state.outboxLag > 1000) reasons.push('OUTBOX_LAG_HIGH');
  if (state.memoryPressure) reasons.push('MEMORY_PRESSURE');

  if (!reasons.length) {
    return { admit: true, mode: 'NORMAL', reasons: [] };
  }

  if (isFinancialWrite) {
    incr('backpressure.financial_admit', 1, { class: workloadClass });
    return {
      admit: true,
      mode: 'DEGRADED_FINANCIAL_PRIORITY',
      reasons,
      note: 'Financial writes admitted; low-priority work should pause.',
    };
  }

  incr('backpressure.reject', 1, { class: workloadClass });
  return {
    admit: false,
    mode: 'BACKPRESSURE',
    reasons,
    retryAfterSec: 30,
  };
}

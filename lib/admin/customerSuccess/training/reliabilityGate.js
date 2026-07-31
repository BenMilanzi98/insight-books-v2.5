/**
 * Training reliability gate — Phase 22 Wave 4 harden.
 * Gate fail → never fabricated zeroes (UNAVAILABLE / value: null).
 */

export const TRAINING_REPORT_STATUS = Object.freeze({
  READY: 'READY',
  EMPTY: 'EMPTY',
  UNAVAILABLE: 'UNAVAILABLE',
});

/**
 * Apply honesty envelope for training metrics/reports.
 * @param {{ permissionOk?: boolean, modelAvailable?: boolean, queryOk?: boolean, freshnessOk?: boolean }} gate
 */
export function applyTrainingReportHonesty(gate = {}) {
  if (gate.permissionOk === false) {
    return {
      kpiSafe: false,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      reliability: 'PERMISSION_RESTRICTED',
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.modelAvailable === false) {
    return {
      kpiSafe: false,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      reliability: 'NOT_INSTRUMENTED',
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.queryOk === false || gate.freshnessOk === false) {
    return {
      kpiSafe: false,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      reliability: 'RECONCILIATION_FAILED',
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  return {
    kpiSafe: true,
    inventZeroesForbidden: true,
    falseZeroes: false,
  };
}

/**
 * Shared safe count — failures return null, never invent 0.
 */
export async function safeTrainingCount(fn) {
  try {
    const value = await fn();
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false, value: null };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, value: null };
  }
}

/**
 * Wrap a metric card — gate fail forces value null (never 0).
 */
export function gatedMetricCard({ label, counted, honesty }) {
  if (!honesty?.kpiSafe || !counted?.ok) {
    return {
      label,
      value: null,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      inventZeroesForbidden: true,
    };
  }
  return {
    label,
    value: counted.value,
    status:
      counted.value === 0
        ? TRAINING_REPORT_STATUS.EMPTY
        : TRAINING_REPORT_STATUS.READY,
    inventZeroesForbidden: true,
  };
}

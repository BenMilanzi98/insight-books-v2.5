/**
 * Conversion reliability gate — Phase 16 Wave 4.
 * Gate fail → never fabricated zeroes (EMPTY/UNAVAILABLE honesty).
 */

export const CRM_CONVERSION_REPORT_STATUS = Object.freeze({
  READY: 'READY',
  EMPTY: 'EMPTY',
  UNAVAILABLE: 'UNAVAILABLE',
});

/**
 * Apply honesty envelope for conversion metrics/reports.
 * @param {{ permissionOk?: boolean, modelAvailable?: boolean, queryOk?: boolean }} gate
 */
export function applyConversionReportHonesty(gate = {}) {
  if (gate.permissionOk === false) {
    return {
      kpiSafe: false,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      reliability: 'PERMISSION_RESTRICTED',
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.modelAvailable === false) {
    return {
      kpiSafe: false,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      reliability: 'NOT_INSTRUMENTED',
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.queryOk === false) {
    return {
      kpiSafe: false,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
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
export async function safeConversionCount(fn) {
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

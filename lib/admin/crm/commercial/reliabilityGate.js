/**
 * Commercial reliability gate — Phase 15 Wave 4.
 * Gate fail → never fabricated zeroes (EMPTY/UNAVAILABLE honesty).
 */

import { CRM_COMMERCIAL_REPORT_STATUS, CRM_RELIABILITY_STATUS } from '../catalogue.js';

/**
 * Apply honesty envelope for commercial metrics/reports.
 * @param {{ permissionOk?: boolean, modelAvailable?: boolean, queryOk?: boolean }} gate
 */
export function applyCommercialReportHonesty(gate = {}) {
  if (gate.permissionOk === false) {
    return {
      kpiSafe: false,
      status: CRM_COMMERCIAL_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.modelAvailable === false) {
    return {
      kpiSafe: false,
      status: CRM_COMMERCIAL_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.queryOk === false) {
    return {
      kpiSafe: false,
      status: CRM_COMMERCIAL_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
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
export async function safeCommercialCount(fn) {
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

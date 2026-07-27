/**
 * Phase 21 — Hypercare operating model, daily reports, exit + BAU handover.
 */

import crypto from 'crypto';
import { Phase21Errors } from './phase21Errors.js';

const HYPERCARE = new Map();
const DAILY = new Map();

export function __resetHypercareForTests() {
  HYPERCARE.clear();
  DAILY.clear();
}

export function startHypercare({
  planId,
  pilotId,
  incidentCommander,
  durationDays = 14,
  staffing = {},
} = {}) {
  if (!incidentCommander) {
    throw Phase21Errors.hypercareExit({ message: 'Incident Commander required.' });
  }
  const id = crypto.randomUUID();
  const row = {
    id,
    planId,
    pilotId,
    incidentCommander,
    durationDays,
    staffing,
    state: 'ACTIVE',
    startedAt: new Date().toISOString(),
    criticalIncidentsOpen: 0,
    highIncidentsOpen: 0,
    criticalDefectsOpen: 0,
    highDefectsOpen: 0,
    acceptancesStable: false,
    reconciliationWithinSla: false,
    sequenceHealthy: false,
    supportManageable: false,
    offlineQueuesHealthy: true,
    monitoringStable: false,
    ownership: {
      operations: false,
      support: false,
      compliance: false,
      security: false,
      finance: false,
      engineering: false,
    },
  };
  HYPERCARE.set(id, row);
  return row;
}

export function recordDailyHypercareReport({
  hypercareId,
  enabledTenants = 0,
  enabledBusinesses = 0,
  activeTerminals = 0,
  fiscalSalesCount = 0,
  acceptedCount = 0,
  rejectedCount = 0,
  unknownCount = 0,
  currency = 'MWK',
  grossValue = '0.00',
  criticalAlerts = 0,
  incidents = 0,
  supportTickets = 0,
  risks = [],
  decisions = [],
} = {}) {
  const hc = HYPERCARE.get(hypercareId);
  if (!hc || hc.state !== 'ACTIVE') throw Phase21Errors.hypercareExit({ message: 'Hypercare not active.' });
  const acceptanceRate =
    fiscalSalesCount > 0 ? acceptedCount / fiscalSalesCount : 1;
  const report = {
    id: crypto.randomUUID(),
    hypercareId,
    date: new Date().toISOString().slice(0, 10),
    enabledTenants,
    enabledBusinesses,
    activeTerminals,
    fiscalSalesCount,
    acceptedCount,
    rejectedCount,
    unknownCount,
    acceptanceRate,
    currency,
    grossValue,
    criticalAlerts,
    incidents,
    supportTickets,
    risks,
    decisions,
    exactDecimals: true,
  };
  DAILY.set(report.id, report);
  return report;
}

export function updateHypercareHealth(hypercareId, patch = {}) {
  const hc = HYPERCARE.get(hypercareId);
  if (!hc) throw Phase21Errors.hypercareExit({ message: 'Hypercare not found.' });
  Object.assign(hc, patch);
  return hc;
}

export function evaluateHypercareExit({ hypercareId, elapsedDaysOnly = false } = {}) {
  const hc = HYPERCARE.get(hypercareId);
  if (!hc) throw Phase21Errors.hypercareExit({ message: 'Hypercare not found.' });
  if (elapsedDaysOnly) {
    throw Phase21Errors.hypercareExit({
      message: 'Hypercare must not close based only on elapsed time.',
    });
  }

  const failed = [];
  if (hc.criticalIncidentsOpen > 0) failed.push('CRITICAL_INCIDENTS');
  if (hc.highIncidentsOpen > 0) failed.push('HIGH_INCIDENTS');
  if (hc.criticalDefectsOpen > 0) failed.push('CRITICAL_DEFECTS');
  if (hc.highDefectsOpen > 0) failed.push('HIGH_DEFECTS');
  if (!hc.acceptancesStable) failed.push('ACCEPTANCE_UNSTABLE');
  if (!hc.reconciliationWithinSla) failed.push('RECON_SLA');
  if (!hc.sequenceHealthy) failed.push('SEQUENCE');
  if (!hc.supportManageable) failed.push('SUPPORT');
  if (!hc.monitoringStable) failed.push('MONITORING');
  if (!hc.offlineQueuesHealthy) failed.push('OFFLINE_QUEUE');
  for (const [role, ok] of Object.entries(hc.ownership)) {
    if (!ok) failed.push(`OWNERSHIP_${role.toUpperCase()}`);
  }

  if (failed.length) {
    throw Phase21Errors.hypercareExit({
      message: `Hypercare exit criteria unmet: ${failed.join(', ')}`,
      details: { failed },
    });
  }

  hc.state = 'EXIT_APPROVED';
  hc.exitedAt = new Date().toISOString();
  return { hypercareId, exited: true, failedCriteria: [], objectiveCriteriaOnly: true };
}

export function completeBauHandover({
  hypercareId,
  acceptances = {},
} = {}) {
  const hc = HYPERCARE.get(hypercareId);
  if (!hc || hc.state !== 'EXIT_APPROVED') {
    throw Phase21Errors.bauHandover({ message: 'Hypercare exit must be approved first.' });
  }
  const required = ['operations', 'support', 'compliance', 'security', 'finance', 'engineering'];
  for (const r of required) {
    if (!acceptances[r]) {
      throw Phase21Errors.bauHandover({
        message: `BAU acceptance required from ${r}.`,
      });
    }
  }
  hc.ownership = { ...hc.ownership, ...acceptances };
  hc.state = 'BAU_HANDED_OVER';
  hc.bauHandedOverAt = new Date().toISOString();
  return {
    hypercareId,
    bauReady: true,
    ownership: hc.ownership,
    completedAt: hc.bauHandedOverAt,
  };
}

export function getHypercare(id) {
  return HYPERCARE.get(id) || null;
}

/**
 * Phase 18 — SLA monitoring (timezone-aware thresholds).
 */

export const SLA_TARGETS = Object.freeze({
  UNKNOWN_OUTCOME_RECONCILIATION: {
    id: 'UNKNOWN_OUTCOME_RECONCILIATION',
    targetMinutes: 240,
    warningMinutes: 120,
    breachMinutes: 240,
    timezone: 'Africa/Blantyre',
    owner: 'RECONCILIATION_OFFICER',
  },
  MANUAL_REVIEW: {
    id: 'MANUAL_REVIEW',
    targetMinutes: 1440,
    warningMinutes: 720,
    breachMinutes: 1440,
    timezone: 'Africa/Blantyre',
    owner: 'COMPLIANCE_OFFICER',
  },
  UNBLOCK_REQUEST: {
    id: 'UNBLOCK_REQUEST',
    targetMinutes: 2880,
    warningMinutes: 1440,
    breachMinutes: 2880,
    timezone: 'Africa/Blantyre',
    owner: 'COMPLIANCE_OFFICER',
  },
  RECEIPT_GENERATION: {
    id: 'RECEIPT_GENERATION',
    targetMinutes: 30,
    warningMinutes: 15,
    breachMinutes: 30,
    timezone: 'Africa/Blantyre',
    owner: 'SUPPORT',
  },
  ALERT_ACKNOWLEDGMENT: {
    id: 'ALERT_ACKNOWLEDGMENT',
    targetMinutes: 60,
    warningMinutes: 30,
    breachMinutes: 60,
    timezone: 'Africa/Blantyre',
    owner: 'SECURITY_ADMINISTRATOR',
  },
  EXPORT_COMPLETION: {
    id: 'EXPORT_COMPLETION',
    targetMinutes: 60,
    warningMinutes: 30,
    breachMinutes: 60,
    timezone: 'Africa/Blantyre',
    owner: 'PLATFORM',
  },
});

export function evaluateSla({
  slaId,
  startedAt,
  now = new Date(),
} = {}) {
  const def = SLA_TARGETS[slaId];
  if (!def) return { ok: false, reason: 'UNKNOWN_SLA' };
  const start = new Date(startedAt).getTime();
  const ageMinutes = (new Date(now).getTime() - start) / 60_000;
  let state = 'WITHIN';
  if (ageMinutes >= def.breachMinutes) state = 'BREACHED';
  else if (ageMinutes >= def.warningMinutes) state = 'WARNING';
  return {
    slaId,
    state,
    ageMinutes: Math.round(ageMinutes * 10) / 10,
    targetMinutes: def.targetMinutes,
    warningMinutes: def.warningMinutes,
    breachMinutes: def.breachMinutes,
    timezone: def.timezone,
    owner: def.owner,
    evaluatedAt: new Date(now).toISOString(),
  };
}

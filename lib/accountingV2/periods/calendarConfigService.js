/**
 * Phase 8 — business-scoped financial calendar configuration.
 * One row per business (`AcctV2FinancialCalendarConfig`); safe defaults are
 * returned when no row exists so read paths never fail-open on policy.
 */

import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { toDateOnly } from './periodGeneration.js';

export const CALENDAR_CONFIG_DEFAULTS = Object.freeze({
  name: 'Standard Financial Calendar',
  fyStartMonth: 1,
  fyStartDay: 1,
  timezone: 'Africa/Blantyre',
  periodFrequency: 'MONTHLY',
  postingDatePolicy: 'POSTING_DATE_DETERMINES_PERIOD',
  backdatingPolicy: 'PERMISSION_AND_REASON',
  futureDatingPolicy: 'TOLERANCE',
  futureToleranceDays: 31,
  lockDate: null,
  checklistTemplateId: 'STANDARD_MONTHLY_CLOSE',
  // Opt into 1.1.0 when bank recon period-close feed is enabled for the tenant.
  checklistTemplateVersion: '1.0.0',
  snapshotOnClose: true,
  recloseDeadlineDays: 14,
  allowAdjustmentPeriod: false,
});

/** @returns {Promise<object>} persisted config merged over defaults */
export async function getCalendarConfig(db, context) {
  const row = await db.acctV2FinancialCalendarConfig.findUnique({
    where: { tenantId: context.businessId },
  });
  return { ...CALENDAR_CONFIG_DEFAULTS, tenantId: context.businessId, ...(row ?? {}), persisted: row != null };
}

const MUTABLE_FIELDS = [
  'name', 'fyStartMonth', 'fyStartDay', 'timezone', 'postingDatePolicy',
  'backdatingPolicy', 'futureDatingPolicy', 'futureToleranceDays', 'lockDate',
  'checklistTemplateId', 'checklistTemplateVersion', 'snapshotOnClose',
  'recloseDeadlineDays', 'allowAdjustmentPeriod',
];

/**
 * Create or update the calendar configuration. Validates ranges and audits
 * previous → new values. Lock-date changes require a reason.
 */
export async function updateCalendarConfig(db, context, patch, { reason = null } = {}) {
  const data = {};
  for (const field of MUTABLE_FIELDS) {
    if (patch[field] !== undefined) data[field] = patch[field];
  }
  if (data.fyStartMonth != null) {
    const m = Number(data.fyStartMonth);
    if (!Number.isInteger(m) || m < 1 || m > 12) throw new RangeError('fyStartMonth must be 1–12.');
    data.fyStartMonth = m;
  }
  if (data.fyStartDay != null) {
    const d = Number(data.fyStartDay);
    if (!Number.isInteger(d) || d < 1 || d > 28) throw new RangeError('fyStartDay must be 1–28 (deterministic across months).');
    data.fyStartDay = d;
  }
  if (data.futureToleranceDays != null) {
    const t = Number(data.futureToleranceDays);
    if (!Number.isInteger(t) || t < 0 || t > 366) throw new RangeError('futureToleranceDays must be 0–366.');
    data.futureToleranceDays = t;
  }
  if (data.lockDate !== undefined && data.lockDate !== null) {
    const lock = toDateOnly(data.lockDate);
    if (!lock) throw new RangeError('lockDate is not a valid date.');
    data.lockDate = lock;
    if (!reason) throw new RangeError('Changing the lock date requires a reason.');
  }

  const previous = await db.acctV2FinancialCalendarConfig.findUnique({
    where: { tenantId: context.businessId },
  });

  const row = await db.acctV2FinancialCalendarConfig.upsert({
    where: { tenantId: context.businessId },
    create: { tenantId: context.businessId, ...CALENDAR_CONFIG_DEFAULTS, ...data, createdBy: context.userId, updatedBy: context.userId },
    update: { ...data, updatedBy: context.userId },
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.calendar.configChange',
      entityType: 'AcctV2FinancialCalendarConfig',
      entityId: row.id,
      userId: context.userId,
      tenantId: context.businessId,
      previousValues: previous ? Object.fromEntries(MUTABLE_FIELDS.map((f) => [f, previous[f]])) : null,
      newValues: Object.fromEntries(MUTABLE_FIELDS.map((f) => [f, row[f]])),
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return row;
}

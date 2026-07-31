/**
 * Accounting V2 — legacy period resolver adapter.
 *
 * READS: `AccountingPeriod` rows + `lib/accountingPeriodService.js` semantics.
 * WRITES: nothing.
 *
 * Deliberate difference from legacy: the V2 contract is DENY-BY-DEFAULT. Legacy
 * `assertPeriodOpen` fails open when a tenant has zero periods or on unexpected
 * errors; this resolver reports those situations explicitly instead of allowing.
 * Known inherited defects (documented): date-inferred assignment (no FK), possible
 * period overlaps/gaps in data, boundary-day double coverage.
 * Removal: Phase 8 (Financial Calendar) replaces this resolver.
 */

import prisma from '../../../prisma.js';
import { PeriodStatus } from '../../domain/enums.js';

/**
 * @typedef {object} PeriodResolution
 * @property {'OPEN'|'CLOSED'|'NO_PERIOD'|'AMBIGUOUS'} decision
 * @property {boolean} postingAllowed under strict V2 policy (deny-by-default)
 * @property {boolean} legacyWouldAllow what the legacy fail-open engine would do
 * @property {object|null} period matched AccountingPeriod row (or null)
 * @property {object[]} overlapping all periods covering the date (ambiguity evidence)
 */

/**
 * Resolve the accounting period for a posting date, business-scoped.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {Date|string} entryDate
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<PeriodResolution>}
 */
export async function resolveLegacyPeriod(context, entryDate, db = prisma) {
  const date = new Date(entryDate);
  const covering = await db.accountingPeriod.findMany({
    where: {
      tenantId: context.businessId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    orderBy: { startDate: 'asc' },
  });
  const anyPeriods =
    covering.length > 0 ||
    (await db.accountingPeriod.count({ where: { tenantId: context.businessId } })) > 0;

  if (covering.length === 0) {
    return {
      decision: 'NO_PERIOD',
      postingAllowed: false, // strict V2: no covering period = deny
      legacyWouldAllow: !anyPeriods, // legacy allows when tenant has zero periods
      period: null,
      overlapping: [],
    };
  }

  const closed = covering.find((p) => String(p.status).toLowerCase() === 'closed');
  if (closed) {
    return {
      decision: 'CLOSED',
      postingAllowed: false,
      legacyWouldAllow: false,
      period: closed,
      overlapping: covering,
    };
  }

  if (covering.length > 1) {
    return {
      decision: 'AMBIGUOUS',
      postingAllowed: false, // strict V2: overlapping open periods must be resolved first
      legacyWouldAllow: true,
      period: covering[0],
      overlapping: covering,
    };
  }

  return {
    decision: 'OPEN',
    postingAllowed: true,
    legacyWouldAllow: true,
    period: covering[0],
    overlapping: covering,
  };
}

/** Map a raw AccountingPeriod row status to the V2 PeriodStatus enum. */
export function toV2PeriodStatus(row) {
  const s = String(row?.status ?? '').toLowerCase();
  if (s === 'closed') return PeriodStatus.CLOSED;
  if (row?.reopenedAt || s === 'reopened') return PeriodStatus.REOPENED;
  return PeriodStatus.OPEN;
}

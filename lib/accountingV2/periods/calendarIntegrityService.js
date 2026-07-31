/**
 * Phase 8 — Calendar Integrity Service (PER-101 … PER-110).
 * Business-scoped structural validation of canonical financial years and
 * accounting periods. Read-only; findings are returned, never auto-repaired.
 */

import { toDateOnly, isoDate } from './periodGeneration.js';
import { FinancialYearStatus, AccountingPeriodStatus } from './periodEnums.js';

export const CALENDAR_RULES = Object.freeze({
  'PER-101': 'Financial years overlap',
  'PER-102': 'Accounting periods overlap',
  'PER-103': 'Gap between accounting periods',
  'PER-104': 'Period outside financial year',
  'PER-105': 'Duplicate period number',
  'PER-106': 'Duplicate period code',
  'PER-107': 'Missing month',
  'PER-108': 'Financial year lacks periods',
  'PER-109': 'Multiple current financial years',
  'PER-110': 'Current period does not belong to current year',
});

const DAY = 24 * 60 * 60 * 1000;

/**
 * Run the full calendar integrity audit for the business.
 * @returns {Promise<{status: 'PASS'|'FAIL', findings: Array, checkedYears: number, checkedPeriods: number}>}
 */
export async function runCalendarIntegrityAudit(db, context, { now = new Date() } = {}) {
  const findings = [];
  const add = (rule, message, detail = {}) =>
    findings.push({ rule, title: CALENDAR_RULES[rule], message, ...detail });

  const years = await db.acctV2FinancialYear.findMany({
    where: { tenantId: context.businessId },
    orderBy: { startDate: 'asc' },
  });
  const periods = await db.acctV2AccountingPeriod.findMany({
    where: { tenantId: context.businessId },
    orderBy: { startDate: 'asc' },
  });

  // PER-101 — overlapping financial years.
  for (let i = 1; i < years.length; i += 1) {
    const prev = years[i - 1];
    const cur = years[i];
    if (toDateOnly(cur.startDate) <= toDateOnly(prev.endDate)) {
      add('PER-101', `${prev.code} and ${cur.code} overlap.`, { financialYearIds: [prev.id, cur.id] });
    }
  }

  // PER-109 — multiple current financial years.
  const current = years.filter((y) => y.isCurrent);
  if (current.length > 1) {
    add('PER-109', `${current.length} financial years are flagged current (${current.map((y) => y.code).join(', ')}).`);
  }

  const byYear = new Map();
  for (const p of periods) {
    if (!byYear.has(p.financialYearId)) byYear.set(p.financialYearId, []);
    byYear.get(p.financialYearId).push(p);
  }

  for (const fy of years) {
    const fyPeriods = (byYear.get(fy.id) ?? []).filter((p) => !p.isAdjustmentPeriod);
    // PER-108 — year lacks periods.
    if (fyPeriods.length === 0) {
      add('PER-108', `${fy.code} has no accounting periods.`, { financialYearId: fy.id });
      continue;
    }
    // PER-107 — missing months (count below configured period count).
    if (fyPeriods.length < fy.numberOfPeriods) {
      add('PER-107', `${fy.code} has ${fyPeriods.length} of ${fy.numberOfPeriods} periods.`, { financialYearId: fy.id });
    }
    const seenNumbers = new Set();
    const seenCodes = new Set();
    const sorted = [...fyPeriods].sort((a, b) => toDateOnly(a.startDate) - toDateOnly(b.startDate));
    for (let i = 0; i < sorted.length; i += 1) {
      const p = sorted[i];
      // PER-105 / PER-106 — duplicates.
      if (seenNumbers.has(p.periodNumber)) {
        add('PER-105', `${fy.code} has duplicate period number ${p.periodNumber}.`, { periodId: p.id });
      }
      seenNumbers.add(p.periodNumber);
      if (seenCodes.has(p.code)) add('PER-106', `Duplicate period code ${p.code}.`, { periodId: p.id });
      seenCodes.add(p.code);
      // PER-104 — outside the financial year.
      if (toDateOnly(p.startDate) < toDateOnly(fy.startDate) || toDateOnly(p.endDate) > toDateOnly(fy.endDate)) {
        add('PER-104', `${p.code} (${isoDate(toDateOnly(p.startDate))} – ${isoDate(toDateOnly(p.endDate))}) lies outside ${fy.code}.`, { periodId: p.id });
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        const expected = toDateOnly(prev.endDate).getTime() + DAY;
        const actual = toDateOnly(p.startDate).getTime();
        // PER-102 — overlap; PER-103 — gap.
        if (actual < expected) {
          add('PER-102', `${prev.code} and ${p.code} overlap.`, { periodIds: [prev.id, p.id] });
        } else if (actual > expected) {
          add('PER-103', `Gap between ${prev.code} and ${p.code}.`, { periodIds: [prev.id, p.id] });
        }
      }
    }
  }

  // PER-110 — the period covering "today" must belong to the current year.
  const today = toDateOnly(now);
  const currentYear = current[0] ?? null;
  const coveringPeriods = periods.filter(
    (p) => !p.isAdjustmentPeriod && toDateOnly(p.startDate) <= today && toDateOnly(p.endDate) >= today
  );
  if (currentYear && coveringPeriods.length > 0) {
    const inCurrentYear = coveringPeriods.some((p) => p.financialYearId === currentYear.id);
    if (!inCurrentYear) {
      add('PER-110', `Period covering ${isoDate(today)} does not belong to current year ${currentYear.code}.`);
    }
  }

  return {
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
    checkedYears: years.length,
    checkedPeriods: periods.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Convenience summary for dashboards: current year, current period and the
 * open-period position for the business.
 */
export async function getCalendarSummary(db, context, { now = new Date() } = {}) {
  const today = toDateOnly(now);
  const currentYear = await db.acctV2FinancialYear.findFirst({
    where: { tenantId: context.businessId, isCurrent: true },
  });
  const currentPeriod = await db.acctV2AccountingPeriod.findFirst({
    where: {
      tenantId: context.businessId,
      startDate: { lte: today },
      endDate: { gte: today },
      isAdjustmentPeriod: false,
    },
    orderBy: { startDate: 'desc' },
  });
  const openCount = await db.acctV2AccountingPeriod.count({
    where: { tenantId: context.businessId, status: AccountingPeriodStatus.OPEN },
  });
  const closingCount = await db.acctV2AccountingPeriod.count({
    where: { tenantId: context.businessId, status: AccountingPeriodStatus.CLOSING },
  });
  const daysRemaining = currentPeriod
    ? Math.max(0, Math.round((toDateOnly(currentPeriod.endDate).getTime() - today.getTime()) / DAY))
    : null;
  return {
    currentFinancialYear: currentYear,
    currentPeriod,
    currentPeriodDaysRemaining: daysRemaining,
    openPeriodCount: openCount,
    closingPeriodCount: closingCount,
    hasCalendar: currentYear != null,
    financialYearStatuses: FinancialYearStatus,
  };
}

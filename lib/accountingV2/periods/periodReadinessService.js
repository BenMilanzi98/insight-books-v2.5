/**
 * Phase 8 — business period readiness assessment (§58).
 * Determines whether strict period enforcement can be activated for a
 * business. Read-only; results feed the controlled rollout.
 */

import { runCalendarIntegrityAudit, getCalendarSummary } from './calendarIntegrityService.js';
import { getCalendarConfig } from './calendarConfigService.js';
import { PeriodReadinessStatus } from './periodEnums.js';

/**
 * @returns {Promise<{status: string, checks: Array<{check: string, ok: boolean, detail: string}>}>}
 */
export async function assessPeriodReadiness(db, context, { now = new Date() } = {}) {
  const checks = [];
  const add = (check, ok, detail) => checks.push({ check, ok, detail });

  const config = await getCalendarConfig(db, context);
  add('CALENDAR_CONFIGURED', config.persisted === true, config.persisted ? 'Calendar configuration exists.' : 'No calendar configuration row (defaults in effect).');

  const yearCount = await db.acctV2FinancialYear.count({ where: { tenantId: context.businessId } });
  add('FINANCIAL_YEARS_EXIST', yearCount > 0, `${yearCount} canonical financial years.`);

  const integrity = await runCalendarIntegrityAudit(db, context, { now });
  add('CALENDAR_INTEGRITY', integrity.status === 'PASS', integrity.status === 'PASS' ? 'No PER-1xx findings.' : `${integrity.findings.length} integrity findings.`);

  const summary = await getCalendarSummary(db, context, { now });
  add('CURRENT_PERIOD_EXISTS', summary.currentPeriod != null, summary.currentPeriod ? `Current period ${summary.currentPeriod.code}.` : 'No period covers today.');

  const unassignedJournals = await db.journalEntry.count({
    where: { tenantId: context.businessId, status: { in: ['POSTED', 'Posted'] }, accountingPeriodId: null },
  });
  add('JOURNALS_HAVE_PERIODS', unassignedJournals === 0, `${unassignedJournals} posted journals without a canonical period reference.`);

  let openAnomalies = 0;
  if (db.acctV2HistoricalAnomaly) {
    openAnomalies = await db.acctV2HistoricalAnomaly.count({
      where: { tenantId: context.businessId, status: { in: ['DETECTED', 'INVESTIGATING', 'CONFIRMED'] }, severity: { in: ['HIGH', 'CRITICAL'] } },
    });
  }
  add('NO_BLOCKING_HISTORICAL_EXCEPTIONS', openAnomalies === 0, `${openAnomalies} open high-severity historical anomalies.`);

  let status = PeriodReadinessStatus.READY;
  if (yearCount === 0) {
    status = config.persisted
      ? PeriodReadinessStatus.REQUIRES_PERIOD_MAPPING
      : PeriodReadinessStatus.REQUIRES_CALENDAR_CONFIGURATION;
  } else if (integrity.status !== 'PASS' || !summary.currentPeriod) {
    status = PeriodReadinessStatus.BLOCKED;
  } else if (unassignedJournals > 0) {
    status = PeriodReadinessStatus.REQUIRES_PERIOD_MAPPING;
  } else if (openAnomalies > 0) {
    status = PeriodReadinessStatus.REQUIRES_HISTORICAL_REPAIR;
  } else if (!config.persisted) {
    status = PeriodReadinessStatus.READY_WITH_WARNINGS;
  }

  return {
    businessId: context.businessId,
    status,
    checks,
    generatedAt: new Date().toISOString(),
  };
}

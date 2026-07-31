import { getPlanningConfiguration } from './configService.js';
import { buildHistoricalDataset } from './historicalDatasetService.js';

export async function assessPlanningReadiness(db, context) {
  const tenantId = context.businessId;
  const cfg = await getPlanningConfiguration(db, tenantId);
  const historical = await buildHistoricalDataset(db, context, {
    lookbackMonths: cfg?.defaultHistoricalLookbackMonths || 24,
  });

  const checks = [
    {
      key: 'PLANNING_CONFIGURATION',
      ok: Boolean(cfg && cfg.status === 'APPROVED'),
      detail: cfg ? `status=${cfg.status}` : 'missing',
    },
    {
      key: 'HISTORICAL_QUALITY',
      ok: historical.quality.suitableForAutomaticBaseline,
      detail: historical.quality.status,
    },
    {
      key: 'CLOSED_ACTUALS_PREFERRED',
      ok: historical.quality.closedPeriodCount > 0,
      detail: `closedPeriods=${historical.quality.closedPeriodCount}`,
    },
    {
      key: 'BASE_CURRENCY',
      ok: Boolean(cfg?.baseCurrency),
      detail: cfg?.baseCurrency || 'missing',
    },
    {
      key: 'NEVER_POSTS_TO_GL',
      ok: true,
      detail: 'Planning tables are separate from Journal Entries',
    },
  ];

  const scenarios = await db.planV2Scenario.count({ where: { tenantId } }).catch(() => 0);
  checks.push({
    key: 'SCENARIOS',
    ok: scenarios >= 1,
    detail: `scenarioCount=${scenarios}`,
  });

  let status = 'READY';
  if (!cfg || cfg.status !== 'APPROVED') status = 'REQUIRES_CONFIGURATION';
  else if (!historical.quality.suitableForAutomaticBaseline) {
    status =
      historical.quality.status === 'UNSUITABLE_FOR_AUTOMATIC_BASELINE'
        ? 'REQUIRES_HISTORICAL_REPAIR'
        : 'LIMITED_HISTORY';
  } else if (checks.some((c) => !c.ok && c.key !== 'CLOSED_ACTUALS_PREFERRED')) {
    status = 'READY_WITH_WARNINGS';
  } else if (!checks.find((c) => c.key === 'CLOSED_ACTUALS_PREFERRED').ok) {
    status = 'READY_WITH_WARNINGS';
  }

  return {
    tenantId,
    status,
    checks,
    historicalQuality: historical.quality,
    phase14InputsReady: status === 'READY' || status === 'READY_WITH_WARNINGS' || status === 'LIMITED_HISTORY',
    generatedAt: new Date().toISOString(),
  };
}

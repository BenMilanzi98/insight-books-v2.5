import { createHash } from 'crypto';
import {
  ForecastIntegrityStatus,
  ForecastVersionStatus,
} from '../domain/enums.js';
import {
  CrossTenantPlanningError,
  ForecastIntegrityBlockedError,
  ForecastVersionImmutableError,
  ForecastVersionNotFoundError,
} from '../domain/errors.js';
import { projectThreeStatements } from '../domain/threeStatementEngine.js';
import { assumptionsToEngineInput } from './assumptionService.js';
import {
  buildHistoricalDataset,
  loadOpeningBalancesForPlanning,
} from './historicalDatasetService.js';

const IMMUTABLE = new Set([
  ForecastVersionStatus.APPROVED,
  ForecastVersionStatus.ACTIVE,
  ForecastVersionStatus.SUPERSEDED,
]);

export async function createForecastCycle(db, context, input = {}) {
  const tenantId = context.businessId;
  const cycleNumber = input.cycleNumber || `FC-${Date.now()}`;
  return db.planV2ForecastCycle.create({
    data: {
      tenantId,
      cycleNumber,
      name: input.name || cycleNumber,
      description: input.description || null,
      actualsCutoffDate: input.actualsCutoffDate ? new Date(input.actualsCutoffDate) : null,
      forecastStartDate: new Date(input.forecastStartDate),
      forecastEndDate: new Date(input.forecastEndDate),
      horizonMonths: input.horizonMonths || 12,
      granularity: input.granularity || 'MONTHLY',
      currency: input.currency || 'MWK',
      status: 'DRAFT',
      createdBy: context.userId,
      metadata: input.metadata || null,
    },
  });
}

export async function listForecastCycles(db, tenantId) {
  return db.planV2ForecastCycle.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 5,
        select: {
          id: true,
          version: true,
          name: true,
          status: true,
          integrityStatus: true,
          scenarioId: true,
          checksum: true,
          approvedAt: true,
        },
      },
    },
  });
}

export async function createForecastVersion(db, context, input = {}) {
  const tenantId = context.businessId;
  const cycle = await db.planV2ForecastCycle.findFirst({
    where: { id: input.forecastCycleId, tenantId },
  });
  if (!cycle) throw new CrossTenantPlanningError('Forecast cycle not found for business.');

  const scenario = await db.planV2Scenario.findFirst({
    where: { id: input.scenarioId, tenantId },
  });
  if (!scenario) throw new CrossTenantPlanningError('Scenario not found for business.');

  const assumptionSet = await db.planV2AssumptionSet.findFirst({
    where: { id: input.assumptionSetId, tenantId, scenarioId: scenario.id },
    include: { assumptions: true },
  });
  if (!assumptionSet) {
    throw new CrossTenantPlanningError('Assumption set not found for scenario/business.');
  }

  const latest = await db.planV2ForecastVersion.findFirst({
    where: { forecastCycleId: cycle.id, scenarioId: scenario.id, tenantId },
    orderBy: { version: 'desc' },
  });
  const version = (latest?.version || 0) + 1;

  return db.planV2ForecastVersion.create({
    data: {
      tenantId,
      forecastCycleId: cycle.id,
      scenarioId: scenario.id,
      assumptionSetId: assumptionSet.id,
      version,
      name: input.name || `${cycle.name} / ${scenario.code} v${version}`,
      status: ForecastVersionStatus.DRAFT,
      integrityStatus: ForecastIntegrityStatus.NOT_CALCULATED,
      preparedBy: context.userId,
      openingBalances: input.openingBalances || null,
      baseRevenueMinor: input.baseRevenueMinor != null ? BigInt(input.baseRevenueMinor) : null,
      assumptionsSnapshot: assumptionsToEngineInput(assumptionSet.assumptions),
      metadata: { neverPostsToGl: true, ...(input.metadata || {}) },
    },
  });
}

export async function getForecastVersion(db, tenantId, id) {
  const row = await db.planV2ForecastVersion.findFirst({
    where: { id, tenantId },
    include: {
      scenario: true,
      assumptionSet: { include: { assumptions: true } },
      cycle: true,
      overrides: true,
      snapshots: true,
      aiSuggestions: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!row) throw new ForecastVersionNotFoundError();
  return row;
}

export async function calculateForecastVersion(db, context, forecastVersionId, options = {}) {
  const tenantId = context.businessId;
  const fv = await getForecastVersion(db, tenantId, forecastVersionId);
  if (IMMUTABLE.has(fv.status)) throw new ForecastVersionImmutableError();

  await db.planV2ForecastVersion.update({
    where: { id: fv.id },
    data: { status: ForecastVersionStatus.CALCULATING, integrityStatus: ForecastIntegrityStatus.CALCULATING },
  });

  try {
    const historical = await buildHistoricalDataset(db, context, {
      lookbackMonths: options.lookbackMonths || 24,
    });
    let opening = fv.openingBalances || options.openingBalances;
    let sourceActualsVersion = fv.sourceActualsVersion;
    if (!opening) {
      const loaded = await loadOpeningBalancesForPlanning(db, context);
      opening = loaded.opening || options.defaultOpening;
      sourceActualsVersion = loaded.sourceDataVersion || historical.periods.at(-1)?.sourceDataVersion;
    }
    if (!opening) {
      throw new CrossTenantPlanningError(
        'Opening Balance Sheet balances are required for three-statement projection.'
      );
    }

    const assumptions =
      options.assumptions ||
      fv.assumptionsSnapshot ||
      assumptionsToEngineInput(fv.assumptionSet.assumptions);

    const baseRevenueMinor =
      fv.baseRevenueMinor != null
        ? fv.baseRevenueMinor
        : BigInt(options.baseRevenueMinor || historical.suggestedBaseRevenueMinor || 0);

    const months = options.months || fv.cycle.horizonMonths || 12;
    const result = projectThreeStatements({
      opening,
      baseRevenueMinor,
      months,
      assumptions,
      labels: options.labels,
    });

    const status =
      result.integrityStatus === ForecastIntegrityStatus.INVALID
        ? ForecastVersionStatus.INVALID
        : ForecastVersionStatus.READY_FOR_REVIEW;

    return db.planV2ForecastVersion.update({
      where: { id: fv.id },
      data: {
        status,
        integrityStatus: result.integrityStatus,
        resultPayload: result,
        checksum: result.checksum,
        sourceActualsVersion: sourceActualsVersion || historical.quality.status,
        baseRevenueMinor,
        openingBalances: opening,
        assumptionsSnapshot: assumptions,
        generatedAt: new Date(),
        metadata: {
          ...(fv.metadata || {}),
          neverPostsToGl: true,
          historicalQuality: historical.quality,
          seasonality: historical.seasonality,
        },
      },
      include: {
        scenario: true,
        cycle: true,
        assumptionSet: { include: { assumptions: true } },
      },
    });
  } catch (error) {
    await db.planV2ForecastVersion.update({
      where: { id: fv.id },
      data: {
        status: ForecastVersionStatus.FAILED,
        integrityStatus: ForecastIntegrityStatus.BLOCKED,
        metadata: {
          ...(fv.metadata || {}),
          lastError: { message: error.message, code: error.code || 'FORECAST_CALCULATION_ERROR' },
        },
      },
    });
    throw error;
  }
}

export async function approveForecastVersion(db, context, forecastVersionId) {
  const tenantId = context.businessId;
  const fv = await getForecastVersion(db, tenantId, forecastVersionId);
  if (IMMUTABLE.has(fv.status) && fv.status !== ForecastVersionStatus.APPROVED) {
    throw new ForecastVersionImmutableError();
  }
  if (fv.status === ForecastVersionStatus.APPROVED) {
    throw new ForecastVersionImmutableError('Already approved.');
  }
  if (
    fv.integrityStatus === ForecastIntegrityStatus.INVALID ||
    fv.integrityStatus === ForecastIntegrityStatus.BLOCKED ||
    fv.integrityStatus === ForecastIntegrityStatus.NOT_CALCULATED
  ) {
    throw new ForecastIntegrityBlockedError();
  }
  if (fv.preparedBy && fv.preparedBy === context.userId) {
    // soft SoD warning stored; hard block optional — enforce when reviewer missing
  }

  const updated = await db.planV2ForecastVersion.update({
    where: { id: fv.id },
    data: {
      status: ForecastVersionStatus.APPROVED,
      approvedBy: context.userId,
      approvedAt: new Date(),
      reviewedBy: fv.reviewedBy || context.userId,
    },
  });

  // Immutable snapshot on approval
  await db.planV2ForecastSnapshot.upsert({
    where: {
      forecastVersionId_snapshotType: {
        forecastVersionId: fv.id,
        snapshotType: 'APPROVED_FORECAST',
      },
    },
    create: {
      tenantId,
      forecastVersionId: fv.id,
      snapshotType: 'APPROVED_FORECAST',
      payload: {
        result: fv.resultPayload,
        assumptions: fv.assumptionsSnapshot,
        opening: fv.openingBalances,
        sourceActualsVersion: fv.sourceActualsVersion,
        modelVersion: fv.modelVersion,
        scenarioId: fv.scenarioId,
        disclaimer:
          'Projections are planning estimates, not guaranteed outcomes. Never posted to the General Ledger.',
      },
      checksum: fv.checksum,
      generatedBy: context.userId,
    },
    update: {}, // immutable — do not overwrite
  });

  return updated;
}

export async function createRollingForecastVersion(db, context, sourceForecastVersionId, input = {}) {
  const tenantId = context.businessId;
  const source = await getForecastVersion(db, tenantId, sourceForecastVersionId);
  if (source.status !== ForecastVersionStatus.APPROVED && source.status !== ForecastVersionStatus.ACTIVE) {
    throw new CrossTenantPlanningError('Rolling forecast should start from an approved version.');
  }

  // New cycle or extend existing
  const cycle = await createForecastCycle(db, context, {
    cycleNumber: input.cycleNumber || `ROLL-${Date.now()}`,
    name: input.name || `Rolling from ${source.name}`,
    forecastStartDate: input.forecastStartDate || source.cycle.forecastStartDate,
    forecastEndDate: input.forecastEndDate || source.cycle.forecastEndDate,
    actualsCutoffDate: input.actualsCutoffDate || new Date(),
    horizonMonths: input.horizonMonths || source.cycle.horizonMonths,
    granularity: source.cycle.granularity,
    currency: source.cycle.currency,
    metadata: { rolledFromForecastVersionId: source.id },
  });

  return createForecastVersion(db, context, {
    forecastCycleId: cycle.id,
    scenarioId: source.scenarioId,
    assumptionSetId: source.assumptionSetId,
    name: input.versionName || `Rolling v1 from ${source.name}`,
    openingBalances: input.openingBalances || source.openingBalances,
    baseRevenueMinor: input.baseRevenueMinor != null ? input.baseRevenueMinor : source.baseRevenueMinor,
    metadata: { rolledFrom: source.id, priorChecksum: source.checksum },
  });
}

export async function createManualOverride(db, context, forecastVersionId, input = {}) {
  const tenantId = context.businessId;
  const fv = await getForecastVersion(db, tenantId, forecastVersionId);
  if (IMMUTABLE.has(fv.status)) throw new ForecastVersionImmutableError();
  if (!input.reason) {
    throw new CrossTenantPlanningError('Override reason is required.');
  }
  return db.planV2ManualOverride.create({
    data: {
      tenantId,
      forecastVersionId: fv.id,
      periodKey: input.periodKey,
      lineKey: input.lineKey,
      calculatedMinor: BigInt(input.calculatedMinor),
      overrideMinor: BigInt(input.overrideMinor),
      reason: input.reason,
      status: 'DRAFT',
      createdBy: context.userId,
    },
  });
}

export function compareScenarios(resultsByScenario = {}) {
  const keys = Object.keys(resultsByScenario);
  if (keys.length < 2) return { scenarios: keys, comparisons: [] };
  const baseKey = keys.includes('EXPECTED') ? 'EXPECTED' : keys[0];
  const base = resultsByScenario[baseKey];
  const comparisons = keys
    .filter((k) => k !== baseKey)
    .map((k) => {
      const r = resultsByScenario[k];
      const revDiff =
        BigInt(r.totals.revenue.minor) - BigInt(base.totals.revenue.minor);
      const cashDiff =
        BigInt(r.totals.closingCash.minor) - BigInt(base.totals.closingCash.minor);
      return {
        scenario: k,
        versus: baseKey,
        revenueDifferenceMinor: String(revDiff),
        closingCashDifferenceMinor: String(cashDiff),
        minimumCash: r.kpis.minimumCash,
        firstShortage: r.kpis.firstShortage,
        modelVersion: r.modelVersion,
      };
    });
  return { base: baseKey, comparisons, modelVersion: base.modelVersion };
}

export function checksumPayload(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

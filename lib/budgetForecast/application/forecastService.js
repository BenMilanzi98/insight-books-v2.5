import prisma from '@/lib/prisma';
import {
  FORECAST_STATUS,
  assertForecastTransition,
  canEditForecast,
} from '../domain/forecastStates.js';
import { toMinor, applyGrowthMinor, minorToNumber } from '../domain/money.js';
import { buildMonthlyPeriods, parsePeriodKey, spreadEvenly } from '../domain/periods.js';
import { resolveBudgetActuals } from './budgetActualsService.js';
import { serializeForecast } from './serialize.js';

const CALC_VERSION = '1.0.0';

function serviceError(message, status = 400, code = 'FORECAST_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function assertTenantForecast(forecast, tenantId) {
  if (!forecast || forecast.tenantId !== tenantId) {
    throw serviceError('Forecast not found', 404, 'FORECAST_NOT_FOUND');
  }
}

async function loadForecast(tenantId, id, db = prisma) {
  const forecast = await db.forecast.findFirst({
    where: { id, tenantId },
    include: {
      lines: {
        include: { periodAmounts: { orderBy: { periodStart: 'asc' } } },
        orderBy: { accountCodeSnapshot: 'asc' },
      },
      assumptionSet: { include: { assumptions: true } },
    },
  });
  assertTenantForecast(forecast, tenantId);
  return forecast;
}

export async function listForecasts(tenantId, { status, take = 50 } = {}) {
  const where = { tenantId, businessId: tenantId };
  if (status) where.status = String(status).toUpperCase();
  const rows = await prisma.forecast.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take,
    include: { lines: { select: { id: true, projectedAmountMinor: true } } },
  });
  return rows.map(serializeForecast);
}

export async function getForecast(tenantId, id) {
  return serializeForecast(await loadForecast(tenantId, id));
}

export async function createForecast(tenantId, userId, input = {}) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (!(startDate < endDate)) throw serviceError('startDate must be before endDate');

  const forecast = await prisma.forecast.create({
    data: {
      tenantId,
      businessId: tenantId,
      name: String(input.name || 'Untitled Forecast').trim(),
      description: input.description || null,
      forecastType: input.forecastType || 'ROLLING',
      scenarioType: input.scenarioType || 'BASE_CASE',
      startDate,
      endDate,
      cutoffDate: input.cutoffDate ? new Date(input.cutoffDate) : null,
      currency: input.currency || 'MWK',
      sourceBudgetId: input.sourceBudgetId || null,
      sourceBudgetVersionId: input.sourceBudgetVersionId || null,
      status: FORECAST_STATUS.DRAFT,
      calculationVersion: CALC_VERSION,
      branchId: input.branchId || null,
      departmentId: input.departmentId || null,
      projectId: input.projectId || null,
      costCentreId: input.costCentreId || null,
      assumptionSetId: input.assumptionSetId || null,
      createdById: userId || null,
      notes: input.notes || null,
    },
  });
  return getForecast(tenantId, forecast.id);
}

async function resolveAccounts(tenantId, accountIds) {
  const unique = [...new Set(accountIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const accounts = await prisma.account.findMany({
    where: { tenantId, id: { in: unique }, mergedIntoAccountId: null },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      coaV2Category: true,
    },
  });
  if (accounts.length !== unique.length) {
    throw serviceError('One or more accounts are invalid for this tenant', 400, 'INVALID_ACCOUNT');
  }
  return new Map(accounts.map((a) => [a.id, a]));
}

/** Replace forecast lines. Never creates journals. */
export async function saveForecastLines(tenantId, forecastId, linesInput = []) {
  const forecast = await loadForecast(tenantId, forecastId);
  // GENERATING is allowed so regenerate can persist lines without an illegal GENERATING→DRAFT hop.
  if (!canEditForecast(forecast.status) && forecast.status !== FORECAST_STATUS.GENERATING) {
    throw serviceError('Forecast is not editable in its current status', 409, 'FORECAST_LOCKED');
  }
  const accounts = await resolveAccounts(
    tenantId,
    linesInput.map((l) => l.accountId)
  );

  await prisma.$transaction(async (tx) => {
    await tx.forecastLine.deleteMany({ where: { forecastId } });
    for (const row of linesInput) {
      const acc = accounts.get(row.accountId);
      if (!acc) continue;
      const projected =
        row.projectedAmountMinor != null
          ? Number(row.projectedAmountMinor)
          : toMinor(row.projectedAmount ?? 0);
      const historical =
        row.historicalActualMinor != null
          ? Number(row.historicalActualMinor)
          : toMinor(row.historicalActual ?? 0);
      const budgetAmt =
        row.budgetAmountMinor != null
          ? Number(row.budgetAmountMinor)
          : toMinor(row.budgetAmount ?? 0);

      const periodCreates = [];
      for (const p of row.periods || []) {
        const meta = p.key ? parsePeriodKey(p.key) : null;
        periodCreates.push({
          periodStart: meta?.periodStart || new Date(p.periodStart || forecast.startDate),
          periodEnd: meta?.periodEnd || new Date(p.periodEnd || forecast.endDate),
          actualAmountMinor: p.actualAmountMinor != null ? Number(p.actualAmountMinor) : toMinor(p.actualAmount ?? 0),
          budgetAmountMinor: p.budgetAmountMinor != null ? Number(p.budgetAmountMinor) : toMinor(p.budgetAmount ?? 0),
          forecastAmountMinor:
            p.forecastAmountMinor != null ? Number(p.forecastAmountMinor) : toMinor(p.forecastAmount ?? p.amount ?? 0),
          sourceType: p.sourceType || 'FORECAST',
          calculationVersion: CALC_VERSION,
          assumptionReference: p.assumptionReference || null,
        });
      }

      await tx.forecastLine.create({
        data: {
          forecastId,
          accountId: acc.id,
          accountCodeSnapshot: acc.accountCode || '',
          accountNameSnapshot: acc.accountName || '',
          accountTypeSnapshot: acc.accountType || null,
          forecastMethod: row.forecastMethod || 'MANUAL',
          historicalActualMinor: historical,
          budgetAmountMinor: budgetAmt,
          projectedAmountMinor: projected,
          confidenceLevel: row.confidenceLevel || null,
          growthRate: row.growthRate ?? null,
          seasonalityFactor: row.seasonalityFactor ?? null,
          recurringAmountMinor:
            row.recurringAmountMinor != null
              ? Number(row.recurringAmountMinor)
              : row.recurringAmount != null
                ? toMinor(row.recurringAmount)
                : null,
          notes: row.notes || null,
          periodAmounts: periodCreates.length ? { create: periodCreates } : undefined,
        },
      });
    }
  });

  return getForecast(tenantId, forecastId);
}

async function runGenerationIntoForecast(tenantId, forecast, input = {}) {
  const method = String(input.method || 'CURRENT_RUN_RATE').toUpperCase();
  const startDate = new Date(input.startDate || forecast.startDate);
  const endDate = new Date(input.endDate || forecast.endDate);
  if (!(startDate < endDate)) throw serviceError('startDate must be before endDate');

  const growthPercent = Number(input.growthPercent || 0);
  const scenarioType = input.scenarioType || forecast.scenarioType || 'BASE_CASE';
  const scenarioFactor =
    scenarioType === 'BEST_CASE' ? 1.1 : scenarioType === 'WORST_CASE' ? 0.9 : 1;

  assertForecastTransition(forecast.status, FORECAST_STATUS.GENERATING);
  await prisma.forecast.update({
    where: { id: forecast.id },
    data: { status: FORECAST_STATUS.GENERATING },
  });

  try {
    const actualsStart = new Date(input.actualsStart || startDate);
    const actualsEnd = new Date(input.actualsEnd || endDate);
    const actuals = await resolveBudgetActuals({
      tenantId,
      startDate: actualsStart,
      endDate: actualsEnd,
      branchId: input.branchId || forecast.branchId || null,
    });

    let budgetByAccount = new Map();
    const sourceBudgetId = input.sourceBudgetId || forecast.sourceBudgetId;
    if (sourceBudgetId) {
      const budget = await prisma.budget.findFirst({
        where: { id: sourceBudgetId, tenantId },
        include: { lines: { include: { periodAmounts: true } } },
      });
      if (budget) {
        for (const line of budget.lines) {
          budgetByAccount.set(line.accountId, minorToNumber(line.annualAmountMinor));
        }
      }
    }

    const periods = buildMonthlyPeriods(startDate, endDate);
    const linesInput = [];

    for (const a of actuals.accounts) {
      const historical = minorToNumber(a.actualMinor);
      const budgetAmt = budgetByAccount.get(a.accountId) || 0;
      let projected = historical;
      if (method === 'BUDGET_REMAINDER') {
        projected = Math.max(0, budgetAmt - historical);
      } else if (method === 'HISTORICAL_AVERAGE' || method === 'CURRENT_RUN_RATE') {
        const months = Math.max(1, buildMonthlyPeriods(actualsStart, actualsEnd).length);
        projected = Math.round((historical / months) * periods.length);
      }
      projected = Math.round(applyGrowthMinor(projected, growthPercent) * scenarioFactor);
      const spread = spreadEvenly(projected, periods.length);
      linesInput.push({
        accountId: a.accountId,
        forecastMethod: method,
        historicalActualMinor: historical,
        budgetAmountMinor: budgetAmt,
        projectedAmountMinor: projected,
        growthRate: growthPercent || null,
        periods: periods.map((p, i) => ({
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          actualAmountMinor: 0,
          budgetAmountMinor: Math.round(budgetAmt / Math.max(1, periods.length)),
          forecastAmountMinor: spread[i],
          sourceType: 'FORECAST',
        })),
      });
    }

    await saveForecastLines(tenantId, forecast.id, linesInput);
    assertForecastTransition(FORECAST_STATUS.GENERATING, FORECAST_STATUS.GENERATED);
    await prisma.forecast.update({
      where: { id: forecast.id },
      data: {
        status: FORECAST_STATUS.GENERATED,
        calculationVersion: CALC_VERSION,
        startDate,
        endDate,
        scenarioType,
        cutoffDate: input.cutoffDate ? new Date(input.cutoffDate) : forecast.cutoffDate,
      },
    });
    return getForecast(tenantId, forecast.id);
  } catch (e) {
    await prisma.forecast.update({
      where: { id: forecast.id },
      data: { status: FORECAST_STATUS.FAILED, notes: e?.message || 'Generation failed' },
    });
    throw e;
  }
}

/** Create a new forecast and generate into it. */
export async function generateForecast(tenantId, userId, input = {}) {
  const forecast = await createForecast(tenantId, userId, {
    ...input,
    forecastType: input.forecastType || 'ROLLING',
    scenarioType: input.scenarioType || 'BASE_CASE',
  });
  const loaded = await loadForecast(tenantId, forecast.id);
  return runGenerationIntoForecast(tenantId, loaded, input);
}

/**
 * Regenerate an existing forecast by id.
 * Fixes actions route that previously passed forecastId as create input.
 */
export async function regenerateForecast(tenantId, userId, forecastId, options = {}) {
  const forecast = await loadForecast(tenantId, forecastId);
  const regenerable = new Set([
    FORECAST_STATUS.DRAFT,
    FORECAST_STATUS.GENERATED,
    FORECAST_STATUS.FAILED,
    FORECAST_STATUS.MANUAL_REVIEW,
  ]);
  if (!regenerable.has(forecast.status)) {
    throw serviceError('Forecast cannot be regenerated in its current status', 409, 'FORECAST_LOCKED');
  }
  // Normalize to DRAFT so GENERATING transition is legal from a known state.
  if (forecast.status !== FORECAST_STATUS.DRAFT) {
    if (forecast.status === FORECAST_STATUS.GENERATED) {
      // GENERATED → DRAFT is allowed for regeneration
      assertForecastTransition(FORECAST_STATUS.GENERATED, FORECAST_STATUS.DRAFT);
    } else if (forecast.status === FORECAST_STATUS.FAILED) {
      assertForecastTransition(FORECAST_STATUS.FAILED, FORECAST_STATUS.DRAFT);
    } else if (forecast.status === FORECAST_STATUS.MANUAL_REVIEW) {
      assertForecastTransition(FORECAST_STATUS.MANUAL_REVIEW, FORECAST_STATUS.DRAFT);
    }
    await prisma.forecast.update({
      where: { id: forecastId },
      data: { status: FORECAST_STATUS.DRAFT },
    });
    forecast.status = FORECAST_STATUS.DRAFT;
  }
  return runGenerationIntoForecast(tenantId, forecast, options);
}

export async function generateRollingForecast(tenantId, userId, input = {}) {
  return generateForecast(tenantId, userId, {
    ...input,
    forecastType: 'ROLLING',
    method: input.method || 'CURRENT_RUN_RATE',
  });
}

export async function generateCashFlowForecast(tenantId, userId, input = {}) {
  const forecast = await generateForecast(tenantId, userId, {
    ...input,
    forecastType: 'CASH_FLOW',
    method: 'CURRENT_RUN_RATE',
    name: input.name || 'Cash flow forecast',
  });
  // Opening cash is reported separately by reportService; this never posts.
  return { ...forecast, cashFlowNote: 'Opening cash resolved from GL cash/bank accounts at report time.' };
}

export async function generateScenarioForecasts(tenantId, userId, input = {}) {
  const base = await generateForecast(tenantId, userId, {
    ...input,
    scenarioType: 'BASE_CASE',
    name: input.name ? `${input.name} (Base)` : 'Base-case forecast',
  });
  const best = await generateForecast(tenantId, userId, {
    ...input,
    scenarioType: 'BEST_CASE',
    growthPercent: Number(input.growthPercent || 0),
    name: input.name ? `${input.name} (Best)` : 'Best-case forecast',
  });
  const worst = await generateForecast(tenantId, userId, {
    ...input,
    scenarioType: 'WORST_CASE',
    growthPercent: Number(input.growthPercent || 0),
    name: input.name ? `${input.name} (Worst)` : 'Worst-case forecast',
  });
  return { base, best, worst };
}

async function transitionForecast(tenantId, forecastId, userId, toStatus, extra = {}) {
  const forecast = await loadForecast(tenantId, forecastId);
  assertForecastTransition(forecast.status, toStatus);
  const data = { status: toStatus, ...extra };
  if (toStatus === FORECAST_STATUS.APPROVED) {
    data.approvedById = userId;
    data.approvedAt = new Date();
  }
  if (toStatus === FORECAST_STATUS.LOCKED) {
    data.lockedAt = new Date();
  }
  await prisma.forecast.update({ where: { id: forecastId }, data });
  return getForecast(tenantId, forecastId);
}

/** Action-route signature: (tenantId, userId, forecastId, body?) */
export const submitForecastForReview = (tenantId, userId, forecastId) =>
  transitionForecast(tenantId, forecastId, userId, FORECAST_STATUS.IN_REVIEW);
export const approveForecast = (tenantId, userId, forecastId) =>
  transitionForecast(tenantId, forecastId, userId, FORECAST_STATUS.APPROVED);
export const activateForecast = (tenantId, userId, forecastId) =>
  transitionForecast(tenantId, forecastId, userId, FORECAST_STATUS.ACTIVE);
export const lockForecast = (tenantId, userId, forecastId) =>
  transitionForecast(tenantId, forecastId, userId, FORECAST_STATUS.LOCKED);
export const unlockForecast = (tenantId, userId, forecastId) =>
  transitionForecast(tenantId, forecastId, userId, FORECAST_STATUS.ACTIVE, { lockedAt: null });
export const archiveForecast = (tenantId, userId, forecastId) =>
  transitionForecast(tenantId, forecastId, userId, FORECAST_STATUS.ARCHIVED);

/** Alias used by HTTP routes */
export const createScenarioForecasts = generateScenarioForecasts;

export async function getForecastDashboard(tenantId) {
  const forecasts = await listForecasts(tenantId, { take: 50 });
  const countsByStatus = {};
  for (const f of forecasts) {
    const key = f.status || 'UNKNOWN';
    countsByStatus[key] = (countsByStatus[key] || 0) + 1;
  }
  return {
    total: forecasts.length,
    countsByStatus,
    recent: forecasts.slice(0, 10),
  };
}

export async function deleteForecast(tenantId, id) {
  const forecast = await loadForecast(tenantId, id);
  if (
    forecast.status === FORECAST_STATUS.LOCKED ||
    forecast.status === FORECAST_STATUS.ACTIVE ||
    forecast.status === FORECAST_STATUS.APPROVED
  ) {
    throw serviceError(
      'Cannot delete approved, active, or locked forecasts — archive instead',
      409,
      'FORECAST_LOCKED'
    );
  }
  await prisma.forecast.delete({ where: { id, tenantId } });
  return { id, deleted: true };
}


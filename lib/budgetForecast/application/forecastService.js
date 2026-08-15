import prisma from '@/lib/prisma';
import {
  FORECAST_STATUS,
  assertForecastTransition,
  canEditForecast,
} from '../domain/forecastStates.js';
import { toMinor, minorToNumber } from '../domain/money.js';
import { buildMonthlyPeriods, parsePeriodKey, spreadEvenly } from '../domain/periods.js';
import {
  projectForecastAmount,
  scenarioFactorFor,
  FORECAST_METHODS,
} from '../domain/forecastProjection.js';
import {
  applyAssumptionsToAmount,
  growthPercentFromAssumptions,
} from '../domain/assumptionApply.js';
import {
  rollForwardCash,
  buildCashMonthsFromLines,
} from '../domain/cashRollForward.js';
import { scheduleOpenBalancesByMonth, totalScheduled } from '../domain/arApSchedule.js';
import { buildForecastAlerts } from '../domain/forecastAlerts.js';
import { classifyAccountKind } from '../domain/variance.js';
import { resolveBudgetActuals } from './budgetActualsService.js';
import {
  loadOpenReceivablesBuckets,
  loadOpenPayablesBuckets,
} from './openBalancesService.js';
import { buildInventoryDemandLines } from './productDemandService.js';
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

async function findControlAccount(tenantId, { forReceivables }) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, mergedIntoAccountId: null, acceptsNewTransactions: true },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      coaV2Category: true,
    },
    take: 500,
  });
  const needle = forReceivables
    ? [/receivable/i, /accounts receivable/i, /trade debtors/i]
    : [/payable/i, /accounts payable/i, /trade creditors/i];
  for (const re of needle) {
    const hit = accounts.find(
      (a) => re.test(a.accountName || '') || re.test(a.accountCode || '')
    );
    if (hit) return hit;
  }
  // Fallback: first asset (AR) or liability (AP)
  if (forReceivables) {
    return accounts.find((a) => /asset|receivable/i.test(`${a.accountType} ${a.coaV2Category}`)) || accounts[0];
  }
  return (
    accounts.find((a) => /liabilit|payable/i.test(`${a.accountType} ${a.coaV2Category}`)) ||
    accounts[0]
  );
}

async function resolveOpeningCashMinor(tenantId, { asOf, branchId }) {
  const summary = await resolveBudgetActuals({
    tenantId,
    endDate: asOf,
    branchId: branchId || null,
  });
  let opening = 0;
  for (const a of summary.accounts || []) {
    const name = `${a.accountName || ''} ${a.accountCode || ''}`.toLowerCase();
    const type = String(a.accountType || '').toLowerCase();
    if (type.includes('asset') && (name.includes('cash') || name.includes('bank'))) {
      opening += minorToNumber(a.actualMinor);
    }
  }
  return opening;
}

async function runGenerationIntoForecast(tenantId, forecast, input = {}) {
  const method = String(input.method || FORECAST_METHODS.CURRENT_RUN_RATE).toUpperCase();
  const startDate = new Date(input.startDate || forecast.startDate);
  const endDate = new Date(input.endDate || forecast.endDate);
  if (!(startDate < endDate)) throw serviceError('startDate must be before endDate');

  let growthPercent = Number(input.growthPercent || 0);
  const scenarioType = input.scenarioType || forecast.scenarioType || 'BASE_CASE';
  const scenarioFactor = scenarioFactorFor(scenarioType);
  const recurringAmountMinor =
    input.recurringAmountMinor != null
      ? Number(input.recurringAmountMinor)
      : input.recurringAmount != null
        ? toMinor(input.recurringAmount)
        : null;

  const sourceBudgetId = input.sourceBudgetId || forecast.sourceBudgetId || null;
  const assumptionSetId = input.assumptionSetId || forecast.assumptionSetId || null;
  if (method === FORECAST_METHODS.BUDGET_REMAINDER && !sourceBudgetId) {
    throw serviceError(
      'BUDGET_REMAINDER requires a source budget',
      400,
      'SOURCE_BUDGET_REQUIRED'
    );
  }

  let assumptions = [];
  if (assumptionSetId) {
    const set = await prisma.forecastAssumptionSet.findFirst({
      where: { id: assumptionSetId, tenantId },
      include: { assumptions: true },
    });
    assumptions = set?.assumptions || [];
    growthPercent += growthPercentFromAssumptions(assumptions);
  }

  assertForecastTransition(forecast.status, FORECAST_STATUS.GENERATING);
  await prisma.forecast.update({
    where: { id: forecast.id },
    data: {
      status: FORECAST_STATUS.GENERATING,
      sourceBudgetId: sourceBudgetId || forecast.sourceBudgetId,
      departmentId: input.departmentId || forecast.departmentId,
      assumptionSetId: assumptionSetId || forecast.assumptionSetId,
    },
  });

  try {
    const actualsStart = new Date(input.actualsStart || startDate);
    const actualsEnd = new Date(input.actualsEnd || endDate);
    const periods = buildMonthlyPeriods(startDate, endDate);
    const linesInput = [];

    if (method === FORECAST_METHODS.INVENTORY_DEMAND) {
      const { lines: demandLines } = await buildInventoryDemandLines(tenantId, {
        periodsCount: periods.length,
        lookbackMonths: Number(input.lookbackMonths || 6),
      });
      if (!demandLines.length) {
        throw serviceError(
          'No inventory demand lines — products need COGS/inventory accounts and sales history',
          400,
          'NO_INVENTORY_DEMAND'
        );
      }
      for (const dl of demandLines) {
        let projected = projectForecastAmount({
          method,
          openScheduledTotal: dl.projectedAmountMinor,
          periodsCount: periods.length,
          growthPercent,
          scenarioFactor,
        });
        projected = applyAssumptionsToAmount(projected, assumptions, { accountId: dl.accountId });
        const spread =
          projected === dl.projectedAmountMinor
            ? dl.periods
            : spreadEvenly(projected, periods.length);
        linesInput.push({
          accountId: dl.accountId,
          forecastMethod: method,
          historicalActualMinor: 0,
          budgetAmountMinor: 0,
          projectedAmountMinor: projected,
          growthRate: growthPercent || null,
          periods: periods.map((p, i) => ({
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
            actualAmountMinor: 0,
            budgetAmountMinor: 0,
            forecastAmountMinor: spread[i],
            sourceType: 'INVENTORY_DEMAND',
          })),
        });
      }
    } else if (method === FORECAST_METHODS.OPEN_RECEIVABLES || method === FORECAST_METHODS.OPEN_PAYABLES) {
      const isAr = method === FORECAST_METHODS.OPEN_RECEIVABLES;
      const buckets = isAr
        ? await loadOpenReceivablesBuckets(tenantId, {
            asOfDate: startDate,
            branchId: input.branchId || forecast.branchId || null,
          })
        : await loadOpenPayablesBuckets(tenantId, { asOfDate: startDate });
      const schedule = scheduleOpenBalancesByMonth(buckets, periods.length);
      const control = await findControlAccount(tenantId, { forReceivables: isAr });
      if (!control?.id) {
        throw serviceError('No suitable CoA account for open AR/AP schedule', 400, 'NO_CONTROL_ACCOUNT');
      }
      let projected = projectForecastAmount({
        method,
        openScheduledTotal: totalScheduled(schedule),
        periodsCount: periods.length,
        growthPercent,
        scenarioFactor,
      });
      projected = applyAssumptionsToAmount(projected, assumptions, { accountId: control.id });
      const spread =
        projected === totalScheduled(schedule)
          ? schedule
          : spreadEvenly(projected, periods.length);
      linesInput.push({
        accountId: control.id,
        forecastMethod: method,
        historicalActualMinor: totalScheduled(schedule),
        budgetAmountMinor: 0,
        projectedAmountMinor: projected,
        growthRate: growthPercent || null,
        periods: periods.map((p, i) => ({
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          actualAmountMinor: 0,
          budgetAmountMinor: 0,
          forecastAmountMinor: spread[i],
          sourceType: isAr ? 'OPEN_RECEIVABLES' : 'OPEN_PAYABLES',
        })),
      });
    } else {
      const actuals = await resolveBudgetActuals({
        tenantId,
        startDate: actualsStart,
        endDate: actualsEnd,
        branchId: input.branchId || forecast.branchId || null,
      });

      let budgetByAccount = new Map();
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

      const actualsMonths = Math.max(1, buildMonthlyPeriods(actualsStart, actualsEnd).length);
      const historicalByAccount = new Map(
        (actuals.accounts || []).map((a) => [a.accountId, minorToNumber(a.actualMinor)])
      );

      const accountIds = new Set([...historicalByAccount.keys(), ...budgetByAccount.keys()]);
      if (!accountIds.size && method !== FORECAST_METHODS.MANUAL) {
        throw serviceError(
          'No accounts found in actuals or source budget for this period',
          400,
          'NO_FORECAST_ACCOUNTS'
        );
      }

      for (const accountId of accountIds) {
        const historical = historicalByAccount.get(accountId) || 0;
        const budgetAmt = budgetByAccount.get(accountId) || 0;
        let projected = projectForecastAmount({
          method,
          historical,
          budgetAmt,
          periodsCount: periods.length,
          actualsMonths,
          growthPercent,
          scenarioFactor,
          recurringAmount: recurringAmountMinor,
        });
        projected = applyAssumptionsToAmount(projected, assumptions, { accountId });
        const spread = spreadEvenly(projected, periods.length);
        linesInput.push({
          accountId,
          forecastMethod: method,
          historicalActualMinor: historical,
          budgetAmountMinor: budgetAmt,
          projectedAmountMinor: projected,
          growthRate: growthPercent || null,
          recurringAmountMinor:
            method === FORECAST_METHODS.RECURRING ? recurringAmountMinor : null,
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
    }

    await saveForecastLines(tenantId, forecast.id, linesInput);

    // Cash outlook months (always compute; useful for CASH_FLOW and alerts)
    const openingCashMinor = await resolveOpeningCashMinor(tenantId, {
      asOf: startDate,
      branchId: input.branchId || forecast.branchId || null,
    });

    const accMap = await resolveAccounts(
      tenantId,
      linesInput.map((l) => l.accountId)
    );
    const classifiedLines = linesInput.map((l) => {
      const acc = accMap.get(l.accountId);
      return {
        accountTypeSnapshot: acc?.accountType,
        accountCategorySnapshot: acc?.coaV2Category,
        periodAmounts: (l.periods || []).map((p, i) => ({
          key: periods[i]?.key,
          periodStart: p.periodStart,
          forecastAmountMinor: p.forecastAmountMinor,
        })),
      };
    });
    // OPEN_RECEIVABLES → receipts; OPEN_PAYABLES → payments
    let cashSourceMonths;
    if (method === FORECAST_METHODS.OPEN_RECEIVABLES) {
      cashSourceMonths = periods.map((p, i) => ({
        key: p.key,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        expectedReceipts: linesInput[0]?.periods?.[i]?.forecastAmountMinor || 0,
        expectedPayments: 0,
      }));
    } else if (method === FORECAST_METHODS.OPEN_PAYABLES) {
      cashSourceMonths = periods.map((p, i) => ({
        key: p.key,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        expectedReceipts: 0,
        expectedPayments: linesInput[0]?.periods?.[i]?.forecastAmountMinor || 0,
      }));
    } else {
      cashSourceMonths = buildCashMonthsFromLines(classifiedLines, periods, classifyAccountKind);
    }
    const cashMonths = rollForwardCash({
      openingCash: openingCashMinor,
      months: cashSourceMonths,
    });

    const notesPayload = {
      cashFlow: {
        openingCashMinor,
        months: cashMonths.map((m) => ({
          ...m,
          openingCash: m.openingCash / 100,
          expectedReceipts: m.expectedReceipts / 100,
          expectedPayments: m.expectedPayments / 100,
          closingCash: m.closingCash / 100,
        })),
        generatedAt: new Date().toISOString(),
      },
    };

    assertForecastTransition(FORECAST_STATUS.GENERATING, FORECAST_STATUS.GENERATED);
    await prisma.forecast.update({
      where: { id: forecast.id },
      data: {
        status: FORECAST_STATUS.GENERATED,
        calculationVersion: CALC_VERSION,
        startDate,
        endDate,
        scenarioType,
        sourceBudgetId: sourceBudgetId || null,
        assumptionSetId: assumptionSetId || null,
        cutoffDate: input.cutoffDate ? new Date(input.cutoffDate) : forecast.cutoffDate,
        notes: JSON.stringify(notesPayload),
      },
    });
    const result = await getForecast(tenantId, forecast.id);
    return { ...result, cashFlow: notesPayload.cashFlow };
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
    method: input.method || FORECAST_METHODS.CURRENT_RUN_RATE,
    name: input.name || 'Cash flow forecast',
  });
  return forecast;
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

  const primary =
    forecasts.find((f) => f.status === FORECAST_STATUS.ACTIVE) ||
    forecasts.find((f) => f.status === FORECAST_STATUS.APPROVED) ||
    forecasts.find((f) => f.status === FORECAST_STATUS.GENERATED) ||
    forecasts[0] ||
    null;

  let forecastRevenue = 0;
  let forecastExpense = 0;
  let budgetRevenue = 0;
  let budgetExpense = 0;
  let cashMonths = [];
  let method = null;
  let sourceBudgetId = null;

  if (primary?.id) {
    const full = await loadForecast(tenantId, primary.id);
    method = full.lines?.[0]?.forecastMethod || null;
    sourceBudgetId = full.sourceBudgetId || null;
    for (const line of full.lines || []) {
      const amt = minorToNumber(line.projectedAmountMinor);
      const kind = classifyAccountKind(line.accountTypeSnapshot, null);
      if (kind === 'REVENUE' || kind === 'OTHER_INCOME') forecastRevenue += amt;
      else if (kind === 'EXPENSE' || kind === 'COST_OF_SALES' || kind === 'OTHER_EXPENSE') {
        forecastExpense += amt;
      }
      const bAmt = minorToNumber(line.budgetAmountMinor);
      if (kind === 'REVENUE' || kind === 'OTHER_INCOME') budgetRevenue += bAmt;
      else if (kind === 'EXPENSE' || kind === 'COST_OF_SALES' || kind === 'OTHER_EXPENSE') {
        budgetExpense += bAmt;
      }
    }
    try {
      const parsed = full.notes ? JSON.parse(full.notes) : null;
      cashMonths = parsed?.cashFlow?.months || [];
    } catch {
      cashMonths = [];
    }
  }

  const alerts = buildForecastAlerts({
    cashMonths,
    forecastRevenueMinor: forecastRevenue,
    forecastExpenseMinor: forecastExpense,
    budgetRevenueMinor: budgetRevenue,
    budgetExpenseMinor: budgetExpense,
    method,
    sourceBudgetId,
  });

  return {
    total: forecasts.length,
    countsByStatus,
    recent: forecasts.slice(0, 10),
    primaryForecastId: primary?.id || null,
    alerts,
    cards: {
      forecastRevenue: forecastRevenue / 100,
      forecastExpense: forecastExpense / 100,
      forecastProfit: (forecastRevenue - forecastExpense) / 100,
      forecastCount: forecasts.length,
    },
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


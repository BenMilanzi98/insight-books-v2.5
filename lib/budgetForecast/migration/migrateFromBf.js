/**
 * Migrate BF expense budgets / revenue forecasts into greenfield Planning models.
 * Does not delete BF tables (cutover cleanup is a later wave).
 * Never creates journals or stock movements.
 */

import prisma from '@/lib/prisma';
import { toMinor } from '../domain/money.js';
import { parsePeriodKey } from '../domain/periods.js';
import { BUDGET_STATUS } from '../domain/budgetStates.js';
import { FORECAST_STATUS } from '../domain/forecastStates.js';

function mapBfStatusToBudget(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return BUDGET_STATUS.ACTIVE;
  return BUDGET_STATUS.DRAFT;
}

function mapBfStatusToForecast(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return FORECAST_STATUS.ACTIVE;
  return FORECAST_STATUS.DRAFT;
}

function mapFrequency(periodType) {
  const t = String(periodType || '').toLowerCase();
  if (t === 'quarterly') return 'QUARTERLY';
  if (t === 'yearly' || t === 'annual') return 'ANNUAL';
  return 'MONTHLY';
}

/**
 * @param {string} tenantId
 * @param {{ dryRun?: boolean, db?: import('@prisma/client').PrismaClient }} [opts]
 */
export async function migrateBfExpenseBudgets(tenantId, opts = {}) {
  const db = opts.db || prisma;
  const headers = await db.bfExpenseBudgetHeader.findMany({
    where: { tenantId },
    include: {
      lines: { include: { account: true } },
    },
  });

  const results = [];
  for (const header of headers) {
    const byAccount = new Map();
    for (const line of header.lines) {
      if (!byAccount.has(line.accountId)) byAccount.set(line.accountId, []);
      byAccount.get(line.accountId).push(line);
    }

    const lineCreates = [];
    for (const [accountId, periodLines] of byAccount) {
      const acc = periodLines[0].account;
      let annual = 0;
      const periodAmounts = [];
      for (const pl of periodLines) {
        const meta = parsePeriodKey(pl.period);
        const planned = toMinor(pl.plannedAmount ?? 0);
        annual += planned;
        periodAmounts.push({
          periodStart: meta?.periodStart || header.startDate,
          periodEnd: meta?.periodEnd || header.endDate,
          monthNumber: meta?.monthNumber ?? null,
          quarterNumber: meta?.quarterNumber ?? null,
          plannedAmountMinor: planned,
          sourceMethod: 'BF_MIGRATION',
        });
      }
      lineCreates.push({
        accountId,
        accountCodeSnapshot: acc?.accountCode || '',
        accountNameSnapshot: acc?.accountName || '',
        accountTypeSnapshot: acc?.accountType || null,
        accountCategorySnapshot: null,
        calculationMethod: 'BF_MIGRATION',
        annualAmountMinor: annual,
        periodAmounts: { create: periodAmounts },
      });
    }

    const payload = {
      tenantId,
      businessId: tenantId,
      name: header.name,
      description: `Migrated from BF expense budget ${header.id}`,
      budgetType: 'OPERATING',
      budgetMethod: 'BF_MIGRATION',
      frequency: mapFrequency(header.periodType),
      startDate: header.startDate,
      endDate: header.endDate,
      currency: 'MWK',
      status: mapBfStatusToBudget(header.status),
      createdById: header.createdById || null,
      notes: `bfExpenseBudgetHeaderId=${header.id}`,
      lines: { create: lineCreates },
      versions: {
        create: {
          versionNumber: 1,
          revisionNumber: 1,
          state: mapBfStatusToBudget(header.status),
          changeReason: 'BF migration',
          createdById: header.createdById || null,
        },
      },
    };

    if (opts.dryRun) {
      results.push({ sourceId: header.id, action: 'WOULD_CREATE', lineCount: lineCreates.length });
      continue;
    }

    const created = await db.budget.create({
      data: payload,
      include: { lines: true },
    });
    results.push({ sourceId: header.id, budgetId: created.id, lineCount: created.lines.length });
  }

  return { tenantId, migrated: results.length, results };
}

/**
 * @param {string} tenantId
 * @param {{ dryRun?: boolean, db?: import('@prisma/client').PrismaClient }} [opts]
 */
export async function migrateBfRevenueForecasts(tenantId, opts = {}) {
  const db = opts.db || prisma;
  const headers = await db.bfRevenueForecastHeader.findMany({
    where: { tenantId },
    include: {
      lines: { include: { account: true } },
    },
  });

  const results = [];
  for (const header of headers) {
    const byAccount = new Map();
    for (const line of header.lines) {
      if (!byAccount.has(line.accountId)) byAccount.set(line.accountId, []);
      byAccount.get(line.accountId).push(line);
    }

    const lineCreates = [];
    for (const [accountId, periodLines] of byAccount) {
      const acc = periodLines[0].account;
      let projected = 0;
      const periodAmounts = [];
      for (const pl of periodLines) {
        const meta = parsePeriodKey(pl.period);
        const planned = toMinor(pl.plannedAmount ?? 0);
        projected += planned;
        periodAmounts.push({
          periodStart: meta?.periodStart || header.startDate,
          periodEnd: meta?.periodEnd || header.endDate,
          forecastAmountMinor: planned,
          sourceType: 'BF_MIGRATION',
          calculationVersion: 'bf-migrate-1.0.0',
        });
      }
      lineCreates.push({
        accountId,
        accountCodeSnapshot: acc?.accountCode || '',
        accountNameSnapshot: acc?.accountName || '',
        accountTypeSnapshot: acc?.accountType || null,
        forecastMethod: 'BF_MIGRATION',
        projectedAmountMinor: projected,
        periodAmounts: { create: periodAmounts },
      });
    }

    const payload = {
      tenantId,
      businessId: tenantId,
      name: header.name,
      description: `Migrated from BF revenue forecast ${header.id} (${header.version})`,
      forecastType: 'ROLLING',
      scenarioType: 'BASE_CASE',
      startDate: header.startDate,
      endDate: header.endDate,
      currency: 'MWK',
      status: mapBfStatusToForecast(header.status),
      createdById: header.createdById || null,
      notes: `bfRevenueForecastHeaderId=${header.id};version=${header.version}`,
      lines: { create: lineCreates },
    };

    if (opts.dryRun) {
      results.push({ sourceId: header.id, action: 'WOULD_CREATE', lineCount: lineCreates.length });
      continue;
    }

    const created = await db.forecast.create({
      data: payload,
      include: { lines: true },
    });
    results.push({ sourceId: header.id, forecastId: created.id, lineCount: created.lines.length });
  }

  return { tenantId, migrated: results.length, results };
}

export async function migrateAllBfForTenant(tenantId, opts = {}) {
  const budgets = await migrateBfExpenseBudgets(tenantId, opts);
  const forecasts = await migrateBfRevenueForecasts(tenantId, opts);
  return { budgets, forecasts };
}

/** Alias used by HTTP migrate route */
export async function migrateBfToGreenfield(tenantId, opts = {}) {
  return migrateAllBfForTenant(tenantId, opts);
}


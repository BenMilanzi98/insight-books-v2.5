import prisma from '@/lib/prisma';
import { buildHeuristicSuggestions } from '../domain/aiHeuristic.js';
import { classifyAccountKind } from '../domain/variance.js';
import { minorToNumber } from '../domain/money.js';
import { createAssumptionSet } from './assumptionService.js';

function serviceError(message, status = 400, code = 'AI_SUGGESTION_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    forecastId: row.forecastId,
    category: row.category,
    suggestionKey: row.suggestionKey,
    proposedValue: row.proposedValue,
    reason: row.reason,
    confidence: row.confidence,
    status: row.status,
    sourceDataRange: row.sourceDataRange,
    modelProvider: row.modelProvider,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Generate review-only suggestions for a forecast. Never posts to GL.
 * Requires body.enableAi === true (explicit opt-in; no auto-run).
 */
export async function generateForecastAiSuggestions(tenantId, userId, { forecastId, enableAi } = {}) {
  if (!enableAi) {
    throw serviceError(
      'AI suggestions require enableAi=true (review-only; defaults off)',
      400,
      'AI_DISABLED'
    );
  }
  if (!forecastId) throw serviceError('forecastId is required');

  const forecast = await prisma.forecast.findFirst({
    where: { id: forecastId, tenantId },
    include: {
      lines: { include: { periodAmounts: { orderBy: { periodStart: 'asc' } } } },
    },
  });
  if (!forecast) throw serviceError('Forecast not found', 404, 'FORECAST_NOT_FOUND');

  const revenueByPeriod = [];
  const expenseByPeriod = [];
  const periodKeys = new Map();

  for (const line of forecast.lines || []) {
    const kind = classifyAccountKind(line.accountTypeSnapshot, null);
    for (const p of line.periodAmounts || []) {
      const key = String(p.periodStart).slice(0, 7);
      if (!periodKeys.has(key)) periodKeys.set(key, { rev: 0, exp: 0 });
      const row = periodKeys.get(key);
      const amt = minorToNumber(p.forecastAmountMinor);
      if (kind === 'REVENUE' || kind === 'OTHER_INCOME') row.rev += amt;
      else if (kind === 'EXPENSE' || kind === 'COST_OF_SALES' || kind === 'OTHER_EXPENSE') row.exp += amt;
    }
  }
  const sorted = [...periodKeys.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, v] of sorted) {
    revenueByPeriod.push(v.rev);
    expenseByPeriod.push(v.exp);
  }

  let hasCashDip = false;
  try {
    const notes = forecast.notes ? JSON.parse(forecast.notes) : null;
    hasCashDip = (notes?.cashFlow?.months || []).some(
      (m) => m.warning === 'CASH_DIP' || Number(m.closingCash) < 0
    );
  } catch {
    hasCashDip = false;
  }

  const drafts = buildHeuristicSuggestions({
    revenueByPeriodMinor: revenueByPeriod,
    expenseByPeriodMinor: expenseByPeriod,
    hasCashDip,
  });

  const created = [];
  for (const d of drafts) {
    const row = await prisma.forecastAiSuggestion.create({
      data: {
        tenantId,
        businessId: tenantId,
        forecastId,
        category: d.category,
        suggestionKey: d.suggestionKey,
        proposedValue: d.proposedValue,
        reason: d.reason,
        confidence: d.confidence,
        status: 'PENDING_REVIEW',
        sourceDataRange: {
          periodCount: sorted.length,
          from: sorted[0]?.[0] || null,
          to: sorted.at(-1)?.[0] || null,
        },
        modelProvider: 'DETERMINISTIC_HEURISTIC_V1',
      },
    });
    created.push(serialize(row));
  }

  return {
    suggestions: created,
    governance: {
      autoApply: false,
      requiresHumanReview: true,
      writesToDatabase: 'SUGGESTION_TABLE_ONLY',
      postsToGeneralLedger: false,
      disclaimer:
        'AI/heuristic output is a suggestion only and must be accepted, modified, or rejected by a human.',
    },
  };
}

export async function listForecastAiSuggestions(tenantId, { forecastId, status } = {}) {
  const where = { tenantId };
  if (forecastId) where.forecastId = forecastId;
  if (status) where.status = String(status).toUpperCase();
  const rows = await prisma.forecastAiSuggestion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(serialize);
}

export async function reviewForecastAiSuggestion(
  tenantId,
  userId,
  suggestionId,
  { decision, modifiedValue, applyToAssumptionSet } = {}
) {
  const row = await prisma.forecastAiSuggestion.findFirst({
    where: { id: suggestionId, tenantId },
  });
  if (!row) throw serviceError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
  if (row.status !== 'PENDING_REVIEW') {
    throw serviceError('Suggestion already reviewed', 409, 'ALREADY_REVIEWED');
  }

  const dec = String(decision || '').toUpperCase();
  if (dec === 'REJECT') {
    const updated = await prisma.forecastAiSuggestion.update({
      where: { id: row.id },
      data: { status: 'REJECTED', reviewedById: userId || null, reviewedAt: new Date() },
    });
    return { suggestion: serialize(updated) };
  }

  if (dec !== 'ACCEPT' && dec !== 'ACCEPT_MODIFIED') {
    throw serviceError('decision must be ACCEPT, ACCEPT_MODIFIED, or REJECT');
  }

  const proposedValue = modifiedValue || row.proposedValue;
  const updated = await prisma.forecastAiSuggestion.update({
    where: { id: row.id },
    data: {
      status: dec === 'ACCEPT_MODIFIED' ? 'ACCEPTED_MODIFIED' : 'ACCEPTED',
      proposedValue,
      reviewedById: userId || null,
      reviewedAt: new Date(),
    },
  });

  let assumptionSet = null;
  if (applyToAssumptionSet) {
    const growth =
      proposedValue?.growthPercent != null ? Number(proposedValue.growthPercent) : null;
    if (growth != null && Number.isFinite(growth)) {
      const type =
        row.suggestionKey === 'expenseInflationPercent' ? 'INFLATION' : 'GROWTH';
      assumptionSet = await createAssumptionSet(tenantId, userId, {
        name: `From AI: ${row.suggestionKey} (${new Date().toISOString().slice(0, 10)})`,
        description: 'Created from accepted forecast AI suggestion (human-applied).',
        assumptions: [
          {
            assumptionType: type,
            scopeType: 'GLOBAL',
            unit: 'PERCENT',
            value: growth,
            notes: row.reason || null,
          },
        ],
      });
      if (row.forecastId && assumptionSet?.id) {
        await prisma.forecast.update({
          where: { id: row.forecastId },
          data: { assumptionSetId: assumptionSet.id },
        });
      }
    }
  }

  return {
    suggestion: serialize(updated),
    assumptionSet,
    note: 'Acceptance does not regenerate forecast lines or post journals.',
  };
}

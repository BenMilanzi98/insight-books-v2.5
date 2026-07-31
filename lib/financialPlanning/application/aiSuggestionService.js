import { AISuggestionValidationError, CrossTenantPlanningError } from '../domain/errors.js';

/**
 * AI-assisted forecasting: reviewable suggestions only.
 * Never writes assumptions/forecasts as approved. Never posts to GL.
 * Deterministic heuristic stub when AI provider disabled.
 */
export async function generateAiSuggestions(db, context, { forecastVersionId, historical } = {}) {
  const tenantId = context.businessId;
  const cfg = await db.planV2Configuration.findUnique({ where: { tenantId } });
  if (cfg && cfg.aiSuggestionsEnabled === false) {
    throw new AISuggestionValidationError('AI suggestions are disabled for this business.');
  }

  if (forecastVersionId) {
    const fv = await db.planV2ForecastVersion.findFirst({
      where: { id: forecastVersionId, tenantId },
    });
    if (!fv) throw new CrossTenantPlanningError('Forecast version not found for business.');
  }

  const periods = historical?.periods?.filter((p) => p.revenueMinor != null) || [];
  let suggestedGrowthBps = 50;
  let confidence = 'LOW';
  let reason = 'Insufficient history; default modest growth suggestion for review only.';

  if (periods.length >= 3) {
    const first = Number(periods[0].revenueMinor);
    const last = Number(periods[periods.length - 1].revenueMinor);
    if (first > 0) {
      const totalGrowth = (last - first) / first;
      const months = periods.length - 1;
      suggestedGrowthBps = Math.round((totalGrowth / months) * 10000);
      suggestedGrowthBps = Math.max(-5000, Math.min(5000, suggestedGrowthBps));
      confidence = periods.length >= 12 ? 'MODERATE' : 'LOW';
      reason = `Derived from ${periods.length} historical revenue periods (canonical planning dataset). Not approved.`;
    }
  }

  const suggestion = await db.planV2AISuggestion.create({
    data: {
      tenantId,
      forecastVersionId: forecastVersionId || null,
      category: 'REVENUE',
      suggestionKey: 'revenueGrowthBps',
      proposedValue: { revenueGrowthBps: suggestedGrowthBps, unit: 'bps' },
      reason,
      confidence,
      status: 'PENDING_REVIEW',
      sourceDataRange: {
        periodCount: periods.length,
        from: periods[0]?.periodKey || null,
        to: periods.at(-1)?.periodKey || null,
      },
      modelProvider: 'DETERMINISTIC_HEURISTIC_V1',
    },
  });

  return {
    suggestions: [suggestion],
    governance: {
      autoApply: false,
      requiresHumanReview: true,
      writesToDatabase: 'SUGGESTION_TABLE_ONLY',
      postsToGeneralLedger: false,
      disclaimer: 'AI output is a suggestion only and must be accepted, modified, or rejected by a human.',
    },
  };
}

export async function reviewAiSuggestion(db, context, suggestionId, { decision, modifiedValue } = {}) {
  const tenantId = context.businessId;
  const row = await db.planV2AISuggestion.findFirst({ where: { id: suggestionId, tenantId } });
  if (!row) throw new CrossTenantPlanningError('AI suggestion not found for business.');
  if (row.status !== 'PENDING_REVIEW') {
    throw new AISuggestionValidationError('Suggestion already reviewed.');
  }

  if (decision === 'REJECT') {
    return db.planV2AISuggestion.update({
      where: { id: row.id },
      data: { status: 'REJECTED', reviewedBy: context.userId, reviewedAt: new Date() },
    });
  }

  if (decision !== 'ACCEPT' && decision !== 'ACCEPT_MODIFIED') {
    throw new AISuggestionValidationError('decision must be ACCEPT, ACCEPT_MODIFIED, or REJECT.');
  }

  // Acceptance only marks suggestion — does NOT auto-write assumptions or approve forecasts
  return db.planV2AISuggestion.update({
    where: { id: row.id },
    data: {
      status: decision === 'ACCEPT_MODIFIED' ? 'ACCEPTED_MODIFIED' : 'ACCEPTED',
      proposedValue: modifiedValue || row.proposedValue,
      reviewedBy: context.userId,
      reviewedAt: new Date(),
    },
  });
}

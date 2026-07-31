import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import {
  generateAiSuggestions,
  reviewAiSuggestion,
} from '../../../../lib/financialPlanning/application/aiSuggestionService.js';
import { buildHistoricalDataset } from '../../../../lib/financialPlanning/application/historicalDatasetService.js';
import { PLANNING_FLAGS, isFlagEnabled } from '../../../../lib/accountingV2/infrastructure/featureFlags.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.RUN_AI);
    if (guard.response) return guard.response;

    const aiFlag = await isFlagEnabled(prisma, PLANNING_FLAGS.AI, {
      tenantId: guard.context.businessId,
    });
    // AI flag defaults OFF; still allow deterministic heuristic when explicitly requested via config
    const { searchParams } = new URL(request.url);
    const forecastVersionId = searchParams.get('forecastVersionId') || undefined;
    const historical = await buildHistoricalDataset(prisma, guard.context, {});
    const out = await generateAiSuggestions(prisma, guard.context, {
      forecastVersionId,
      historical,
    });
    return NextResponse.json({ ...out, flagEnabled: aiFlag });
  } catch (error) {
    return accountingErrorResponse(error, 'generate AI suggestions');
  }
}

export async function POST(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.REVIEW_AI);
    if (guard.response) return guard.response;
    const body = await request.json();
    const suggestion = await reviewAiSuggestion(prisma, guard.context, body.suggestionId, body);
    return NextResponse.json({
      suggestion,
      note: 'Accepted suggestions do not auto-apply to assumptions or approve forecasts.',
    });
  } catch (error) {
    return accountingErrorResponse(error, 'review AI suggestion');
  }
}

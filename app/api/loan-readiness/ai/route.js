import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardLoanReadinessRoute, accountingErrorResponse } from '../../../../lib/loanReadiness/api/routeGuard.js';
import { LOAN_READINESS_PERMISSIONS } from '../../../../lib/loanReadiness/permissions.js';
import { LOAN_READINESS_FLAGS, isFlagEnabled } from '../../../../lib/accountingV2/infrastructure/featureFlags.js';
import {
  generateAiCommentary,
  reviewAiCommentary,
} from '../../../../lib/loanReadiness/application/aiCommentaryService.js';
import { ADVISORY_DISCLAIMER } from '../../../../lib/loanReadiness/domain/enums.js';

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.action === 'generate') {
      const guard = await guardLoanReadinessRoute(request, LOAN_READINESS_PERMISSIONS.RUN_AI);
      if (guard.response) return guard.response;
      const aiEnabled = await isFlagEnabled(prisma, LOAN_READINESS_FLAGS.AI, {
        tenantId: guard.context.businessId,
      });
      if (!aiEnabled) {
        return NextResponse.json(
          {
            error: 'FEATURE_DISABLED',
            message: 'AI loan readiness commentary is not enabled for this business.',
            flag: LOAN_READINESS_FLAGS.AI,
          },
          { status: 403 }
        );
      }
      if (!body.assessmentVersionId) {
        return NextResponse.json({ error: 'assessmentVersionId required' }, { status: 400 });
      }
      const result = await generateAiCommentary(prisma, guard.context, body.assessmentVersionId);
      return NextResponse.json({ ...result, disclaimer: ADVISORY_DISCLAIMER });
    }

    if (body.action === 'review') {
      const guard = await guardLoanReadinessRoute(request, LOAN_READINESS_PERMISSIONS.REVIEW_AI);
      if (guard.response) return guard.response;
      if (!body.commentaryId) {
        return NextResponse.json({ error: 'commentaryId required' }, { status: 400 });
      }
      const commentary = await reviewAiCommentary(prisma, guard.context, body.commentaryId, {
        decision: body.decision,
      });
      return NextResponse.json({ commentary, disclaimer: ADVISORY_DISCLAIMER });
    }

    return NextResponse.json({ error: 'action must be generate or review' }, { status: 400 });
  } catch (error) {
    return accountingErrorResponse(error, 'ai commentary');
  }
}

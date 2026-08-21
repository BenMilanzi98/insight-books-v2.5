import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma.js';
import { guardLoanReadinessRoute, accountingErrorResponse } from '../../../../../lib/loanReadiness/api/routeGuard.js';
import { LOAN_READINESS_PERMISSIONS } from '../../../../../lib/loanReadiness/permissions.js';
import {
  getAssessmentVersion,
  calculateAssessmentVersion,
  reviewAssessmentVersion,
  approveAssessmentVersion,
} from '../../../../../lib/loanReadiness/application/assessmentService.js';
import { ADVISORY_DISCLAIMER } from '../../../../../lib/loanReadiness/domain/enums.js';
import { serializeLoanReadiness } from '../../../../../lib/loanReadiness/application/serialize.js';

export async function GET(request, { params }) {
  try {
    const guard = await guardLoanReadinessRoute(request, LOAN_READINESS_PERMISSIONS.VIEW);
    if (guard.response) return guard.response;
    const { id } = await params;
    const version = await getAssessmentVersion(prisma, guard.context.businessId, id);
    return NextResponse.json({ version, disclaimer: ADVISORY_DISCLAIMER });
  } catch (error) {
    return accountingErrorResponse(error, 'get assessment');
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action === 'calculate') {
      const guard = await guardLoanReadinessRoute(
        request,
        LOAN_READINESS_PERMISSIONS.CALCULATE_ASSESSMENT
      );
      if (guard.response) return guard.response;
      const version = await calculateAssessmentVersion(prisma, guard.context, id, body);
      return NextResponse.json({ version, disclaimer: ADVISORY_DISCLAIMER });
    }
    if (body.action === 'review') {
      const guard = await guardLoanReadinessRoute(
        request,
        LOAN_READINESS_PERMISSIONS.REVIEW_ASSESSMENT
      );
      if (guard.response) return guard.response;
      const version = serializeLoanReadiness(
        await reviewAssessmentVersion(prisma, guard.context, id)
      );
      return NextResponse.json({ version, disclaimer: ADVISORY_DISCLAIMER });
    }
    if (body.action === 'approve') {
      const guard = await guardLoanReadinessRoute(
        request,
        LOAN_READINESS_PERMISSIONS.APPROVE_ASSESSMENT
      );
      if (guard.response) return guard.response;
      const version = serializeLoanReadiness(
        await approveAssessmentVersion(prisma, guard.context, id)
      );
      return NextResponse.json({ version, disclaimer: ADVISORY_DISCLAIMER });
    }

    return NextResponse.json(
      { error: 'action must be calculate, review, or approve' },
      { status: 400 }
    );
  } catch (error) {
    return accountingErrorResponse(error, 'assessment action');
  }
}

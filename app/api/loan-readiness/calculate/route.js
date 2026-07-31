import { NextResponse } from 'next/server';
import { guardLoanReadinessRoute, accountingErrorResponse } from '../../../../lib/loanReadiness/api/routeGuard.js';
import { LOAN_READINESS_PERMISSIONS } from '../../../../lib/loanReadiness/permissions.js';
import { runLoanReadinessAssessment } from '../../../../lib/loanReadiness/domain/assessmentEngine.js';
import { ADVISORY_DISCLAIMER } from '../../../../lib/loanReadiness/domain/enums.js';
import { parseToMinor } from '../../../../lib/loanReadiness/domain/money.js';

/** Stateless preview — does not persist and never writes GL. */
export async function POST(request) {
  try {
    const guard = await guardLoanReadinessRoute(request, [
      LOAN_READINESS_PERMISSIONS.CALCULATE_ASSESSMENT,
      LOAN_READINESS_PERMISSIONS.CALCULATE_DEBT_CAPACITY,
    ]);
    if (guard.response) return guard.response;
    const body = await request.json();

    if (body.loanRequest?.requestedAmount && !body.loanRequest.requestedAmountMinor) {
      body.loanRequest.requestedAmount = parseToMinor(body.loanRequest.requestedAmount);
    }

    const result = runLoanReadinessAssessment(body);
    return NextResponse.json({
      result,
      disclaimer: ADVISORY_DISCLAIMER,
      neverPostsToGl: true,
      neverCreatesLiability: true,
    });
  } catch (error) {
    return accountingErrorResponse(error, 'preview loan readiness');
  }
}

import { NextResponse } from 'next/server';
import prisma from '../../prisma.js';
import {
  guardAccountingRoute,
  accountingErrorResponse as baseAccountingErrorResponse,
} from '../../accountingV2/api/routeGuard.js';
import { LOAN_READINESS_FLAGS, isFlagEnabled } from '../../accountingV2/infrastructure/featureFlags.js';
import { LoanReadinessError } from '../domain/errors.js';

export function accountingErrorResponse(error, operation) {
  if (error instanceof LoanReadinessError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        retryable: error.retryable,
        context: error.context || {},
      },
      { status: error.status || 400 }
    );
  }
  return baseAccountingErrorResponse(error, operation);
}

export async function guardLoanReadinessRoute(request, permissions, { requireFlag = true } = {}) {
  const guard = await guardAccountingRoute(request, permissions);
  if (guard.response) return guard;

  if (requireFlag) {
    const enabled = await isFlagEnabled(prisma, LOAN_READINESS_FLAGS.ENABLED, {
      tenantId: guard.context.businessId,
    });
    if (!enabled) {
      return {
        response: NextResponse.json(
          {
            error: 'FEATURE_DISABLED',
            message: 'Loan Readiness is not enabled for this business.',
            flag: LOAN_READINESS_FLAGS.ENABLED,
          },
          { status: 403 }
        ),
      };
    }
  }
  return guard;
}

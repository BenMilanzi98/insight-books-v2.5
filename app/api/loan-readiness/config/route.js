import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardLoanReadinessRoute, accountingErrorResponse } from '../../../../lib/loanReadiness/api/routeGuard.js';
import { LOAN_READINESS_PERMISSIONS } from '../../../../lib/loanReadiness/permissions.js';
import {
  getLoanReadinessConfiguration,
  upsertDraftLoanReadinessConfiguration,
  approveLoanReadinessConfiguration,
} from '../../../../lib/loanReadiness/application/configService.js';

export async function GET(request) {
  try {
    const guard = await guardLoanReadinessRoute(request, [
      LOAN_READINESS_PERMISSIONS.VIEW,
      LOAN_READINESS_PERMISSIONS.MANAGE_CONFIGURATION,
    ]);
    if (guard.response) return guard.response;
    const configuration = await getLoanReadinessConfiguration(prisma, guard.context.businessId);
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'get loan readiness configuration');
  }
}

export async function PUT(request) {
  try {
    const guard = await guardLoanReadinessRoute(request, LOAN_READINESS_PERMISSIONS.MANAGE_CONFIGURATION);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (body.action === 'approve') {
      const configuration = await approveLoanReadinessConfiguration(prisma, guard.context);
      return NextResponse.json({ configuration });
    }
    const configuration = await upsertDraftLoanReadinessConfiguration(prisma, guard.context, body);
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'update loan readiness configuration');
  }
}

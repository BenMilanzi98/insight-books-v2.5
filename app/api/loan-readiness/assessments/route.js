import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardLoanReadinessRoute, accountingErrorResponse } from '../../../../lib/loanReadiness/api/routeGuard.js';
import { LOAN_READINESS_PERMISSIONS } from '../../../../lib/loanReadiness/permissions.js';
import {
  createAssessmentCycle,
  listAssessmentCycles,
  createLoanRequest,
  createAssessmentVersion,
} from '../../../../lib/loanReadiness/application/assessmentService.js';

export async function GET(request) {
  try {
    const guard = await guardLoanReadinessRoute(request, LOAN_READINESS_PERMISSIONS.VIEW);
    if (guard.response) return guard.response;
    const cycles = await listAssessmentCycles(prisma, guard.context.businessId);
    return NextResponse.json({ cycles });
  } catch (error) {
    return accountingErrorResponse(error, 'list assessments');
  }
}

export async function POST(request) {
  try {
    const guard = await guardLoanReadinessRoute(request, LOAN_READINESS_PERMISSIONS.CREATE_ASSESSMENT);
    if (guard.response) return guard.response;
    const body = await request.json();

    if (body.action === 'createCycle') {
      const cycle = await createAssessmentCycle(prisma, guard.context, body);
      return NextResponse.json({ cycle }, { status: 201 });
    }
    if (body.action === 'createLoanRequest') {
      const reqGuard = await guardLoanReadinessRoute(
        request,
        LOAN_READINESS_PERMISSIONS.CREATE_LOAN_REQUEST
      );
      if (reqGuard.response) return reqGuard.response;
      const loanRequest = await createLoanRequest(prisma, reqGuard.context, body);
      return NextResponse.json({ loanRequest }, { status: 201 });
    }
    if (body.action === 'createVersion') {
      const version = await createAssessmentVersion(prisma, guard.context, body);
      return NextResponse.json({ version }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'action must be createCycle, createLoanRequest, or createVersion' },
      { status: 400 }
    );
  } catch (error) {
    return accountingErrorResponse(error, 'create assessment');
  }
}

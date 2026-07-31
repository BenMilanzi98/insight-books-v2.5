import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardLoanReadinessRoute, accountingErrorResponse } from '../../../../lib/loanReadiness/api/routeGuard.js';
import { LOAN_READINESS_PERMISSIONS } from '../../../../lib/loanReadiness/permissions.js';
import {
  exportLenderPackage,
  exportBoardPack,
} from '../../../../lib/loanReadiness/application/exportService.js';

export async function GET(request) {
  try {
    const guard = await guardLoanReadinessRoute(request, [
      LOAN_READINESS_PERMISSIONS.EXPORT,
      LOAN_READINESS_PERMISSIONS.GENERATE_LENDER_PACKAGE,
    ]);
    if (guard.response) return guard.response;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('assessmentVersionId');
    if (!id) {
      return NextResponse.json({ error: 'assessmentVersionId required' }, { status: 400 });
    }
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    const pack = (searchParams.get('pack') || 'lender').toLowerCase();
    const exported =
      pack === 'board'
        ? await exportBoardPack(prisma, guard.context, id, {
            format: format === 'json' ? 'json' : 'xlsx',
          })
        : await exportLenderPackage(prisma, guard.context, id, {
            format: format === 'json' ? 'json' : 'xlsx',
          });

    if (exported.contentType === 'application/json') {
      return NextResponse.json(exported.body, {
        headers: { 'Content-Disposition': `attachment; filename="${exported.filename}"` },
      });
    }

    return new NextResponse(exported.body, {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.filename}"`,
      },
    });
  } catch (error) {
    return accountingErrorResponse(error, 'export lender package');
  }
}

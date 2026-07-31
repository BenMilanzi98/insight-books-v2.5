import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import {
  buildReconciliationStatement,
  statementToCsv,
} from '@/lib/bankReconciliation/application/reportService.js';

export async function GET(request, { params }) {
  const guard = await guardBankReconRoute(request, [
    BANK_RECON_PERMISSIONS.EXPORT,
    BANK_RECON_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const format = new URL(request.url).searchParams.get('format') || 'json';
    const statement = await buildReconciliationStatement(prisma, guard.context, id);
    if (format === 'csv') {
      return new NextResponse(statementToCsv(statement), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="bank-recon-${id}.csv"`,
        },
      });
    }
    return NextResponse.json({ statement });
  } catch (error) {
    return accountingErrorResponse(error, 'export bank reconciliation');
  }
}

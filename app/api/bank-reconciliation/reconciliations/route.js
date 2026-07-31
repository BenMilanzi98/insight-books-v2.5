import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import {
  createReconciliation,
  listReconciliations,
} from '@/lib/bankReconciliation/application/reconciliationService.js';

export async function GET(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.VIEW);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const rows = await listReconciliations(prisma, guard.context, {
      paymentAccountId: searchParams.get('paymentAccountId') || undefined,
      status: searchParams.get('status') || undefined,
    });
    return NextResponse.json({ reconciliations: rows });
  } catch (error) {
    return accountingErrorResponse(error, 'list reconciliations');
  }
}

export async function POST(request) {
  const guard = await guardBankReconRoute(request, [
    BANK_RECON_PERMISSIONS.MATCH,
    BANK_RECON_PERMISSIONS.IMPORT,
  ]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const reconciliation = await createReconciliation(prisma, guard.context, body);
    return NextResponse.json({ reconciliation }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create reconciliation');
  }
}

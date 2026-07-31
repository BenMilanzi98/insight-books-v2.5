import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { getReconciliationWorkspace } from '@/lib/bankReconciliation/application/reconciliationService.js';

export async function GET(request, { params }) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.VIEW);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const workspace = await getReconciliationWorkspace(prisma, guard.context, id);
    return NextResponse.json(workspace);
  } catch (error) {
    return accountingErrorResponse(error, 'get reconciliation workspace');
  }
}

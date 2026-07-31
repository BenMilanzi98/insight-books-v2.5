import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { listReconcilableAccounts } from '@/lib/bankReconciliation/application/configService.js';

export async function GET(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.VIEW);
  if (guard.response) return guard.response;
  try {
    const accounts = await listReconcilableAccounts(prisma, guard.context.businessId);
    return NextResponse.json({ accounts });
  } catch (error) {
    return accountingErrorResponse(error, 'list reconcilable bank accounts');
  }
}

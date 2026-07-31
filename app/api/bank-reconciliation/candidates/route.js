import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { listGlCandidates } from '@/lib/bankReconciliation/application/candidateService.js';

export async function GET(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.VIEW);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const paymentAccountId = searchParams.get('paymentAccountId');
    if (!paymentAccountId) {
      return NextResponse.json({ error: 'paymentAccountId required' }, { status: 400 });
    }
    const candidates = await listGlCandidates(prisma, guard.context, {
      paymentAccountId,
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    });
    return NextResponse.json({ candidates });
  } catch (error) {
    return accountingErrorResponse(error, 'list GL candidates');
  }
}

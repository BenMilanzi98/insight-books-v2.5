import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { getConfiguration, upsertConfiguration } from '@/lib/bankReconciliation/application/configService.js';

export async function GET(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.VIEW);
  if (guard.response) return guard.response;
  try {
    const paymentAccountId = new URL(request.url).searchParams.get('paymentAccountId');
    if (!paymentAccountId) {
      return NextResponse.json({ error: 'paymentAccountId required' }, { status: 400 });
    }
    const configuration = await getConfiguration(prisma, guard.context.businessId, paymentAccountId);
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'get bank recon config');
  }
}

export async function PUT(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.CONFIGURE);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const configuration = await upsertConfiguration(prisma, guard.context, body);
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'upsert bank recon config');
  }
}

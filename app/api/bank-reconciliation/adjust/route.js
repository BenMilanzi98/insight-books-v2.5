import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { classifyAndAdjust } from '@/lib/bankReconciliation/application/adjustmentService.js';

export async function POST(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.ADJUST);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const result = await classifyAndAdjust(prisma, guard.context, body, { hasPermission: guard.can });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'bank recon adjustment');
  }
}

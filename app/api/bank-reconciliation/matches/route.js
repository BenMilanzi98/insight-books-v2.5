import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { manualMatch, suggestMatches } from '@/lib/bankReconciliation/application/matchingService.js';

export async function GET(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.VIEW);
  if (guard.response) return guard.response;
  try {
    const reconciliationId = new URL(request.url).searchParams.get('reconciliationId');
    if (!reconciliationId) {
      return NextResponse.json({ error: 'reconciliationId required' }, { status: 400 });
    }
    const result = await suggestMatches(prisma, guard.context, { reconciliationId });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'suggest matches');
  }
}

export async function POST(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.MATCH);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const match = await manualMatch(prisma, guard.context, body);
    return NextResponse.json({ match }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'manual match');
  }
}

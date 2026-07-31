import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { acceptMatch, rejectMatch } from '@/lib/bankReconciliation/application/matchingService.js';

export async function POST(request, { params }) {
  const { id, action } = await params;
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.MATCH);
  if (guard.response) return guard.response;
  try {
    let match;
    if (action === 'accept') match = await acceptMatch(prisma, guard.context, id);
    else if (action === 'reject') match = await rejectMatch(prisma, guard.context, id);
    else return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
    return NextResponse.json({ match });
  } catch (error) {
    return accountingErrorResponse(error, `match ${action}`);
  }
}

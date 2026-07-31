import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import {
  calculateAndPersist,
  submitForReview,
  approveReconciliation,
  completeReconciliation,
  reopenReconciliation,
  reverseReconciliation,
} from '@/lib/bankReconciliation/application/reconciliationService.js';
import { runAutoMatch } from '@/lib/bankReconciliation/application/matchingService.js';

const ACTION_PERMS = {
  calculate: BANK_RECON_PERMISSIONS.VIEW,
  'auto-match': BANK_RECON_PERMISSIONS.MATCH,
  review: BANK_RECON_PERMISSIONS.REVIEW,
  approve: BANK_RECON_PERMISSIONS.APPROVE,
  complete: BANK_RECON_PERMISSIONS.COMPLETE,
  reopen: BANK_RECON_PERMISSIONS.REOPEN,
  reverse: BANK_RECON_PERMISSIONS.REVERSE,
};

export async function POST(request, { params }) {
  const { id, action } = await params;
  const perm = ACTION_PERMS[action];
  if (!perm) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
  }
  const guard = await guardBankReconRoute(request, perm);
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    let result;
    switch (action) {
      case 'calculate':
        result = await calculateAndPersist(prisma, guard.context, id);
        break;
      case 'auto-match':
        result = await runAutoMatch(prisma, guard.context, { reconciliationId: id });
        break;
      case 'review':
        result = await submitForReview(prisma, guard.context, id, body.comment);
        break;
      case 'approve':
        result = await approveReconciliation(prisma, guard.context, id, body.comment);
        break;
      case 'complete':
        result = await completeReconciliation(prisma, guard.context, id, body.comment);
        break;
      case 'reopen':
        result = await reopenReconciliation(prisma, guard.context, id, body.reason || body.comment);
        break;
      case 'reverse':
        result = await reverseReconciliation(prisma, guard.context, id, body.reason || body.comment);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, `reconciliation ${action}`);
  }
}

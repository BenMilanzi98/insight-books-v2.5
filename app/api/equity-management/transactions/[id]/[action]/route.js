import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  submitForApproval,
  approveTransaction,
  previewEquityPosting,
  postEquityTransaction,
} from '@/lib/equityManagement/application/transactionService.js';

const PERMS = {
  submit: EQUITY_PERMISSIONS.CREATE_CONTRIBUTION,
  approve: [
    EQUITY_PERMISSIONS.APPROVE_CONTRIBUTION,
    EQUITY_PERMISSIONS.APPROVE_DRAWING,
    EQUITY_PERMISSIONS.APPROVE_DIVIDEND,
  ],
  preview: EQUITY_PERMISSIONS.VIEW,
  post: [
    EQUITY_PERMISSIONS.POST_CONTRIBUTION,
    EQUITY_PERMISSIONS.POST_DRAWING,
    EQUITY_PERMISSIONS.PAY_DIVIDEND,
  ],
};

export async function POST(request, { params }) {
  const { id, action } = await params;
  const perm = PERMS[action];
  if (!perm) return NextResponse.json({ error: `Unknown action ${action}` }, { status: 404 });
  const guard = await guardEquityRoute(request, perm);
  if (guard.response) return guard.response;
  try {
    const body = await request.json().catch(() => ({}));
    let result;
    switch (action) {
      case 'submit':
        result = await submitForApproval(prisma, guard.context, id, body.comment);
        break;
      case 'approve':
        result = await approveTransaction(prisma, guard.context, id, body.comment);
        break;
      case 'preview':
        result = await previewEquityPosting(prisma, guard.context, id);
        break;
      case 'post':
        result = await postEquityTransaction(prisma, guard.context, id, {
          hasPermission: guard.can,
        });
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, `equity transaction ${action}`);
  }
}

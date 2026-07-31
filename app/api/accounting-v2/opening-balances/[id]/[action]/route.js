/**
 * /api/accounting-v2/opening-balances/[id]/[action]
 *
 * POST actions on an opening-balance batch:
 *   submit  — DRAFT → PENDING_APPROVAL     (openingBalances.create)
 *   approve — PENDING_APPROVAL → APPROVED  (openingBalances.approve, SoD)
 *   cancel  — pre-posted → CANCELLED       (openingBalances.create)
 *   preview — read-only posting preview    (accountingPosting.preview)
 *   post    — APPROVED → POSTED via engine (openingBalances.post)
 */

import { NextResponse } from 'next/server';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  submitOpeningBalanceBatch,
  approveOpeningBalanceBatch,
  cancelOpeningBalanceBatch,
  postOpeningBalanceBatch,
  previewOpeningBalanceBatch,
} from '@/lib/accountingV2/application/openingBalanceService.js';

const ACTION_PERMISSIONS = {
  submit: [ACCOUNTING_PERMISSIONS.OPENING_BALANCES_CREATE],
  approve: [ACCOUNTING_PERMISSIONS.OPENING_BALANCES_APPROVE],
  cancel: [ACCOUNTING_PERMISSIONS.OPENING_BALANCES_CREATE],
  preview: [ACCOUNTING_PERMISSIONS.POSTING_PREVIEW, ACCOUNTING_PERMISSIONS.OPENING_BALANCES_POST],
  post: [ACCOUNTING_PERMISSIONS.OPENING_BALANCES_POST],
};

export async function POST(request, { params }) {
  const { id, action } = await params;
  const permissions = ACTION_PERMISSIONS[action];
  if (!permissions) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
  }
  const guard = await guardAccountingRoute(request, permissions);
  if (guard.response) return guard.response;
  const { context, can } = guard;

  try {
    const options = { hasPermission: can };
    switch (action) {
      case 'submit':
        return NextResponse.json({ batch: await submitOpeningBalanceBatch(context, id, options) });
      case 'approve':
        return NextResponse.json({ batch: await approveOpeningBalanceBatch(context, id, options) });
      case 'cancel':
        return NextResponse.json({ batch: await cancelOpeningBalanceBatch(context, id, options) });
      case 'preview':
        return NextResponse.json({ preview: await previewOpeningBalanceBatch(context, id, options) });
      case 'post':
        return NextResponse.json({ result: await postOpeningBalanceBatch(context, id, options) });
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
    }
  } catch (error) {
    return accountingErrorResponse(error, `${action} opening-balance batch`);
  }
}

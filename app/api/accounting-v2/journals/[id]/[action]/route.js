/**
 * /api/accounting-v2/journals/[id]/[action]
 *
 * POST actions on a V2 journal:
 *   submit  — Draft → PendingApproval           (journal.submit)
 *   approve — PendingApproval → Approved        (journal.approve, SoD enforced)
 *   reject  — PendingApproval → Draft           (journal.approve)
 *   cancel  — pre-posted → Cancelled            (journal.create)
 *   preview — read-only posting preview         (accountingPosting.preview)
 *   post    — Approved → POSTED via the engine  (journal.post / journal.postAdjustment)
 *   reverse — Posted → Reversed via a NEW posted reversal journal (journal.reverse)
 *   preview-reversal — read-only reversal preview (journal.reverse)
 *
 * Every transition is enforced server-side by the V2 status machine; the
 * posting engine governs mode, idempotency and atomic persistence.
 */

import { NextResponse } from 'next/server';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  submitManualJournal,
  approveManualJournal,
  rejectManualJournal,
  cancelManualJournal,
  postManualJournal,
  previewManualJournal,
} from '@/lib/accountingV2/application/manualJournalService.js';
import {
  reverseJournal,
  previewReversal,
} from '@/lib/accountingV2/application/journalReversalService.js';

const ACTION_PERMISSIONS = {
  submit: [ACCOUNTING_PERMISSIONS.JOURNAL_SUBMIT],
  approve: [ACCOUNTING_PERMISSIONS.JOURNAL_APPROVE],
  reject: [ACCOUNTING_PERMISSIONS.JOURNAL_APPROVE],
  cancel: [ACCOUNTING_PERMISSIONS.JOURNAL_CREATE],
  preview: [ACCOUNTING_PERMISSIONS.POSTING_PREVIEW, ACCOUNTING_PERMISSIONS.JOURNAL_POST],
  post: [ACCOUNTING_PERMISSIONS.JOURNAL_POST, ACCOUNTING_PERMISSIONS.JOURNAL_POST_ADJUSTMENT],
  reverse: [ACCOUNTING_PERMISSIONS.JOURNAL_REVERSE],
  'preview-reversal': [ACCOUNTING_PERMISSIONS.JOURNAL_REVERSE],
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
    const body = await request.json().catch(() => ({}));
    const options = { hasPermission: can, postingDate: body.postingDate ?? null };

    switch (action) {
      case 'submit':
        return NextResponse.json({ journal: await submitManualJournal(context, id, options) });
      case 'approve':
        return NextResponse.json({ journal: await approveManualJournal(context, id, options) });
      case 'reject':
        return NextResponse.json({
          journal: await rejectManualJournal(context, id, body.reason ?? null, options),
        });
      case 'cancel':
        return NextResponse.json({ journal: await cancelManualJournal(context, id, options) });
      case 'preview':
        return NextResponse.json({ preview: await previewManualJournal(context, id, options) });
      case 'post':
        return NextResponse.json({ result: await postManualJournal(context, id, options) });
      case 'reverse':
        return NextResponse.json({
          result: await reverseJournal(context, id, { ...options, reason: body.reason ?? null }),
        });
      case 'preview-reversal':
        return NextResponse.json({
          preview: await previewReversal(context, id, { ...options, reason: body.reason ?? null }),
        });
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
    }
  } catch (error) {
    return accountingErrorResponse(error, `${action} journal`);
  }
}

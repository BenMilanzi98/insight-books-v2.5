/**
 * POST /api/payroll/remove-entries
 *
 * Reverses or cancels payroll rows in one request (no per-row DELETE).
 * Works for **any** non-Reversed payroll status:
 * - No GL rows linked → mark `Reversed` (audit-safe cancel).
 * - Posted payroll journal → `reversePayroll` (full GL reversal + existing PAYROLL_REVERSAL audit).
 * - Same edge handling as DELETE /api/payroll/[id] (empty journal, resolve errors, etc.).
 *
 * Body: { ids: string[], reason?: string }
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  countTransactionsLinkedToPayroll,
  markPayrollReversedIfNotAlready,
} from '@/lib/payrollCancelHelpers';
import {
  reversePayroll,
  resolvePostedPayrollJournalState,
  validateReversalReason,
} from '@/lib/transactionReversalService';

const MAX_IDS = 200;

function reversalReasonOrDefault(rawReason) {
  const base =
    typeof rawReason === 'string' && rawReason.trim()
      ? rawReason.trim().slice(0, 1000)
      : 'Payroll run removed (bulk action — system default reason).';
  const v = validateReversalReason(base);
  if (v.isValid) return v.reason;
  return 'Payroll run removed (bulk action — system default reason).';
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId || !user.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const idsRaw = body?.ids;
    if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
      return NextResponse.json(
        { error: 'Request body must include a non-empty "ids" array of payroll row ids.' },
        { status: 400 }
      );
    }

    const ids = [...new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean))].slice(0, MAX_IDS);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid payroll ids provided.' }, { status: 400 });
    }

    const reason = reversalReasonOrDefault(body?.reason);

    const rows = await prisma.payroll.findMany({
      where: { id: { in: ids }, tenantId: user.tenantId },
      select: { id: true, status: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const blocked = [];
    let cancelledSoft = 0;
    let cancelledJournal = 0;
    let skippedReversed = 0;
    let notFound = 0;

    for (const id of ids) {
      const row = byId.get(id);
      if (!row) {
        notFound++;
        blocked.push({ id, reason: 'Not found or not in your business.' });
        continue;
      }
      if (row.status === 'Reversed') {
        skippedReversed++;
        continue;
      }

      const linkedTxCount = await countTransactionsLinkedToPayroll(user.tenantId, id);

      // No GL activity at all — safe to mark Reversed regardless of payroll.status (Processed, Posted, etc.)
      if (linkedTxCount === 0) {
        const n = await markPayrollReversedIfNotAlready(user.tenantId, id);
        if (n > 0) {
          cancelledSoft++;
          try {
            await prisma.auditLog.create({
              data: {
                action: 'PAYROLL_REVERSED',
                entityType: 'PAYROLL',
                entityId: id,
                userId: user.id,
                tenantId: user.tenantId,
                details: JSON.stringify({
                  mode: 'remove_entries_no_linked_transactions',
                  priorStatus: row.status,
                  reversalReason: reason,
                }),
              },
            });
          } catch (auditErr) {
            console.error('remove-entries soft audit (non-fatal):', auditErr?.message || auditErr);
          }
        } else {
          skippedReversed++;
        }
        continue;
      }

      let glState;
      try {
        glState = await resolvePostedPayrollJournalState(user.tenantId, id);
      } catch (glResolveErr) {
        console.error('remove-entries resolvePostedPayrollJournalState:', glResolveErr?.message || glResolveErr);
        const linkedAgain = await countTransactionsLinkedToPayroll(user.tenantId, id);
        if (linkedAgain === 0) {
          const n = await markPayrollReversedIfNotAlready(user.tenantId, id);
          if (n > 0) cancelledSoft++;
          else skippedReversed++;
        } else {
          blocked.push({
            id,
            reason: `Could not determine payroll journal state: ${glResolveErr?.message || 'unknown error'}`,
          });
        }
        continue;
      }

      if (glState.kind === 'multiple') {
        blocked.push({
          id,
          reason: 'Multiple payroll journals found for this payroll; resolve duplicates before removing.',
        });
        continue;
      }

      if (glState.kind === 'none' || glState.kind === 'empty_journal') {
        const n = await markPayrollReversedIfNotAlready(user.tenantId, id);
        if (n > 0) cancelledSoft++;
        else skippedReversed++;
        continue;
      }

      // Posted journal — full reversal (creates reversing GL + PAYROLL_REVERSAL audit inside service)
      try {
        await reversePayroll({
          payrollId: id,
          reversalReason: reason,
          userId: user.id,
          tenantId: user.tenantId,
        });
        cancelledJournal++;
      } catch (e) {
        const msg = String(e?.message || e || '').toLowerCase();
        const noJournalMsg =
          msg.includes('no posted journal') ||
          msg.includes('no posted journal transaction') ||
          msg.includes('cannot be performed without gl entries') ||
          msg.includes('has no journal entries to reverse') ||
          msg.includes('payroll journal transaction has no lines') ||
          msg.includes('reversal cannot be performed without gl');

        let again;
        try {
          again = await resolvePostedPayrollJournalState(user.tenantId, id);
        } catch {
          again = { kind: 'unknown' };
        }
        const allowSoftCancel =
          again.kind === 'none' ||
          again.kind === 'empty_journal' ||
          (noJournalMsg && again.kind !== 'multiple');

        if (allowSoftCancel) {
          const n2 = await markPayrollReversedIfNotAlready(user.tenantId, id);
          if (n2 > 0) cancelledSoft++;
          else skippedReversed++;
        } else {
          blocked.push({
            id,
            reason: e?.message || 'Payroll reversal failed',
          });
        }
      }
    }

    const cancelled = cancelledSoft + cancelledJournal;

    try {
      await prisma.auditLog.create({
        data: {
          action: 'PAYROLL_RUN_ENTRIES_REMOVED',
          entityType: 'PAYROLL',
          entityId: ids[0],
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            reason,
            requestedIds: ids.length,
            cancelled,
            cancelledSoft,
            cancelledJournal,
            skippedReversed,
            notFound,
            blockedCount: blocked.length,
            sampleBlocked: blocked.slice(0, 5),
          }),
        },
      });
    } catch (e) {
      console.error('remove-entries audit (non-fatal):', e?.message || e);
    }

    return NextResponse.json({
      ok: true,
      cancelled,
      cancelledSoft,
      cancelledJournal,
      skippedReversed,
      notFound,
      blocked,
      message:
        blocked.length === 0
          ? cancelledJournal > 0 && cancelledSoft === 0
            ? `Reversed ${cancelledJournal} posted payroll ${cancelledJournal === 1 ? 'entry' : 'entries'} (GL reversing journals created).`
            : cancelledJournal > 0
              ? `Completed ${cancelled} entr${cancelled === 1 ? 'y' : 'ies'} (${cancelledSoft} without journal, ${cancelledJournal} with GL reversal).`
              : `Removed or reversed ${cancelled} payroll ${cancelled === 1 ? 'entry' : 'entries'}.`
          : `Completed ${cancelled} entr${cancelled === 1 ? 'y' : 'ies'}; ${blocked.length} could not be processed (see blocked).`,
    });
  } catch (e) {
    console.error('POST /api/payroll/remove-entries:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to remove payroll entries' },
      { status: 500 }
    );
  }
}

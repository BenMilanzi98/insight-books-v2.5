/**
 * POST /api/payroll/remove-entries
 *
 * Cancels **unposted** payroll rows (Pending / Draft) in one request — no DELETE, no reversal service.
 * Use this for "remove payroll run" from the HR payroll UI instead of chaining DELETE /api/payroll/[id].
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

const MAX_IDS = 200;

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

    const reason =
      typeof body?.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : 'Payroll run removed (unposted rows)';

    const rows = await prisma.payroll.findMany({
      where: { id: { in: ids }, tenantId: user.tenantId },
      select: { id: true, status: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const blocked = [];
    let cancelled = 0;
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

      const st = String(row.status ?? '').trim().toLowerCase();
      if (st !== 'pending' && st !== 'draft') {
        blocked.push({
          id,
          reason:
            'Only Pending or Draft rows can be removed here. Posted payroll must use the reversal flow.',
        });
        continue;
      }

      const linked = await countTransactionsLinkedToPayroll(user.tenantId, id);
      if (linked > 0) {
        blocked.push({
          id,
          reason: 'This row has GL activity; remove it using payroll reversal instead.',
        });
        continue;
      }

      const n = await markPayrollReversedIfNotAlready(user.tenantId, id);
      if (n > 0) cancelled++;
      else skippedReversed++;
    }

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
      skippedReversed,
      notFound,
      blocked,
      message:
        blocked.length === 0
          ? `Removed ${cancelled} payroll ${cancelled === 1 ? 'entry' : 'entries'}.`
          : `Removed ${cancelled} entr${cancelled === 1 ? 'y' : 'ies'}; ${blocked.length} could not be removed (see blocked).`,
    });
  } catch (e) {
    console.error('POST /api/payroll/remove-entries:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to remove payroll entries' },
      { status: 500 }
    );
  }
}

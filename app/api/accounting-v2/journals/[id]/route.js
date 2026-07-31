/**
 * /api/accounting-v2/journals/[id]
 *
 * GET   — journal detail with lines and its accounting-event history.
 * PATCH — edit a DRAFT journal's description/lines (immutable once posted).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { updateManualJournalDraft } from '@/lib/accountingV2/application/manualJournalService.js';

export async function GET(request, { params }) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.JOURNAL_VIEW,
    ACCOUNTING_PERMISSIONS.POSTING_VIEW,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { id } = await params;
    const journal = await prisma.journalEntry.findFirst({
      where: { id, tenantId: context.businessId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }
    const events = await prisma.acctV2EventRegistry.findMany({
      where: {
        tenantId: context.businessId,
        OR: [
          { journalEntryId: id },
          { sourceType: 'JournalEntry', sourceId: id },
        ],
      },
      include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ journal, events });
  } catch (error) {
    return accountingErrorResponse(error, 'load journal');
  }
}

export async function PATCH(request, { params }) {
  const guard = await guardAccountingRoute(request, ACCOUNTING_PERMISSIONS.JOURNAL_CREATE);
  if (guard.response) return guard.response;
  const { context, can } = guard;

  try {
    const { id } = await params;
    const body = await request.json();
    const journal = await updateManualJournalDraft(
      context,
      id,
      {
        description: body.description,
        entryDate: body.entryDate,
        currency: body.currency,
        lines: body.lines,
        dimensions: body.dimensions,
      },
      { hasPermission: can }
    );
    return NextResponse.json({ journal });
  } catch (error) {
    return accountingErrorResponse(error, 'update journal draft');
  }
}

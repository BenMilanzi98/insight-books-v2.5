/**
 * /api/accounting-v2/journals — V2 manual/adjustment journal drafts.
 *
 * GET  — list V2-managed journals for the session business (paginated).
 * POST — create a manual or adjustment journal draft. The body carries
 *        description, entryDate, lines and (for adjustments) the adjustment
 *        block; posting-engine fields (mode, architecture version, business)
 *        are server-resolved and never accepted from the client.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { createManualJournalDraft } from '@/lib/accountingV2/application/manualJournalService.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.JOURNAL_VIEW,
    ACCOUNTING_PERMISSIONS.POSTING_VIEW,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const entryType = searchParams.get('entryType');
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 25)));

    const where = {
      tenantId: context.businessId,
      architectureVersion: 'ACCOUNTING_V2',
      ...(status ? { status } : {}),
      ...(entryType ? { entryType } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.journalEntry.count({ where }),
    ]);
    return NextResponse.json({ journals: rows, total, page, pageSize });
  } catch (error) {
    return accountingErrorResponse(error, 'list V2 journals');
  }
}

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.JOURNAL_CREATE,
    ACCOUNTING_PERMISSIONS.JOURNAL_CREATE_ADJUSTMENT,
  ]);
  if (guard.response) return guard.response;
  const { context, can } = guard;

  try {
    const body = await request.json();
    const journal = await createManualJournalDraft(
      context,
      {
        description: body.description,
        entryDate: body.entryDate,
        currency: body.currency,
        lines: body.lines,
        dimensions: body.dimensions,
        attachments: body.attachments,
        adjustment: body.adjustment ?? null,
      },
      { hasPermission: can }
    );
    return NextResponse.json({ journal }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create journal draft');
  }
}

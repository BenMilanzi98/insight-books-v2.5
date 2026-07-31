/**
 * /api/accounting-v2/ledger/journals — canonical journal explorer.
 *
 * GET — normalized journal list across BOTH stores (legacy transactions and
 * journal entries) under the canonical authority rule (no double listing).
 * Query params: status, entryType, sourceType, sourceId, journalKind,
 * startDate, endDate, branchId, search, includeNonPosted, includeMirrors,
 * page, pageSize. With ?id=… returns the full canonical journal detail with
 * lineage instead of a list.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  listCanonicalJournals,
  getCanonicalJournal,
} from '@/lib/accountingV2/ledger/journalQueryService.js';

function parseDate(value, label) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`Invalid ${label}: ${value}`), { httpStatus: 400 });
  }
  return date;
}

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.JOURNAL_VIEW,
    ACCOUNTING_PERMISSIONS.LEDGER_VIEW,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const journal = await getCanonicalJournal(prisma, context, { journalId: id });
      if (!journal) {
        return NextResponse.json({ error: 'Journal not found in this business.' }, { status: 404 });
      }
      return NextResponse.json({ journal });
    }

    const result = await listCanonicalJournals(prisma, context, {
      status: searchParams.get('status') || undefined,
      entryType: searchParams.get('entryType') || undefined,
      sourceType: searchParams.get('sourceType') || undefined,
      sourceId: searchParams.get('sourceId') || undefined,
      journalKind: searchParams.get('journalKind') || undefined,
      startDate: parseDate(searchParams.get('startDate'), 'startDate'),
      endDate: parseDate(searchParams.get('endDate'), 'endDate'),
      branchId: searchParams.get('branchId') || undefined,
      search: searchParams.get('search') || undefined,
      includeNonPosted: searchParams.get('includeNonPosted') === 'true',
      includeMirrors: searchParams.get('includeMirrors') === 'true',
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 25),
    });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'canonical journal list');
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import {
  createAndPostEntry,
  createDraftEntry,
} from '@/lib/journalService';
import { formatJournalEntries, applyMergeDisplayToJournalPayload } from '@/lib/journalEntryFormatter';
import {
  fetchTenantAccountsForMergeRollup,
  buildMergeRollupContext,
} from '@/lib/accountMergeRollup';
import { validateNoDuplicateInventoryLines } from '@/lib/journalManualLineValidation';

/**
 * Manual journal entries are restricted to adjustments only.
 * Example scenarios:
 * - Correction: Dr Office Expense, Cr Cash
 * - Accrual: Dr Utilities Expense, Cr Accrued Liabilities
 * - Opening Balance: Dr Cash, Cr Owner's Equity
 */
const ENTRY_INCLUDE = {
  lines: {
    orderBy: { lineNumber: 'asc' },
    include: {
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          code: true,
          name: true,
          type: true,
        },
      },
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  postedBy: {
    select: { id: true, name: true, email: true },
  },
};

const MANUAL_SOURCE_TYPES = ['Manual', 'ManualJournalEntry', 'ManualAdjustment'];
const ALLOWED_ENTRY_TYPES = ['Correction', 'Accrual', 'Opening Balance'];

function normalizeEntryType(value) {
  if (!value) return 'Correction';
  const normalized = value.toString().trim();
  if (normalized.toLowerCase() === 'openingbalance') return 'Opening Balance';
  return normalized;
}

function isFinanceAdmin(user) {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return (
    roleName.includes('finance') ||
    roleName.includes('admin') ||
    roleName === 'master_admin'
  );
}

function isTenantOwnerRole(user) {
  const rn = user?.role?.name?.toLowerCase() || '';
  return rn === 'owner';
}

function canViewJournalEntries(user) {
  return isFinanceAdmin(user) || isTenantOwnerRole(user) || hasPermission(user, 'journalEntries.view');
}

function canCreateJournalEntries(user) {
  return isFinanceAdmin(user) || isTenantOwnerRole(user) || hasPermission(user, 'journalEntries.create');
}

function buildWhereClause(tenantId, searchParams) {
  const where = { tenantId, AND: [] };

  const status = searchParams.get('status');
  if (status && status.toLowerCase() !== 'all' && status.toLowerCase() !== 'all status') {
    const normalized = status.toLowerCase();
    where.AND.push({
      status: normalized === 'posted' ? 'Posted' : normalized === 'draft' ? 'Draft' : status,
    });
  }

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.AND.push({ entryDate: dateFilter });
  }

  const search = searchParams.get('search');
  if (search) {
    where.AND.push({
      OR: [
        { description: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const sourceType = searchParams.get('sourceType');
  if (sourceType && sourceType.toLowerCase() !== 'all' && sourceType.toLowerCase() !== 'all types') {
    if (sourceType.toLowerCase() === 'manual') {
      where.AND.push({
        OR: [
          { sourceType: { in: MANUAL_SOURCE_TYPES } },
          { sourceType: null },
          { sourceType: '' },
        ],
      });
    } else {
      where.AND.push({ sourceType });
    }
  } else {
    where.AND.push({
      OR: [
        { sourceType: { in: MANUAL_SOURCE_TYPES } },
        { sourceType: null },
        { sourceType: '' },
      ],
    });
  }

  return where;
}

/**
 * Build where for Transaction (legacy) entries.
 * When includeAllSourceTypes is true, do not filter by sourceType so Invoice, Sale, Reversal all appear.
 */
function buildLegacyTransactionWhere(tenantId, searchParams, includeAllSourceTypes = false) {
  const where = { tenantId, AND: [] };

  const status = searchParams.get('status');
  if (status && status.toLowerCase() !== 'all' && status.toLowerCase() !== 'all status') {
    const normalized = status.toLowerCase();
    where.AND.push({
      status: normalized === 'posted' ? 'posted' : normalized === 'draft' ? 'draft' : status,
    });
  }

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.AND.push({ date: dateFilter });
  }

  const search = searchParams.get('search');
  if (search) {
    where.AND.push({
      OR: [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (!includeAllSourceTypes) {
    const sourceType = searchParams.get('sourceType');
    if (sourceType && sourceType.toLowerCase() !== 'all' && sourceType.toLowerCase() !== 'all types') {
      if (sourceType.toLowerCase() === 'manual') {
        where.AND.push({
          OR: [
            { sourceType: { in: MANUAL_SOURCE_TYPES } },
            { sourceType: null },
            { sourceType: '' },
          ],
        });
      } else {
        where.AND.push({ sourceType });
      }
    } else {
      where.AND.push({
        OR: [
          { sourceType: { in: MANUAL_SOURCE_TYPES } },
          { sourceType: null },
          { sourceType: '' },
        ],
      });
    }
  }

  return where;
}

function normalizeLines(lines = [], fallbackDescription) {
  return lines
    .filter((line) => !!line.accountId)
    .map((line) => {
      const debit = Number(
        line.debitAmount ?? line.debit ?? line.debit_value ?? 0
      );
      const credit = Number(
        line.creditAmount ?? line.credit ?? line.credit_value ?? 0
      );

      return {
        accountId: line.accountId,
        description: line.description || fallbackDescription || null,
        debitAmount: Number.isFinite(debit) ? debit : 0,
        creditAmount: Number.isFinite(credit) ? credit : 0,
      };
    });
}

function resolveEntryDate(body) {
  if (body.entryDate) return new Date(body.entryDate);
  if (body.date) return new Date(body.date);
  return new Date();
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!canViewJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to view journal entries.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '10', 10))
    );
    const skip = (page - 1) * limit;

    const mergeRollupRows = await fetchTenantAccountsForMergeRollup(user.tenantId, prisma);
    const mergeJournalCtx = buildMergeRollupContext(mergeRollupRows);

    const where = buildWhereClause(user.tenantId, searchParams);
    const sortBy = searchParams.get('sortBy') || 'entryDate';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const sourceType = searchParams.get('sourceType');
    const isAllSourceTypes = !sourceType || sourceType.toLowerCase() === 'all' || sourceType.toLowerCase() === 'all types';

    let orderBy;
    if (sortBy === 'referenceNumber' || sortBy === 'reference') {
      orderBy = { referenceNumber: sortOrder };
    } else {
      orderBy = { entryDate: sortOrder };
    }

    // When "all" source types: merge JournalEntry (manual) + Transaction (Invoice, Sale, Reversal, etc.) so reversals show
    const MERGE_CAP = 3000;
    if (isAllSourceTypes) {
      const legacyWhere = buildLegacyTransactionWhere(user.tenantId, searchParams, true);
      const [journalEntries, legacyTransactions] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          orderBy,
          take: MERGE_CAP,
          include: ENTRY_INCLUDE,
        }),
        prisma.transaction.findMany({
          where: legacyWhere,
          orderBy: { date: sortOrder },
          take: MERGE_CAP,
          include: ENTRY_INCLUDE,
        }),
      ]);
      // De-duplicate: if a JournalEntry mirrors a Transaction (has transactionId),
      // keep the JournalEntry version and skip the Transaction duplicate.
      const mirroredTxIds = new Set(
        journalEntries.filter((e) => e.transactionId).map((e) => e.transactionId)
      );
      const merged = [
        ...journalEntries.map((e) => ({ ...e, _sortDate: e.entryDate || e.createdAt })),
        ...legacyTransactions
          .filter((t) => !mirroredTxIds.has(t.id))
          .map((t) => ({ ...t, _sortDate: t.date || t.createdAt })),
      ];
      merged.sort((a, b) => {
        const da = new Date(a._sortDate || 0).getTime();
        const db = new Date(b._sortDate || 0).getTime();
        return sortOrder === 'asc' ? da - db : db - da;
      });
      const total = merged.length;
      const entries = merged.slice(skip, skip + limit);
      return NextResponse.json({
        entries: applyMergeDisplayToJournalPayload(formatJournalEntries(entries), mergeJournalCtx),
        pagination: {
          page,
          limit,
          totalCount: total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    const [totalCount, entriesRaw] = await Promise.all([
      prisma.journalEntry.count({ where }),
      prisma.journalEntry.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: ENTRY_INCLUDE,
      }),
    ]);

    let entries = entriesRaw;
    let total = totalCount;

    if (entriesRaw.length === 0) {
      const legacyWhere = buildLegacyTransactionWhere(user.tenantId, searchParams, false);
      const [legacyCount, legacyEntries] = await Promise.all([
        prisma.transaction.count({ where: legacyWhere }),
        prisma.transaction.findMany({
          where: legacyWhere,
          orderBy: { date: sortOrder },
          skip,
          take: limit,
          include: ENTRY_INCLUDE,
        }),
      ]);

      entries = legacyEntries;
      total = legacyCount;
    }

    return NextResponse.json({
      entries: applyMergeDisplayToJournalPayload(formatJournalEntries(entries), mergeJournalCtx),
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json(
      {
        error: 'Failed to load journal entries',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!canCreateJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to create journal entries.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const lines = normalizeLines(body.lines, body.description);
    const entryDate = resolveEntryDate(body);
    const entryType = normalizeEntryType(body.entryType);

    if (!body.description || body.description.trim().length < 3) {
      return NextResponse.json(
        { error: 'A reason/description is required for journal entries.' },
        { status: 400 }
      );
    }

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'At least two lines are required for a journal entry.' },
        { status: 400 }
      );
    }

    const lineAccountIds = [...new Set(lines.map((l) => l.accountId))];
    const lineAccounts = await prisma.account.findMany({
      where: { tenantId: user.tenantId, id: { in: lineAccountIds } },
      select: {
        id: true,
        accountCode: true,
        code: true,
        accountName: true,
        name: true,
        accountType: true,
        type: true,
        accountSubtype: true,
      },
    });
    const invDup = validateNoDuplicateInventoryLines(lines, lineAccounts);
    if (!invDup.ok) {
      return NextResponse.json(
        { error: invDup.error, details: invDup.details },
        { status: 400 }
      );
    }

    if (!ALLOWED_ENTRY_TYPES.includes(entryType)) {
      return NextResponse.json(
        { error: `Unsupported journal entry type: ${entryType}.` },
        { status: 400 }
      );
    }

    if (entryType === 'Opening Balance') {
      const [postedTransactions, postedEntries] = await Promise.all([
        prisma.transaction.count({
          where: { tenantId: user.tenantId, status: 'posted' },
        }),
        prisma.journalEntry.count({
          where: { tenantId: user.tenantId, status: 'Posted' },
        }),
      ]);

      if ((postedTransactions > 0 || postedEntries > 0) && !body.forceOpeningBalance) {
        return NextResponse.json(
          {
            error:
              'Opening balance entries are restricted to initial setup or explicitly authorized periods.',
            details:
              'Existing posted transactions were found. If this is an authorized opening balance, provide forceOpeningBalance=true.',
          },
          { status: 400 }
        );
      }
    }

    if (body.currency) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { currencyCode: true },
      });
      if (tenant?.currencyCode && body.currency !== tenant.currencyCode) {
        return NextResponse.json(
          {
            error: 'Multi-currency journal entries are not supported.',
            details: `Expected currency ${tenant.currencyCode}.`,
          },
          { status: 400 }
        );
      }
    }

    const accountIds = lines.map((line) => line.accountId);
    const taxTypes = await prisma.taxType.findMany({
      where: {
        tenantId: user.tenantId,
        accountId: { in: accountIds },
      },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
          },
        },
      },
    });

    if (taxTypes.length > 0) {
      const taxAccountNames = taxTypes
        .map((tt) => tt.account.accountName || 'Unknown')
        .join(', ');
      return NextResponse.json(
        {
          error:
            'Manual journal entries to tax accounts are not allowed. Tax accounts must be posted automatically via the tax system.',
          details: `Tax accounts detected: ${taxAccountNames}. Please use the tax management system to post taxes.`,
        },
        { status: 400 }
      );
    }

    if (body.clientRequestId) {
      const existing = await prisma.journalEntry.findFirst({
        where: {
          tenantId: user.tenantId,
          sourceType: { in: MANUAL_SOURCE_TYPES },
          sourceId: body.clientRequestId,
        },
        include: ENTRY_INCLUDE,
      });

      if (existing) {
        return NextResponse.json({
          message: 'Journal entry already created.',
          entry: formatJournalEntries([existing])[0],
        });
      }
    }

    const shouldPost = (body.status || '').toLowerCase() === 'posted';
    const payload = {
      tenantId: user.tenantId,
      entryDate,
      description: body.description,
      entryType,
      sourceType: 'Manual',
      sourceId: body.clientRequestId || null,
      notes: body.notes || body.internalReference || null,
      lines,
    };

    const entry = shouldPost
      ? await createAndPostEntry(payload, { userId: user.id, tenantId: user.tenantId })
      : await createDraftEntry(payload, { userId: user.id, tenantId: user.tenantId });

    const hydratedEntry = await prisma.journalEntry.findUnique({
      where: { id: entry.id },
      include: ENTRY_INCLUDE,
    });

    return NextResponse.json(
      {
        message: shouldPost
          ? 'Journal entry posted successfully.'
          : 'Journal entry saved as draft.',
        entry: formatJournalEntries([hydratedEntry])[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to create journal entry',
      },
      { status: 400 }
    );
  }
}
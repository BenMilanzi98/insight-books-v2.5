// app/api/general-ledger/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getParallelGoodsReceiptTransactionIds } from '@/lib/generalLedgerGoodsReceiptDedup';
import {
  fetchTenantAccountsForMergeRollup,
  buildMergeRollupContext,
} from '@/lib/accountMergeRollup';
import { bootstrapReportRoute, tenantNameMap } from '@/lib/reportRouteBootstrap';

const toDateRange = (startDate, endDate) => {
  const range = {};
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    range.gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return range;
};

const getNormalBalance = (accountType, normalBalance) => {
  const normal = (normalBalance || '').toString().toLowerCase();
  if (normal === 'debit' || normal === 'credit') return normal;
  const type = (accountType || '').toLowerCase();
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
};

// GET - Fetch general ledger transactions with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const {
      tenantIds,
      tenants,
      scope,
      primaryTenantId,
      reportBranchId,
      tw,
    } = boot;
    const multiTenant = tenantIds.length > 1;
    const nameByTenantId = tenantNameMap(tenants);

    const excludeParallelGrTxIds = [];
    for (const tid of tenantIds) {
      const ids = await getParallelGoodsReceiptTransactionIds(tid, prisma);
      excludeParallelGrTxIds.push(...ids);
    }
    const uniqueExcludeIds = [...new Set(excludeParallelGrTxIds)];
    const transactionIdNotInParallelGr =
      uniqueExcludeIds.length > 0 ? { id: { notIn: uniqueExcludeIds } } : {};
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;
    
    // Date range parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchIdParam = searchParams.get('branchId');
    const branchId =
      branchIdParam === 'all' || branchIdParam === '' ? null :
      (branchIdParam ?? reportBranchId ?? null);
    
    // Filtering parameters
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const reference = searchParams.get('reference');
    const balanceType = searchParams.get('balanceType'); // 'debit', 'credit', or 'all'
    const reversalFilter = (searchParams.get('reversalFilter') || 'all').toLowerCase();
    const reversalTxnClause =
      reversalFilter === 'exclude'
        ? { isReversal: false }
        : reversalFilter === 'only'
          ? { isReversal: true }
          : {};
    
    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const dateRange = toDateRange(startDate, endDate);

    const mergeRollupRows = multiTenant
      ? []
      : await fetchTenantAccountsForMergeRollup(primaryTenantId, prisma);
    const mergeRollupCtx = buildMergeRollupContext(mergeRollupRows);
    const ledgerAccountIds =
      !multiTenant && accountId && accountId !== 'all'
        ? mergeRollupCtx.allIdsRollingInto(mergeRollupCtx.survivorOf(accountId))
        : null;

    const journalWhere = {
      ...(ledgerAccountIds ? { accountId: { in: ledgerAccountIds } } : {}),
      ...(balanceType === 'debit' ? { debitAmount: { gt: 0 } } : {}),
      ...(balanceType === 'credit' ? { creditAmount: { gt: 0 } } : {}),
      journalEntry: {
        ...tw,
        status: { in: ['Posted', 'posted'] },
        /** Exclude mirrored system journals — those lines live on TransactionLine already. */
        transactionId: null,
        ...(Object.keys(dateRange).length > 0 ? { entryDate: dateRange } : {}),
        ...(branchId ? { branchId } : {}),
        ...(reference ? {
          OR: [
            { referenceNumber: { contains: reference, mode: 'insensitive' } },
            { description: { contains: reference, mode: 'insensitive' } },
          ]
        } : {}),
      },
      ...(search ? {
        OR: [
          { journalEntry: { description: { contains: search, mode: 'insensitive' } } },
          { journalEntry: { referenceNumber: { contains: search, mode: 'insensitive' } } },
          { account: { accountName: { contains: search, mode: 'insensitive' } } },
          { account: { accountCode: { contains: search, mode: 'insensitive' } } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      } : {}),
    };

    const transactionWhere = {
      ...(ledgerAccountIds ? { accountId: { in: ledgerAccountIds } } : {}),
      ...(balanceType === 'debit' ? { debitAmount: { gt: 0 } } : {}),
      ...(balanceType === 'credit' ? { creditAmount: { gt: 0 } } : {}),
      transaction: {
        ...tw,
        status: { in: ['posted', 'Posted'] },
        ...transactionIdNotInParallelGr,
        ...reversalTxnClause,
        ...(Object.keys(dateRange).length > 0 ? { date: dateRange } : {}),
        ...(branchId ? { branchId } : {}),
        ...(reference ? {
          OR: [
            { reference: { contains: reference, mode: 'insensitive' } },
            { description: { contains: reference, mode: 'insensitive' } },
          ]
        } : {}),
      },
      ...(search ? {
        OR: [
          { transaction: { description: { contains: search, mode: 'insensitive' } } },
          { transaction: { reference: { contains: search, mode: 'insensitive' } } },
          { account: { accountName: { contains: search, mode: 'insensitive' } } },
          { account: { accountCode: { contains: search, mode: 'insensitive' } } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      } : {}),
    };

    const [journalLines, transactionLines] = await Promise.all([
      prisma.journalEntryLine.findMany({
        where: journalWhere,
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              code: true,
              name: true,
              accountType: true,
              type: true,
              normalBalance: true,
            },
          },
          journalEntry: { select: { id: true, entryDate: true, referenceNumber: true, description: true, branchId: true, sourceType: true, sourceId: true, tenantId: true } },
        },
      }),
      prisma.transactionLine.findMany({
        where: transactionWhere,
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              code: true,
              name: true,
              accountType: true,
              type: true,
              normalBalance: true,
            },
          },
          transaction: {
            select: {
              id: true,
              date: true,
              reference: true,
              description: true,
              branchId: true,
              sourceType: true,
              sourceId: true,
              tenantId: true,
              isReversal: true,
              entryType: true,
              reversedTransactionId: true,
              reversalReason: true,
              reversedAt: true,
              reversedById: true,
              notes: true,
            },
          },
        },
      }),
    ]);
    
    let openingBalance = null;
    let running = 0;
    if (!multiTenant && accountId && accountId !== 'all' && startDate) {
      const openingDate = new Date(startDate);
      openingDate.setHours(0, 0, 0, 0);
      const survivorId = mergeRollupCtx.survivorOf(accountId);
      const [openingJournal, openingTransaction, acc] = await Promise.all([
        prisma.journalEntryLine.aggregate({
          where: {
            ...journalWhere,
            ...(ledgerAccountIds ? { accountId: { in: ledgerAccountIds } } : {}),
            journalEntry: {
              ...journalWhere.journalEntry,
              entryDate: { lt: openingDate },
            },
          },
          _sum: { debitAmount: true, creditAmount: true },
        }),
        prisma.transactionLine.aggregate({
          where: {
            ...transactionWhere,
            ...(ledgerAccountIds ? { accountId: { in: ledgerAccountIds } } : {}),
            transaction: {
              ...transactionWhere.transaction,
              date: { lt: openingDate },
            },
          },
          _sum: { debitAmount: true, creditAmount: true },
        }),
        prisma.account.findUnique({
          where: { id: survivorId },
          select: { accountType: true, normalBalance: true, type: true },
        }),
      ]);
      const deb = (openingJournal._sum.debitAmount || 0) + (openingTransaction._sum.debitAmount || 0);
      const cre = (openingJournal._sum.creditAmount || 0) + (openingTransaction._sum.creditAmount || 0);
      const normal = getNormalBalance(acc?.accountType || acc?.type, acc?.normalBalance);
      openingBalance = normal === 'debit' ? (deb - cre) : (cre - deb);
      running = openingBalance;
    }

    const mapGlLine = (line, entryType, extras, rowTenantId) => {
      const d = multiTenant ? null : mergeRollupCtx.displayFieldsForPostingAccountId(line.accountId);
      const orig = line.account;
      const postingCode = orig?.accountCode || orig?.code || '';
      const postingName = orig?.accountName || orig?.name || '';
      const survAcc = d?.displayAccountId ? mergeRollupCtx.byId.get(d.displayAccountId) : null;
      const displayType = survAcc?.accountType || survAcc?.type || orig?.accountType || orig?.type || '';
      const displayNormal = survAcc?.normalBalance || orig?.normalBalance || null;
      return {
        id: line.id,
        ...extras,
        entryType,
        accountId: line.accountId,
        postingAccountId: line.accountId,
        postingAccountCode: (d?.postingAccountCode ?? postingCode) || null,
        postingAccountName: (d?.postingAccountName ?? postingName) || null,
        displayAccountId: d?.displayAccountId ?? line.accountId,
        accountCode: d?.displayAccountCode ?? postingCode,
        accountName: d?.displayAccountName ?? postingName,
        accountType: displayType,
        normalBalance: displayNormal,
        debit: line.debitAmount || 0,
        credit: line.creditAmount || 0,
        ...(multiTenant && rowTenantId
          ? { tenantId: rowTenantId, businessName: nameByTenantId.get(rowTenantId) || rowTenantId }
          : {}),
      };
    };

    const combined = [
      ...journalLines.map((line) =>
        mapGlLine(line, 'JournalEntry', {
          transactionId: line.journalEntryId,
          date: line.journalEntry?.entryDate ? new Date(line.journalEntry.entryDate).toISOString() : null,
          description: line.journalEntry?.description || line.description || '',
          reference: line.journalEntry?.referenceNumber || '',
          sourceType: line.journalEntry?.sourceType || 'JournalEntry',
          sourceId: line.journalEntry?.sourceId || null,
        }, line.journalEntry?.tenantId)
      ),
      ...transactionLines.map((line) =>
        mapGlLine(line, line.transaction?.entryType || 'Transaction', {
          transactionId: line.transactionId,
          isReversal: line.transaction?.isReversal ?? false,
          reversedTransactionId: line.transaction?.reversedTransactionId || null,
          reversalReason: line.transaction?.reversalReason || null,
          reversedAt: line.transaction?.reversedAt || null,
          reversedById: line.transaction?.reversedById || null,
          reversalStatus: line.transaction?.isReversal
            ? 'Reversal'
            : line.transaction?.reversedAt
              ? 'Reversed'
              : 'Active',
          date: line.transaction?.date ? new Date(line.transaction.date).toISOString() : null,
          description: line.transaction?.description || line.description || '',
          reference: line.transaction?.reference || '',
          sourceType: line.transaction?.sourceType || 'Transaction',
          sourceId: line.transaction?.sourceId || null,
        }, line.transaction?.tenantId)
      ),
    ];

    combined.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return sortOrder.toLowerCase() === 'asc' ? dateA - dateB : dateB - dateA;
    });

    const transactions = combined.map((entry) => {
      if (!multiTenant && accountId && accountId !== 'all') {
        const normal = getNormalBalance(entry.accountType, entry.normalBalance);
        const delta = normal === 'debit' ? (entry.debit - entry.credit) : (entry.credit - entry.debit);
        running += delta;
        return { ...entry, balance: running };
      }
      return { ...entry, balance: null };
    });

    const totalCount = transactions.length;
    const paginated = transactions.slice(skip, skip + limit);

    const [journalTotals, transactionTotals] = await Promise.all([
      prisma.journalEntryLine.aggregate({
        where: journalWhere,
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.transactionLine.aggregate({
        where: transactionWhere,
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);
    
    // Return the formatted response
    const totalPages = Math.ceil(totalCount / limit);
    return NextResponse.json({
      scope,
      transactions: paginated,
      openingBalance,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      },
      totalCount,
      totalPages,
      totalDebits: (journalTotals._sum.debitAmount || 0) + (transactionTotals._sum.debitAmount || 0),
      totalCredits: (journalTotals._sum.creditAmount || 0) + (transactionTotals._sum.creditAmount || 0)
    });
    
  } catch (error) {
    console.error('Error fetching general ledger transactions:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch general ledger data. Please try again.' },
      { status: 500 }
    );
  }
}

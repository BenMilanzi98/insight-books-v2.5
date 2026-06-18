// app/api/general-ledger/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';
import { getParallelGoodsReceiptTransactionIds } from '@/lib/generalLedgerGoodsReceiptDedup';
import {
  getSourceDocumentLabel,
  humanizeSourceType,
  resolveReversedEntryLabelsBatch,
  resolveSourceDocumentLabelsBatch,
} from '@/lib/userFacingLabels';
import { bootstrapReportRoute, tenantNameMap } from '@/lib/reportRouteBootstrap';
import { buildExportHeaderRows } from '@/lib/reportExportScope';

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

export async function GET(request) {
  try {
    const permissionCheck = await requirePermission(request, "generalLedger.export");
    if (permissionCheck) {
      return permissionCheck;
    }

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
    
    // Format parameter
    const format = searchParams.get('format') || 'csv';
    
    // Date range parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Filtering parameters
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    
    const branchIdParam = searchParams.get('branchId');
    const branchId =
      branchIdParam === 'all' || branchIdParam === '' ? null :
      (branchIdParam ?? reportBranchId ?? null);

    const reversalFilter = (searchParams.get('reversalFilter') || 'all').toLowerCase();
    const reversalTxnClause =
      reversalFilter === 'exclude'
        ? { isReversal: false }
        : reversalFilter === 'only'
          ? { isReversal: true }
          : {};

    const dateRange = toDateRange(startDate, endDate);

    const journalWhere = {
      ...(accountId && accountId !== 'all' ? { accountId } : {}),
      journalEntry: {
        ...tw,
        status: { in: ['Posted', 'posted'] },
        ...(Object.keys(dateRange).length > 0 ? { entryDate: dateRange } : {}),
        ...(branchId ? { branchId } : {}),
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
      ...(accountId && accountId !== 'all' ? { accountId } : {}),
      transaction: {
        ...tw,
        status: { in: ['posted', 'Posted'] },
        ...transactionIdNotInParallelGr,
        ...reversalTxnClause,
        ...(Object.keys(dateRange).length > 0 ? { date: dateRange } : {}),
        ...(branchId ? { branchId } : {}),
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
          account: { select: { accountCode: true, accountName: true, accountType: true, normalBalance: true } },
          journalEntry: {
            select: {
              entryDate: true,
              referenceNumber: true,
              description: true,
              sourceType: true,
              sourceId: true,
              tenantId: true,
            },
          },
        },
        orderBy: { journalEntry: { entryDate: 'asc' } },
      }),
      prisma.transactionLine.findMany({
        where: transactionWhere,
        include: {
          account: { select: { accountCode: true, accountName: true, accountType: true, normalBalance: true } },
          transaction: {
            select: {
              id: true,
              date: true,
              reference: true,
              description: true,
              sourceType: true,
              sourceId: true,
              tenantId: true,
              entryType: true,
              isReversal: true,
              reversalReason: true,
              reversedTransactionId: true,
              notes: true,
            },
          },
        },
        orderBy: { transaction: { date: 'asc' } },
      }),
    ]);

    let running = 0;
    let openingBalance = null;
    if (!multiTenant && accountId && accountId !== 'all' && startDate) {
      const openingDate = new Date(startDate);
      openingDate.setHours(0, 0, 0, 0);
      const [openingJournal, openingTransaction, acc] = await Promise.all([
        prisma.journalEntryLine.aggregate({
          where: {
            ...journalWhere,
            accountId,
            journalEntry: { ...journalWhere.journalEntry, entryDate: { lt: openingDate } },
          },
          _sum: { debitAmount: true, creditAmount: true },
        }),
        prisma.transactionLine.aggregate({
          where: {
            ...transactionWhere,
            accountId,
            transaction: { ...transactionWhere.transaction, date: { lt: openingDate } },
          },
          _sum: { debitAmount: true, creditAmount: true },
        }),
        prisma.account.findUnique({
          where: { id: accountId },
          select: { accountType: true, normalBalance: true },
        }),
      ]);
      const deb = (openingJournal._sum.debitAmount || 0) + (openingTransaction._sum.debitAmount || 0);
      const cre = (openingJournal._sum.creditAmount || 0) + (openingTransaction._sum.creditAmount || 0);
      const normal = getNormalBalance(acc?.accountType, acc?.normalBalance);
      openingBalance = normal === 'debit' ? (deb - cre) : (cre - deb);
      running = openingBalance;
    }

    const combined = [
      ...journalLines.map((l) => ({
        date: l.journalEntry?.entryDate || null,
        reference: l.journalEntry?.referenceNumber || '',
        description: l.journalEntry?.description || l.description || '',
        lineDescription: l.description || '',
        accountCode: l.account?.accountCode || '',
        accountName: l.account?.accountName || '',
        accountType: l.account?.accountType || '',
        debit: l.debitAmount || 0,
        credit: l.creditAmount || 0,
        recordKind: 'JournalEntry',
        transactionId: l.journalEntryId || '',
        sourceType: l.journalEntry?.sourceType || '',
        sourceId: l.journalEntry?.sourceId || '',
        entryType: '',
        isReversal: false,
        reversalReason: '',
        reversedTransactionId: '',
        reversalNotes: '',
        tenantId: l.journalEntry?.tenantId || primaryTenantId,
      })),
      ...transactionLines.map((l) => ({
        date: l.transaction?.date || null,
        reference: l.transaction?.reference || '',
        description: l.transaction?.description || l.description || '',
        lineDescription: l.description || '',
        accountCode: l.account?.accountCode || '',
        accountName: l.account?.accountName || '',
        accountType: l.account?.accountType || '',
        debit: l.debitAmount || 0,
        credit: l.creditAmount || 0,
        recordKind: 'GLTransaction',
        transactionId: l.transaction?.id || l.transactionId || '',
        sourceType: l.transaction?.sourceType || '',
        sourceId: l.transaction?.sourceId || '',
        entryType: l.transaction?.entryType || '',
        isReversal: !!l.transaction?.isReversal,
        reversalReason: l.transaction?.reversalReason || '',
        reversedTransactionId: l.transaction?.reversedTransactionId || '',
        reversalNotes: l.transaction?.notes || '',
        tenantId: l.transaction?.tenantId || primaryTenantId,
      })),
    ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const sourceLabels = await resolveSourceDocumentLabelsBatch(
      prisma,
      primaryTenantId,
      combined.map((l) => ({ sourceType: l.sourceType, sourceId: l.sourceId }))
    );
    const reversedLabels = await resolveReversedEntryLabelsBatch(
      prisma,
      primaryTenantId,
      combined.map((l) => l.reversedTransactionId).filter(Boolean)
    );

    const exportHeaderRows = buildExportHeaderRows(scope, { startDate, endDate });

    const exportData = combined.map((l) => {
      let balance = '';
      if (!multiTenant && accountId && accountId !== 'all') {
        const normal = getNormalBalance(l.accountType, null);
        const delta = normal === 'debit' ? (l.debit - l.credit) : (l.credit - l.debit);
        running += delta;
        balance = running.toFixed(2);
      }

      const formattedDate = l.date ? new Date(l.date).toISOString().split('T')[0] : '';
      const row = {
        Date: formattedDate,
        Reference: l.reference || '',
        Description: l.description || '',
        'Line description': l.lineDescription || '',
        'Account Code': l.accountCode || '',
        'Account Name': l.accountName || '',
        'Account Type': l.accountType || '',
        Debit: l.debit > 0 ? l.debit.toFixed(2) : '',
        Credit: l.credit > 0 ? l.credit.toFixed(2) : '',
        Balance: balance,
        'Record kind': l.recordKind || '',
        'Source': getSourceDocumentLabel(sourceLabels, l.sourceType, l.sourceId, l.reference || ''),
        'Source type': humanizeSourceType(l.sourceType),
        'Entry type': l.entryType || '',
        'Is reversal': l.isReversal ? 'Yes' : 'No',
        'Reversal reason': l.reversalReason || '',
        'Reverses': l.reversedTransactionId
          ? reversedLabels.get(l.reversedTransactionId) || 'Original entry'
          : '',
        Notes: l.reversalNotes || '',
      };
      if (multiTenant) {
        row.Business = nameByTenantId.get(l.tenantId) || l.tenantId;
      }
      return row;
    });
    
    if (format === 'csv') {
      const csvColumns = [
        ...(multiTenant ? [{ id: 'Business', title: 'Business' }] : []),
        { id: 'Date', title: 'Date' },
        { id: 'Reference', title: 'Reference' },
        { id: 'Description', title: 'Description' },
        { id: 'Line description', title: 'Line description' },
        { id: 'Account Code', title: 'Account Code' },
        { id: 'Account Name', title: 'Account Name' },
        { id: 'Account Type', title: 'Account Type' },
        { id: 'Debit', title: 'Debit' },
        { id: 'Credit', title: 'Credit' },
        { id: 'Balance', title: 'Balance' },
        { id: 'Record kind', title: 'Record kind' },
        { id: 'Source', title: 'Source' },
        { id: 'Source type', title: 'Source type' },
        { id: 'Entry type', title: 'Entry type' },
        { id: 'Is reversal', title: 'Is reversal' },
        { id: 'Reversal reason', title: 'Reversal reason' },
        { id: 'Reverses', title: 'Reverses' },
        { id: 'Notes', title: 'Notes' },
      ];

      const csvStringifier = createObjectCsvStringifier({ header: csvColumns });
      const headerBlock = exportHeaderRows
        .map((r) => `"${r.label}","${String(r.value).replace(/"/g, '""')}"`)
        .join('\n');
      const csvData =
        `${headerBlock}\n\n` +
        csvStringifier.getHeaderString() +
        csvStringifier.stringifyRecords(exportData);
      
      // Generate filename with date range
      const filename = `general_ledger_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
      
      // Set headers for file download
      return new Response(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } else {
      // For other formats, return JSON (can be expanded to support other formats like PDF)
      return NextResponse.json(
        { scope, data: exportData },
        { status: 200 }
      );
    }
    
  } catch (error) {
    console.error('Error exporting general ledger data:', error);
    return NextResponse.json(
      { error: 'Failed to export general ledger data. Please try again.' },
      { status: 500 }
    );
  }
}
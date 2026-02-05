// app/api/general-ledger/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';

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
    // Check for authentication and permissions
    const permissionCheck = await requirePermission(request, "generalLedger.export");
    if (permissionCheck) {
      return permissionCheck; // Returns 401 or 403 response if not authorized
    }

    const user = await getUserFromSession(request);
    const tenantId = user.tenantId;
    
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
      (branchIdParam ?? user.currentBranchId ?? null);

    const dateRange = toDateRange(startDate, endDate);

    const journalWhere = {
      ...(accountId && accountId !== 'all' ? { accountId } : {}),
      journalEntry: {
        tenantId,
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
        tenantId,
        status: 'posted',
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
          journalEntry: { select: { entryDate: true, referenceNumber: true, description: true } },
        },
        orderBy: { journalEntry: { entryDate: 'asc' } },
      }),
      prisma.transactionLine.findMany({
        where: transactionWhere,
        include: {
          account: { select: { accountCode: true, accountName: true, accountType: true, normalBalance: true } },
          transaction: { select: { date: true, reference: true, description: true } },
        },
        orderBy: { transaction: { date: 'asc' } },
      }),
    ]);

    let running = 0;
    let openingBalance = null;
    if (accountId && accountId !== 'all' && startDate) {
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
        accountCode: l.account?.accountCode || '',
        accountName: l.account?.accountName || '',
        accountType: l.account?.accountType || '',
        debit: l.debitAmount || 0,
        credit: l.creditAmount || 0,
      })),
      ...transactionLines.map((l) => ({
        date: l.transaction?.date || null,
        reference: l.transaction?.reference || '',
        description: l.transaction?.description || l.description || '',
        accountCode: l.account?.accountCode || '',
        accountName: l.account?.accountName || '',
        accountType: l.account?.accountType || '',
        debit: l.debitAmount || 0,
        credit: l.creditAmount || 0,
      })),
    ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const exportData = combined.map((l) => {
      let balance = '';
      if (accountId && accountId !== 'all') {
        const normal = getNormalBalance(l.accountType, null);
        const delta = normal === 'debit' ? (l.debit - l.credit) : (l.credit - l.debit);
        running += delta;
        balance = running.toFixed(2);
      }

      const formattedDate = l.date ? new Date(l.date).toISOString().split('T')[0] : '';
      return {
        Date: formattedDate,
        Reference: l.reference || '',
        Description: l.description || '',
        'Account Code': l.accountCode || '',
        'Account Name': l.accountName || '',
        'Account Type': l.accountType || '',
        Debit: l.debit > 0 ? l.debit.toFixed(2) : '',
        Credit: l.credit > 0 ? l.credit.toFixed(2) : '',
        Balance: balance,
      };
    });
    
    if (format === 'csv') {
      // Create CSV headers
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'Date', title: 'Date' },
          { id: 'Reference', title: 'Reference' },
          { id: 'Description', title: 'Description' },
          { id: 'Account Code', title: 'Account Code' },
          { id: 'Account Name', title: 'Account Name' },
          { id: 'Account Type', title: 'Account Type' },
          { id: 'Debit', title: 'Debit' },
          { id: 'Credit', title: 'Credit' },
          { id: 'Balance', title: 'Balance' }
        ]
      });
      
      // Generate CSV string
      const csvData = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(exportData);
      
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
        { data: exportData },
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
// app/api/general-ledger/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';

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

    const whereConditions = {
      journalEntry: {
        tenantId,
        status: 'Posted',
        ...(branchId ? { branchId } : {}),
      },
    };

    if (startDate || endDate) {
      whereConditions.journalEntry.entryDate = {};
      if (startDate) whereConditions.journalEntry.entryDate.gte = new Date(startDate);
      if (endDate) whereConditions.journalEntry.entryDate.lte = new Date(endDate);
    }

    if (accountId && accountId !== 'all') {
      whereConditions.accountId = accountId;
    }

    if (search) {
      whereConditions.OR = [
        { journalEntry: { description: { contains: search, mode: 'insensitive' } } },
        { journalEntry: { referenceNumber: { contains: search, mode: 'insensitive' } } },
        { account: { accountName: { contains: search, mode: 'insensitive' } } },
        { account: { accountCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const lines = await prisma.journalEntryLine.findMany({
      where: whereConditions,
      include: {
        account: { select: { accountCode: true, accountName: true, accountType: true, normalBalance: true } },
        journalEntry: { select: { entryDate: true, referenceNumber: true, description: true } },
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let running = 0;
    let openingBalance = null;
    if (accountId && accountId !== 'all' && startDate) {
      const opening = await prisma.journalEntryLine.aggregate({
        where: {
          ...whereConditions,
          accountId,
          journalEntry: { ...(whereConditions.journalEntry || {}), entryDate: { lt: new Date(startDate) } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });
      const acc = await prisma.account.findUnique({
        where: { id: accountId },
        select: { accountType: true, normalBalance: true },
      });
      const normal = (acc?.normalBalance || ((acc?.accountType || '').toLowerCase() === 'asset' || (acc?.accountType || '').toLowerCase() === 'expense' ? 'Debit' : 'Credit')).toLowerCase();
      const deb = opening._sum.debitAmount || 0;
      const cre = opening._sum.creditAmount || 0;
      openingBalance = normal === 'debit' ? (deb - cre) : (cre - deb);
      running = openingBalance;
    }

    const exportData = lines.map((l) => {
      const debit = l.debitAmount || 0;
      const credit = l.creditAmount || 0;
      let balance = '';
      if (accountId && accountId !== 'all') {
        const normal = (l.account?.normalBalance || ((l.account?.accountType || '').toLowerCase() === 'asset' || (l.account?.accountType || '').toLowerCase() === 'expense' ? 'Debit' : 'Credit')).toLowerCase();
        const delta = normal === 'debit' ? (debit - credit) : (credit - debit);
        running += delta;
        balance = running.toFixed(2);
      }

      const formattedDate = l.journalEntry?.entryDate ? new Date(l.journalEntry.entryDate).toISOString().split('T')[0] : '';
      return {
        Date: formattedDate,
        Reference: l.journalEntry?.referenceNumber || '',
        Description: l.journalEntry?.description || l.description || '',
        'Account Code': l.account?.accountCode || '',
        'Account Name': l.account?.accountName || '',
        'Account Type': l.account?.accountType || '',
        Debit: debit > 0 ? debit.toFixed(2) : '',
        Credit: credit > 0 ? credit.toFixed(2) : '',
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
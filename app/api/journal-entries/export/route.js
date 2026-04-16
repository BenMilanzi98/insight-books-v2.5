// app/api/journal-entries/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';

const MANUAL_SOURCE_TYPES = ['Manual', 'ManualJournalEntry', 'ManualAdjustment'];

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

function canExportJournalEntries(user) {
  return isFinanceAdmin(user) || isTenantOwnerRole(user) || hasPermission(user, 'journalEntries.export');
}

/**
 * GET handler for exporting journal entries
 */
export async function GET(request) {
  try {
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    if (!canExportJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to export journal entries.' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const format = searchParams.get('format') || 'csv'; // Default to CSV
    
    // Build filter object for Prisma
    const where = {
      tenantId,
      OR: [
        { sourceType: { in: MANUAL_SOURCE_TYPES } },
        { sourceType: null },
        { sourceType: '' },
      ],
    };
    
    // Add date range filter if provided
    if (startDate || endDate) {
      where.entryDate = {};
      
      if (startDate) {
        where.entryDate.gte = new Date(startDate);
      }
      
      if (endDate) {
        where.entryDate.lte = new Date(endDate);
      }
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      const normalized = status.toLowerCase();
      where.status = normalized === 'posted' ? 'Posted' : normalized === 'draft' ? 'Draft' : status;
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Fetch journal entries with line details
    let entries = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: true
          }
        }
      },
      orderBy: {
        entryDate: 'desc'
      }
    });

    if (entries.length === 0) {
      const legacyWhere = {
        tenantId,
        OR: [
          { sourceType: { in: MANUAL_SOURCE_TYPES } },
          { sourceType: null },
          { sourceType: '' },
        ],
      };

      if (startDate || endDate) {
        legacyWhere.date = {};
        if (startDate) {
          legacyWhere.date.gte = new Date(startDate);
        }
        if (endDate) {
          legacyWhere.date.lte = new Date(endDate);
        }
      }

      if (status && status !== 'all') {
        const normalized = status.toLowerCase();
        legacyWhere.status = normalized === 'posted' ? 'posted' : normalized === 'draft' ? 'draft' : status;
      }

      if (search) {
        legacyWhere.OR = legacyWhere.OR.concat([
          { description: { contains: search, mode: 'insensitive' } },
          { reference: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ]);
      }

      entries = await prisma.transaction.findMany({
        where: legacyWhere,
        include: {
          lines: {
            include: {
              account: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });
    }
    
    // Process data based on the requested format
    if (format.toLowerCase() === 'csv') {
      return generateCsvResponse(entries);
    } else {
      // Unsupported format
      return NextResponse.json(
        { error: `Unsupported export format: ${format}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error exporting journal entries:', error);
    return NextResponse.json(
      { error: 'Failed to export journal entries. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV response from transactions data
 */
function generateCsvResponse(entries) {
  try {
    // Prepare data for CSV
    const csvData = [];
    
    entries.forEach(entry => {
      if (!entry.lines || !entry.lines.length) return;

      entry.lines.forEach(line => {
        const account = line.account || {};
        csvData.push({
          date: entry.entryDate ? entry.entryDate.toISOString().split('T')[0] : '',
          reference: entry.referenceNumber || '',
          description: entry.description || '',
          account_code: account.accountCode || account.code || 'N/A',
          account_name: account.accountName || account.name || 'N/A',
          account_type: account.accountType || account.type || 'N/A',
          debit: line.debitAmount || 0,
          credit: line.creditAmount || 0,
          status: entry.status || 'Posted'
        });
      });
    });
    
    // Define CSV header
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'date', title: 'Date' },
        { id: 'reference', title: 'Reference' },
        { id: 'description', title: 'Description' },
        { id: 'account_code', title: 'Account Code' },
        { id: 'account_name', title: 'Account Name' },
        { id: 'account_type', title: 'Account Type' },
        { id: 'debit', title: 'Debit' },
        { id: 'credit', title: 'Credit' },
        { id: 'status', title: 'Status' }
      ]
    });
    
    // Generate CSV string
    const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);
    
    // Set response headers
    const headers = new Headers();
    headers.append('Content-Type', 'text/csv');
    headers.append('Content-Disposition', `attachment; filename="journal_entries_${new Date().toISOString().split('T')[0]}.csv"`);
    
    // Return CSV response
    return new NextResponse(csvString, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Error generating CSV:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV. Please try again.' },
      { status: 500 }
    );
  }
}
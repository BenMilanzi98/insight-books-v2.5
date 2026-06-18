// app/api/journal-entries/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { isFullAccessTenantRole } from '@/lib/tenantRoleAccess';
import { createObjectCsvStringifier } from '@/lib/csv-writer';
import { formatJournalEntries } from '@/lib/journalEntryFormatter';
import { bootstrapReportRoute, auditReportAccess, tenantNameMap } from '@/lib/reportRouteBootstrap';
import { buildExportHeaderRows, prependHeaderRowsToCsv } from '@/lib/reportExportScope';

const MANUAL_SOURCE_TYPES = ['Manual', 'ManualJournalEntry', 'ManualAdjustment'];

function isFinanceAdmin(user) {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return (
    roleName.includes('finance') ||
    roleName.includes('admin') ||
    roleName === 'master_admin'
  );
}

function canExportJournalEntries(user) {
  return (
    isFinanceAdmin(user) ||
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'journalEntries.export')
  );
}

/**
 * GET handler for exporting journal entries
 */
export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, tw, scope, tenantIds, tenants } = boot;

    if (!canExportJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to export journal entries.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const format = searchParams.get('format') || 'csv';
    
    const where = {
      ...tw,
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
        ...tw,
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
      return generateCsvResponse(formatJournalEntries(entries), {
        scope,
        tenantIds,
        tenants,
        user,
        startDate,
        endDate,
      });
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
 * Generate CSV response from journal entries data
 */
async function generateCsvResponse(entries, ctx) {
  try {
    const { scope, tenantIds, tenants, user, startDate, endDate } = ctx;
    const csvData = [];
    const tMap = tenantNameMap(tenants);
    const multiTenant = tenantIds.length > 1;

    entries.forEach(entry => {
      if (!entry.lines || !entry.lines.length) return;

      entry.lines.forEach(line => {
        const account = line.account || {};
        csvData.push({
          ...(multiTenant
            ? { business: tMap.get(entry.tenantId) || entry.tenantId || '' }
            : {}),
          date: (entry.entryDate || entry.date)
            ? new Date(entry.entryDate || entry.date).toISOString().split('T')[0]
            : '',
          reference: entry.referenceNumber || '',
          description: entry.description || '',
          account_code:
            line.accountCode || account.accountCode || account.code || 'N/A',
          account_name:
            line.accountName || account.accountName || account.name || 'N/A',
          account_type:
            line.accountType || account.accountType || account.type || 'N/A',
          debit: line.debitAmount ?? line.debit ?? 0,
          credit: line.creditAmount ?? line.credit ?? 0,
          status: entry.status || 'Posted'
        });
      });
    });
    
    // Define CSV header
    const csvHeaders = [
      ...(multiTenant ? [{ id: 'business', title: 'Business' }] : []),
      { id: 'date', title: 'Date' },
        { id: 'reference', title: 'Reference' },
        { id: 'description', title: 'Description' },
        { id: 'account_code', title: 'Account Code' },
        { id: 'account_name', title: 'Account Name' },
        { id: 'account_type', title: 'Account Type' },
        { id: 'debit', title: 'Debit' },
        { id: 'credit', title: 'Credit' },
        { id: 'status', title: 'Status' }
    ];
    const csvStringifier = createObjectCsvStringifier({ header: csvHeaders });
    
    const headerRows = buildExportHeaderRows(scope, { startDate, endDate });
    const tableCsv =
      csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);
    const csvString = prependHeaderRowsToCsv(tableCsv, headerRows);

    await auditReportAccess({
      user,
      reportType: 'journal-entries',
      tenantIds,
      scope,
      filters: { startDate, endDate },
      format: 'csv',
    });
    
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
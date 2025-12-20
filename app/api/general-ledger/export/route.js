// app/api/general-ledger/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';

export async function GET(request) {
  try {
    // Check for authentication and permissions
    const permissionCheck = await requirePermission(request, "accounting.view");
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
    
    // Build filter conditions
    const whereConditions = {
      tenantId,
    };
    
    // Add date range filter if provided
    if (startDate && endDate) {
      whereConditions.transaction = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };
    }
    
    // Add account filter if provided
    if (accountId && accountId !== 'all') {
      whereConditions.accountId = accountId;
    }
    
    // Add search filter if provided
    if (search) {
      whereConditions.OR = [
        { 
          transaction: { 
            description: { 
              contains: search, 
              mode: 'insensitive' 
            } 
          }
        },
        { 
          account: { 
            name: { 
              contains: search, 
              mode: 'insensitive' 
            } 
          }
        },
        { 
          account: { 
            code: { 
              contains: search, 
              mode: 'insensitive' 
            } 
          }
        }
      ];
    }
    
    // Fetch all journal entries matching the criteria without pagination
    const journalEntries = await prisma.journalEntry.findMany({
      where: whereConditions,
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true
          }
        },
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
            reference: true
          }
        }
      },
      orderBy: {
        'transaction.date': 'asc'
      }
    });

    // Transform the data for export
    const exportData = journalEntries.map(entry => {
      const balance = entry.debit - entry.credit;
      const formattedDate = entry.transaction.date ? new Date(entry.transaction.date).toISOString().split('T')[0] : '';
      
      return {
        Date: formattedDate,
        Reference: entry.transaction.reference || '',
        Description: entry.transaction.description,
        'Account Code': entry.account.code,
        'Account Name': entry.account.name,
        'Account Type': entry.account.type,
        Debit: entry.debit > 0 ? entry.debit.toFixed(2) : '',
        Credit: entry.credit > 0 ? entry.credit.toFixed(2) : '',
        Balance: balance.toFixed(2)
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
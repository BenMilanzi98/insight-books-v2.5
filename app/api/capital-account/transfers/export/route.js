// app/api/capital-account/transfers/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Export capital account transfers to CSV
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    // Find capital account
    const capitalAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        type: 'EQUITY',
        name: { contains: 'Capital', mode: 'insensitive' }
      }
    });

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
      );
    }

    // Build where clause for transfers
    const whereClause = {
      tenantId: user.tenantId,
      type: 'transfer',
      OR: [
        { sourceAccount: capitalAccount.id },
        { destinationAccount: capitalAccount.id }
      ]
    };

    // Add type filter
    if (type && type !== 'all') {
      if (type === 'outgoing') {
        whereClause.sourceAccount = capitalAccount.id;
      } else if (type === 'incoming') {
        whereClause.destinationAccount = capitalAccount.id;
      }
    }

    // Add date filters
    if (dateFrom || dateTo) {
      whereClause.paymentDate = {};
      if (dateFrom) {
        whereClause.paymentDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.paymentDate.lte = new Date(dateTo);
      }
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        ...whereClause.OR,
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get all transfers for export
    const transfers = await prisma.payment.findMany({
      where: whereClause,
      orderBy: { paymentDate: 'desc' }
    });

    // Format transfers for CSV
    const csvData = transfers.map(transfer => {
      const isOutgoing = transfer.sourceAccount === capitalAccount.id;
      const otherAccountKey = isOutgoing ? transfer.destinationAccount : transfer.sourceAccount;
      
      return {
        'Transfer ID': transfer.id,
        'Date': new Date(transfer.paymentDate).toLocaleDateString('en-US'),
        'Type': isOutgoing ? 'Outgoing' : 'Incoming',
        'Amount (MWK)': transfer.amount.toFixed(2),
        'Reference': transfer.reference || '',
        'Description': transfer.notes || '',
        'Account': otherAccountKey || 'Unknown',
        'Account Type': 'Payment Method',
        'Created At': new Date(transfer.createdAt).toLocaleDateString('en-US')
      };
    });

    // Convert to CSV
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="capital-account-transfers-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting capital account transfers:', error);
    return NextResponse.json(
      { error: 'Failed to export transfer history' },
      { status: 500 }
    );
  }
} 
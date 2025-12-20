// app/api/accounts/export/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import prisma from '@/lib/prisma';

/**
 * GET /api/accounts/export
 * Export accounts to CSV or JSON
 * Query params: format (csv|json), default: json
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        accountCode: true,
        accountName: true,
        accountType: true,
        normalBalance: true,
        description: true,
        isActive: true,
        balance: true,
        parentAccountId: true,
        parentAccount: {
          select: {
            accountCode: true,
            accountName: true,
          },
        },
      },
      orderBy: [
        { accountType: 'asc' },
        { accountCode: 'asc' },
      ],
    });

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Account Code', 'Account Name', 'Type', 'Normal Balance', 'Description', 'Active', 'Balance', 'Parent Code', 'Parent Name'];
      const rows = accounts.map(acc => [
        acc.accountCode || '',
        acc.accountName || '',
        acc.accountType || '',
        acc.normalBalance || '',
        acc.description || '',
        acc.isActive ? 'Yes' : 'No',
        acc.balance || 0,
        acc.parentAccount?.accountCode || '',
        acc.parentAccount?.accountName || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="accounts-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // Return JSON
      const exportData = accounts.map(acc => ({
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        description: acc.description,
        isActive: acc.isActive,
        balance: acc.balance,
        parentAccountCode: acc.parentAccount?.accountCode,
        parentAccountName: acc.parentAccount?.accountName,
      }));

      return NextResponse.json({
        exportDate: new Date().toISOString(),
        tenantId: user.tenantId,
        totalAccounts: accounts.length,
        accounts: exportData,
      });
    }
  } catch (error) {
    console.error('Error exporting accounts:', error);
    return NextResponse.json(
      { error: 'Failed to export accounts', details: error.message },
      { status: 500 }
    );
  }
}











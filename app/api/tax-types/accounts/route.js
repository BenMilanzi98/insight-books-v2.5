import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET /api/tax-types/accounts
 * Returns only tax-eligible accounts (Liability and Asset) for the current tenant.
 * Used by the tax types page so users can link taxes without requiring Chart of Accounts admin access.
 * Prefer accounts that look like tax accounts (VAT, Tax, Input, Output in name/subtype).
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Same scope as Chart of Accounts pickers (visible, non-merge-source GL rows).
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        visibleInChart: true,
        mergedIntoAccountId: null,
        OR: [
          { accountType: { equals: 'Liability', mode: 'insensitive' } },
          { accountType: { equals: 'Asset', mode: 'insensitive' } },
          { type: { equals: 'Liability', mode: 'insensitive' } },
          { type: { equals: 'Asset', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        name: true,
        accountType: true,
        accountSubtype: true,
      },
      orderBy: [{ accountType: 'asc' }, { accountCode: 'asc' }],
    });

    // Sort so tax-related accounts (VAT, Tax, Input, Output) appear first
    const taxKeywords = /vat|tax|input|output|paye|withholding/i;
    const isTaxRelated = (acc) => {
      const name = (acc.accountName || acc.name || '').toLowerCase();
      const subtype = (acc.accountSubtype || '').toLowerCase();
      const code = (acc.accountCode || '').toLowerCase();
      return taxKeywords.test(name) || taxKeywords.test(subtype) || taxKeywords.test(code);
    };
    const sorted = [...accounts].sort((a, b) => {
      const aTax = isTaxRelated(a) ? 1 : 0;
      const bTax = isTaxRelated(b) ? 1 : 0;
      if (bTax !== aTax) return bTax - aTax;
      return (a.accountCode || '').localeCompare(b.accountCode || '');
    });

    return NextResponse.json({ accounts: sorted });
  } catch (error) {
    console.error('Error fetching tax-type accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

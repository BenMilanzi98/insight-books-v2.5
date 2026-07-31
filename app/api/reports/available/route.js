// Legacy catalogue endpoint — R3-C finalized.
// Returns V2 report types and points clients at /reports-v2 (JE-only hub).
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { getAccessibleTenantIdsForUser } from '@/lib/dashboardTenantScope';
import { LEGACY_REPORT_TO_V2_TYPE } from '@/lib/accountingV2/reporting/legacyReportRedirectMap';

const CATALOG = [
  {
    id: 'profit-loss',
    name: 'Profit & Loss Statement',
    description: 'Income statement from posted Accounting V2 journal lines.',
    icon: 'FileBarChart',
    category: 'Financial',
    requiresTimeframe: true,
  },
  {
    id: 'profit-analysis',
    name: 'Profit Analysis',
    description: 'Same P&L engine totals with margin ratios.',
    icon: 'PieChart',
    category: 'Financial',
    requiresTimeframe: true,
  },
  {
    id: 'balance-sheet',
    name: 'Balance Sheet',
    description: 'Statement of financial position from posted V2 journals.',
    icon: 'FileText',
    category: 'Financial',
    requiresTimeframe: true,
  },
  {
    id: 'cash-flow',
    name: 'Cash Flow Statement',
    description: 'Indirect cash flow from posted V2 journal lines.',
    icon: 'DollarSign',
    category: 'Financial',
    requiresTimeframe: true,
  },
  {
    id: 'tax-summary',
    name: 'Tax Summary',
    description: 'Tax accounts from posted V2 journals (TAXES report).',
    icon: 'FileText',
    category: 'Financial',
    requiresTimeframe: true,
  },
  {
    id: 'sales-report',
    name: 'Sales Report',
    description: 'JE sales money with invoice document context.',
    icon: 'TrendingUp',
    category: 'Sales',
    requiresTimeframe: true,
  },
  {
    id: 'expense-report',
    name: 'Expense Report',
    description: 'JE expense money with expense document context.',
    icon: 'TrendingDown',
    category: 'Financial',
    requiresTimeframe: true,
  },
  {
    id: 'stock-movement',
    name: 'Stock Movement Report',
    description: 'Inventory JE movements; quantities stay in stock domain.',
    icon: 'Package',
    category: 'Inventory',
    requiresTimeframe: true,
  },
  {
    id: 'inventory-loss-report',
    name: 'Inventory Loss Report',
    description: 'JE loss / write-off expense accounts.',
    icon: 'TrendingDown',
    category: 'Inventory',
    requiresTimeframe: true,
  },
  {
    id: 'pos-daily',
    name: 'Daily POS Report',
    description: 'JE sales totals with POS context notes.',
    icon: 'TrendingUp',
    category: 'Sales',
    requiresTimeframe: false,
  },
];

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const accessibleTenantIds = await getAccessibleTenantIdsForUser(user);

    const reports = CATALOG.map((r) => {
      const v2Type = LEGACY_REPORT_TO_V2_TYPE[r.id] ?? null;
      return {
        ...r,
        lastGenerated: null,
        v2Type,
        canonicalPath: v2Type ? `/reports-v2?type=${v2Type}` : '/reports-v2',
        authority: 'ACCOUNTING_V2',
      };
    });

    return NextResponse.json({
      reports,
      hub: '/reports-v2',
      authority: 'ACCOUNTING_V2',
      deprecatedLegacyHub: '/reports',
      multiBusiness: accessibleTenantIds.length > 1,
      accessibleBusinessCount: accessibleTenantIds.length,
      notice:
        'Financial reporting UX is /reports-v2 only. Legacy /reports redirects. Money authority is posted ACCOUNTING_V2 journals.',
    });
  } catch (error) {
    console.error('Error fetching available reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available reports. Please try again.' },
      { status: 500 }
    );
  }
}

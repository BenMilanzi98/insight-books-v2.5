'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from './I18nProvider';

/** Map pathname prefix → catalogue key (non-critical navigation/domain titles). */
const ROUTE_TITLE_KEYS = [
  { prefix: '/dashboard', key: 'dashboard.title' },
  { prefix: '/expenses', key: 'expenses.title' },
  { prefix: '/stock', key: 'inventory.title' },
  { prefix: '/clients', key: 'sales.customers' },
  { prefix: '/invoice', key: 'sales.invoices' },
  { prefix: '/quotations', key: 'sales.quotations' },
  { prefix: '/pos', key: 'sales.pos' },
  { prefix: '/purchases', key: 'purchases.title' },
  { prefix: '/asset-management', key: 'assets-liabilities.title' },
  { prefix: '/bank-reconciliation', key: 'banking.reconciliation' },
  { prefix: '/budget-forecast', key: 'budgets-forecasts.title' },
  { prefix: '/hr', key: 'hr-payroll.title' },
  { prefix: '/reports-v2', key: 'reports.title' },
  { prefix: '/reports', key: 'reports.title' },
  { prefix: '/general-ledger', key: 'accounting.generalLedger' },
  { prefix: '/chart-of-accounts', key: 'accounting.chartOfAccounts' },
  { prefix: '/journal-entries', key: 'accounting.journalEntries' },
  { prefix: '/trial-balance', key: 'accounting.trialBalance' },
  { prefix: '/tax-management', key: 'navigation.taxManagement' },
  { prefix: '/transactions/reversals', key: 'navigation.reversals' },
  { prefix: '/settings', key: 'settings.title' },
  { prefix: '/profile', key: 'navigation.profile' },
  { prefix: '/rentals', key: 'rental-hiring.title' },
];

export default function RouteDocumentTitle() {
  const pathname = usePathname() || '';
  const { t, locale } = useI18n();

  useEffect(() => {
    const hit = ROUTE_TITLE_KEYS.find(
      (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
    );
    if (!hit) return undefined;
    const prev = document.title;
    document.title = `${t(hit.key)} | InsightBooks`;
    return () => {
      document.title = prev;
    };
  }, [pathname, t, locale]);

  return null;
}

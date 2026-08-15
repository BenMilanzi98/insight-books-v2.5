'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from './I18nProvider';
import { tt } from '@/lib/i18n/runtime';

/** Longest prefix wins. English titles are translated via tt(). */
const ROUTE_TITLES = [
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/expenses', title: 'Expense Tracking' },
  { prefix: '/stock/import', title: 'Import stock' },
  { prefix: '/stock/export', title: 'Export stock' },
  { prefix: '/stock/low-stock', title: 'Low stock' },
  { prefix: '/stock/transactions', title: 'Stock movements' },
  { prefix: '/stock', title: 'Stock/Inventory management' },
  { prefix: '/clients', title: 'Client Management' },
  { prefix: '/invoice', title: 'Invoices' },
  { prefix: '/quotations', title: 'Quotations' },
  { prefix: '/pos/list', title: 'POS sales' },
  { prefix: '/pos', title: 'Point of Sale' },
  { prefix: '/purchases/orders', title: 'Purchase orders' },
  { prefix: '/purchases/bills', title: 'Bills' },
  { prefix: '/purchases/receipts', title: 'Goods receipts' },
  { prefix: '/purchases/payments', title: 'Supplier payments' },
  { prefix: '/purchases/suppliers', title: 'Suppliers' },
  { prefix: '/purchases', title: 'Purchases' },
  { prefix: '/suppliers', title: 'Suppliers' },
  { prefix: '/asset-management', title: 'Assets & Liabilities' },
  { prefix: '/liability-management', title: 'Liabilities' },
  { prefix: '/equity-management', title: 'Equity' },
  { prefix: '/capital-account', title: 'Capital Account' },
  { prefix: '/bank-reconciliation', title: 'Bank Reconciliation' },
  { prefix: '/budget-forecast/forecasts', title: 'Forecasts' },
  { prefix: '/budget-forecast/budgets', title: 'Budgets' },
  { prefix: '/budget-forecast', title: 'Budget & Forecast' },
  { prefix: '/hr/payroll', title: 'Payroll Processing' },
  { prefix: '/hr/employees', title: 'Employee Management' },
  { prefix: '/hr/leave', title: 'Leave Management' },
  { prefix: '/hr/attendance', title: 'Attendance Tracking' },
  { prefix: '/hr/performance', title: 'Performance Management' },
  { prefix: '/hr/benefits', title: 'Benefits & Allowances' },
  { prefix: '/hr/pension', title: 'Pension (NPS)' },
  { prefix: '/hr/gratuity', title: 'Gratuity Management' },
  { prefix: '/hr/advances', title: 'Salary Advances' },
  { prefix: '/hr/reports', title: 'HR Reports' },
  { prefix: '/hr', title: 'HR & Payroll' },
  { prefix: '/reports-v2', title: 'Reports' },
  { prefix: '/reports', title: 'Reports' },
  { prefix: '/general-ledger', title: 'General Ledger' },
  { prefix: '/chart-of-accounts', title: 'Chart of Accounts' },
  { prefix: '/journal-entries', title: 'Journal Entries' },
  { prefix: '/trial-balance', title: 'Trial Balance' },
  { prefix: '/accounting-periods', title: 'Accounting periods' },
  { prefix: '/accounting-close', title: 'Accounting close' },
  { prefix: '/accounting/receivables', title: 'Receivables' },
  { prefix: '/accounting/payables', title: 'Payables' },
  { prefix: '/tax-management', title: 'Tax Management' },
  { prefix: '/tax-rules', title: 'Tax rules' },
  { prefix: '/tax-accounts', title: 'Tax accounts' },
  { prefix: '/tax', title: 'Tax' },
  { prefix: '/transactions/reversals', title: 'Reversals' },
  { prefix: '/financial-calendar-v2', title: 'Financial Calendar' },
  { prefix: '/financial-setup', title: 'Financial setup' },
  { prefix: '/settings', title: 'Settings' },
  { prefix: '/profile', title: 'Profile' },
  { prefix: '/users', title: 'User & Role Management' },
  { prefix: '/rentals', title: 'Rental & Hiring' },
  { prefix: '/payments', title: 'Payments' },
  { prefix: '/credit-debit-notes', title: 'Credit and debit notes' },
  { prefix: '/cogs', title: 'Cost of goods sold' },
  { prefix: '/help', title: 'Help' },
  { prefix: '/support', title: 'Support' },
  { prefix: '/subscription', title: 'Subscription' },
  { prefix: '/account', title: 'Account' },
  { prefix: '/switch-tenant', title: 'Switch business' },
  { prefix: '/auth/login', title: 'Log in' },
  { prefix: '/auth/signup', title: 'Sign up' },
  { prefix: '/auth/forgot-password', title: 'Forgot password' },
  { prefix: '/auth/reset-password', title: 'Reset password' },
  { prefix: '/contact', title: 'Contact' },
  { prefix: '/privacy', title: 'Privacy Policy' },
  { prefix: '/terms', title: 'Terms of Service' },
];

export default function RouteDocumentTitle() {
  const pathname = usePathname() || '';
  const { t, locale } = useI18n();

  useEffect(() => {
    const hit = ROUTE_TITLES.filter(
      (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
    ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (!hit) return undefined;
    const prev = document.title;
    document.title = `${tt(hit.title)} | InsightBooks`;
    return () => {
      document.title = prev;
    };
  }, [pathname, t, locale]);

  return null;
}

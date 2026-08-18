'use client';
import { tt } from '@/lib/i18n/runtime';

import { Suspense } from 'react';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell from '@/components/budget-forecast/BfShell';
import BudgetForecastReportView from '@/components/budget-forecast/BudgetForecastReportView';

function ReportsFallback() {
  return (
    <BfShell title={tt('Reports')} subtitle={tt('Loading report studio…')}>
      <p className="text-sm text-slate-500">{tt('Preparing filters…')}</p>
    </BfShell>
  );
}

export default function BudgetForecastReportsPage() {
  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title={tt('Reports')}
        subtitle={tt('Budget plan, Budget versus Actual, and related management reports.')}
      >
        <Suspense fallback={<ReportsFallback />}>
          <BudgetForecastReportView />
        </Suspense>
      </BfShell>
    </PermissionGuard>
  );
}

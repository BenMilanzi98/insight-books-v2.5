'use client';

import { Suspense } from 'react';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell from '@/components/budget-forecast/BfShell';
import BudgetForecastReportView from '@/components/budget-forecast/BudgetForecastReportView';

function ReportsFallback() {
  return (
    <BfShell title="Reports" subtitle="Loading report studio…">
      <p className="text-sm text-slate-500">Preparing filters…</p>
    </BfShell>
  );
}

export default function BudgetForecastReportsPage() {
  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title="Reports"
        subtitle="Budget plan, Budget versus Actual, and related management reports."
      >
        <Suspense fallback={<ReportsFallback />}>
          <BudgetForecastReportView />
        </Suspense>
      </BfShell>
    </PermissionGuard>
  );
}

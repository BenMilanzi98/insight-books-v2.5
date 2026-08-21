'use client';
import { tt } from '@/lib/i18n/runtime';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import ReconcileWizard from '@/components/payments/reconcile/ReconcileWizard.jsx';

function GuidedReconcilePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentAccountId = Array.isArray(params?.paymentAccountId)
    ? params.paymentAccountId[0]
    : params?.paymentAccountId;
  const initialReconciliationId = searchParams.get('id') || '';

  return (
    <PermissionGuard permission="bankReconciliation.view">
      <ReconcileWizard
        paymentAccountId={paymentAccountId}
        initialReconciliationId={initialReconciliationId}
      />
    </PermissionGuard>
  );
}

export default function GuidedReconcilePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 text-sm text-gray-500 sm:px-6">{tt('Loading…')}</div>
      }
    >
      <GuidedReconcilePageInner />
    </Suspense>
  );
}

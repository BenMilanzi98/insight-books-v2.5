"use client";
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import PaymentChannelsPanel from '@/components/payments/PaymentChannelsPanel';

function PaymentManagementPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get('onboarding') === '1';
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleDelete = async (account) => {
    if (!confirm(`Are you sure you want to ${account.isActive ? 'deactivate' : 'delete'} "${account.name}"?`)) {
      return;
    }
    try {
      setError(null);
      const response = await fetch(`/api/payment-accounts/${account.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete payment account');
      setSuccess(data.message || 'Payment account removed');
      setRefreshKey((k) => k + 1);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const completePaymentsOnboarding = async () => {
    try {
      setError(null);
      const res = await fetch('/api/tenant/onboarding/complete-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not complete this step');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {onboarding && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm">
            <p className="font-medium">Required setup — payment accounts</p>
            <p className="mt-1 text-amber-900/90">
              Add your bank and mobile money accounts under the matching GL channel (1131–1138, 1140, 1141).
              Cash uses GL 1110 automatically.
            </p>
            <button
              type="button"
              onClick={completePaymentsOnboarding}
              className="mt-3 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-white text-sm font-medium hover:bg-amber-700"
            >
              I have configured payment accounts — go to dashboard
            </button>
          </div>
        )}

        <button
          onClick={() => router.push('/payments')}
          className="mb-4 flex items-center text-slate-600 hover:text-slate-900 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Payment Accounts
        </button>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Payment accounts management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define operational accounts under each bank or mobile channel. GL sub-accounts are created automatically
            (e.g. 1131-01) and appear in Chart of Accounts as children of the parent row.
          </p>
        </header>

        {success && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 shrink-0" />
            <span className="text-emerald-800">{success}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 mr-2 shrink-0" />
            <span className="text-rose-800">{error}</span>
          </div>
        )}

        <PaymentChannelsPanel
          mode="management"
          refreshKey={refreshKey}
          onDeleteAccount={handleDelete}
        />
      </div>
    </div>
  );
}

export default function PaymentManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading…</div>}>
      <PaymentManagementPageInner />
    </Suspense>
  );
}

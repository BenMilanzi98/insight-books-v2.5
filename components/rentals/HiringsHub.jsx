'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import PosStylePageHeader from '@/components/shell/PosStylePageHeader';
import InboundHiringPanel from '@/components/rentals/InboundHiringPanel';
import RentalsClient from '@/app/rentals/RentalsClient';

function HiringsHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') === 'supplier' ? 'supplier' : 'customer';
  const setTab = (next) => router.replace(`/rentals/hirings?tab=${next}`);

  return (
    <PermissionGuard permissions={['rentals.view']}>
      <div className="w-full p-4 sm:p-6">
        <PosStylePageHeader
          title="Hirings"
          description="Customer hire (outbound) and supplier hire (inbound)"
        />
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Hiring type">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'customer'}
            onClick={() => setTab('customer')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === 'customer'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            Customer hire
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'supplier'}
            onClick={() => setTab('supplier')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === 'supplier'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            Supplier hire
          </button>
        </div>
        {tab === 'customer' ? (
          <RentalsClient mode="hiring" embedded />
        ) : (
          <InboundHiringPanel embedded />
        )}
      </div>
    </PermissionGuard>
  );
}

export default function HiringsHub() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
      <HiringsHubInner />
    </Suspense>
  );
}

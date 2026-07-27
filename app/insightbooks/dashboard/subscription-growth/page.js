'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageContainer, AdminPageHeader } from '@/components/admin';

export default function SubscriptionGrowthPage() {
  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        title="Subscription growth"
        description="Standalone growth charts for this route are not maintained separately. Live billing and subscription metrics live on the main dashboard and Billing."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/insightbooks/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to dashboard
            </Link>
            <Link
              href="/insightbooks/billing/overview"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]"
            >
              Billing overview
            </Link>
          </div>
        }
      />
      <p className="text-sm text-[var(--admin-text-muted)]">
        Prefer the main dashboard and Billing for current subscription signals. This page is kept as
        a calm landing for bookmarks and legacy navigation links.
      </p>
    </AdminPageContainer>
  );
}

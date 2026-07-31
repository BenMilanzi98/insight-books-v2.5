'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageContainer, AdminPageHeader } from '@/components/admin';

export default function RevenueOverviewPage() {
  const { t } = useI18n();
  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        title={t('admin-pages.stubs.revenueOverview.title')}
        description="Detailed revenue charts for this route are not maintained separately. Live platform metrics live on the main System Administration dashboard."
        actions={
          <Link
            href="/insightbooks/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
        }
      />
      <p className="text-sm text-[var(--admin-text-muted)]">
        Use the main dashboard for current subscription and billing signals. This page is kept as a
        calm landing for bookmarks and legacy navigation links.
      </p>
    </AdminPageContainer>
  );
}

'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageContainer, AdminPageHeader } from '@/components/admin';

export default function UserAnalyticsPage() {
  const { t } = useI18n();
  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        title={t('admin-pages.stubs.userAnalytics.title')}
        description="Standalone user analytics for this route are not maintained separately. Live platform metrics live on the main System Administration dashboard."
        actions={
          <Link
            href="/insightbooks/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {tt('Back to dashboard')}
          </Link>
        }
      />
      <p className="text-sm text-[var(--admin-text-muted)]">
        Open the main dashboard for current tenant and user activity signals. This page remains as a
        calm landing for bookmarks and legacy navigation links.
      </p>
    </AdminPageContainer>
  );
}

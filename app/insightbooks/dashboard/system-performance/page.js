'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageContainer, AdminPageHeader } from '@/components/admin';

export default function SystemPerformancePage() {
  const { t } = useI18n();
  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        title={t('admin-pages.stubs.systemPerformance.title')}
        description="Standalone performance charts for this route are not maintained separately. Live health and operational signals live on System Health and the main dashboard."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/insightbooks/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {tt('Back to dashboard')}
            </Link>
            <Link
              href="/insightbooks/system-health"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]"
            >
              {tt('System Health')}
            </Link>
          </div>
        }
      />
      <p className="text-sm text-[var(--admin-text-muted)]">
        {tt('Prefer System Health for service status. This page is kept as a calm landing for bookmarks and legacy navigation links.')}
      </p>
    </AdminPageContainer>
  );
}

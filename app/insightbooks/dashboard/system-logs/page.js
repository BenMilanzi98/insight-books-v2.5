'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageContainer, AdminPageHeader } from '@/components/admin';

export default function SystemLogsPage() {
  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        title="System logs"
        description="Standalone log views for this route are not maintained separately. Audit and operational history live under Audit and the main dashboard."
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
              href="/insightbooks/audit"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]"
            >
              Audit log
            </Link>
          </div>
        }
      />
      <p className="text-sm text-[var(--admin-text-muted)]">
        Use Audit for searchable platform events. This page remains as a calm landing for bookmarks
        and legacy navigation links.
      </p>
    </AdminPageContainer>
  );
}

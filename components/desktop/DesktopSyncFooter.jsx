'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { isDesktopClient } from '@/components/desktop/DesktopSyncBanner';

const POLL_MS = 60 * 1000;

export default function DesktopSyncFooter() {
  const { t, formatDateTime } = useI18n();
  const [desktop, setDesktop] = useState(false);
  const [status, setStatus] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!isDesktopClient()) return;
    try {
      const res = await fetch('/api/desktop-local/sync-status', { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.ok && json) setStatus(json);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    const active = isDesktopClient();
    setDesktop(active);
    if (!active) return undefined;
    loadStatus();
    const id = window.setInterval(loadStatus, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadStatus]);

  if (!desktop) return null;

  const lastSynced =
    status?.lastSuccessfulSyncAt != null
      ? formatDateTime(status.lastSuccessfulSyncAt)
      : '—';

  return (
    <div
      className="border-t border-[#e0e0e0] bg-[#f8f9fa] px-6 py-2 text-xs text-[#6b7280]"
      data-testid="desktop-sync-footer"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{t('common.desktop.footer.lastSynced', { time: lastSynced })}</span>
        {status?.failedCount > 0 ? (
          <Link href="/desktop/sync-issues" className="underline underline-offset-2">
            {t('common.desktop.syncIssues')} ({status.failedCount})
          </Link>
        ) : null}
      </div>
    </div>
  );
}

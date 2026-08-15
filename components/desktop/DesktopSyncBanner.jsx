'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { DESKTOP_COOKIE } from '@/lib/desktop/runtime';
import { hoursLeft } from '@/lib/desktop/lockCopy';
import { LOCK_MS } from '@/lib/desktop/lock';

const POLL_MS = 60 * 1000;

function isDesktopClient() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((part) => {
    const [name, value] = part.trim().split('=');
    return name === DESKTOP_COOKIE && value === '1';
  });
}

export default function DesktopSyncBanner() {
  const { t } = useI18n();
  const [desktop, setDesktop] = useState(false);
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

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

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/desktop-local/sync-now', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  if (!desktop || !status) return null;
  if (!status.warning && !status.locked) return null;

  const remainingHours = Math.ceil(hoursLeft(LOCK_MS, status.hoursSinceSync ?? 0));
  const isLocked = status.locked;
  const tone = isLocked
    ? 'border-red-200 bg-red-50 text-red-950'
    : 'border-amber-200 bg-amber-50 text-amber-950';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm ${tone}`}
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">
            {isLocked
              ? t('common.desktop.banner.locked')
              : t('common.desktop.banner.warning', { hours: remainingHours })}
          </p>
          {status.failedCount > 0 ? (
            <Link
              href="/desktop/sync-issues"
              className="mt-1 inline-block text-sm underline underline-offset-2"
            >
              {t('common.desktop.syncIssues')} ({status.failedCount})
            </Link>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={syncNow}
        disabled={syncing}
        className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {syncing ? t('common.loading.default') : t('common.desktop.syncNow')}
      </button>
    </div>
  );
}

export { isDesktopClient };

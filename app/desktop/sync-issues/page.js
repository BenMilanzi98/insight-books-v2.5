'use client';

import { useCallback, useEffect, useState } from 'react';
import ModulePageHeading from '@/components/i18n/ModulePageHeading';
import { useI18n } from '@/components/i18n/I18nProvider';
import { isDesktopClient } from '@/components/desktop/DesktopSyncBanner';

export default function DesktopSyncIssuesPage() {
  const { t } = useI18n();
  const [desktop, setDesktop] = useState(false);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isDesktopClient()) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/desktop-local/sync-status', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setIssues(json.issues || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDesktop(isDesktopClient());
    load();
  }, [load]);

  if (!desktop) {
    return (
      <div className="mx-auto max-w-3xl">
        <ModulePageHeading titleKey="common.desktop.syncIssues" />
        <p className="text-sm text-slate-600">{t('common.desktop.onlineOnly')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ModulePageHeading titleKey="common.desktop.syncIssues" />
      {loading ? (
        <p className="text-sm text-slate-500">{t('common.loading.default')}</p>
      ) : issues.length === 0 ? (
        <p className="text-sm text-slate-600">{t('common.empty.noRecords')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">{t('common.fields.type')}</th>
                <th className="px-4 py-3 font-medium">{t('common.error.generic')}</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{issue.id}</td>
                  <td className="px-4 py-3">{issue.kind}</td>
                  <td className="px-4 py-3 text-red-700">{issue.errorMessage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

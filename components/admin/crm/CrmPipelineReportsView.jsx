'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CrmSectionNav from './CrmSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function CrmPipelineReportsView() {
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [recon, setRecon] = useState(null);
  const [pipelineReport, setPipelineReport] = useState(null);
  const [schedules, setSchedules] = useState(null);
  const [busy, setBusy] = useState(false);

  const download = async (format) => {
    setBusy(true);
    setMessage('');
    try {
      const res = await adminFetch(
        `/api/admin/crm/export?dataset=leads&format=${format}`,
        { credentials: 'include' }
      );
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t('admin-pages.crm.forbidden'));
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t('admin-pages.crm.reports.exportFailed'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-leads.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(t('admin-pages.crm.reports.exportOk'));
    } catch (e) {
      setMessage(e.message || t('admin-pages.crm.reports.exportFailed'));
    } finally {
      setBusy(false);
    }
  };

  const runRecon = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/crm/reconciliation', {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.reports.reconFailed'));
      setRecon(body);
      setMessage(t('admin-pages.crm.reports.reconOk'));
    } catch (e) {
      setMessage(e.message || t('admin-pages.crm.reports.reconFailed'));
    } finally {
      setBusy(false);
    }
  };

  const loadPipelineReport = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/crm/pipeline/reports', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.reports.pipelineFailed'));
      setPipelineReport(body);
      setMessage(t('admin-pages.crm.reports.pipelineOk'));
    } catch (e) {
      setPipelineReport(null);
      setMessage(e.message || t('admin-pages.crm.reports.pipelineFailed'));
    } finally {
      setBusy(false);
    }
  };

  const loadSchedules = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/crm/pipeline/report-schedules', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.reports.schedulesFailed'));
      setSchedules(body);
      setMessage(t('admin-pages.crm.reports.schedulesOk'));
    } catch (e) {
      setSchedules(null);
      setMessage(e.message || t('admin-pages.crm.reports.schedulesFailed'));
    } finally {
      setBusy(false);
    }
  };

  const createSchedule = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/crm/pipeline/report-schedules', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: 'Pipeline weekly',
          cronExpression: '0 8 * * 1',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.reports.scheduleCreateFailed'));
      setMessage(t('admin-pages.crm.reports.scheduleCreateOk'));
      await loadSchedules();
    } catch (e) {
      setMessage(e.message || t('admin-pages.crm.reports.scheduleCreateFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.crm.sections.reports')}
        description={t('admin-pages.crm.sectionHints.reports')}
      />
      <CrmSectionNav />
      <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
        {t('admin-pages.crm.reports.exportHint')}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnGhost} disabled={busy} onClick={() => download('json')}>
          {t('admin-pages.crm.reports.exportJson')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={() => download('csv')}>
          {t('admin-pages.crm.reports.exportCsv')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={runRecon}>
          {t('admin-pages.crm.reports.runRecon')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={loadPipelineReport}>
          {t('admin-pages.crm.reports.loadPipeline')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={loadSchedules}>
          {t('admin-pages.crm.reports.loadSchedules')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={createSchedule}>
          {t('admin-pages.crm.reports.createSchedule')}
        </button>
      </div>
      {message ? (
        <p className="mt-3 text-sm text-[var(--admin-text)]">{message}</p>
      ) : null}
      {recon ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span>{t('admin-pages.crm.reports.reconStatus')}</span>
            <AdminStatusBadge tone="info">{recon.status}</AdminStatusBadge>
          </div>
          {!recon.honesty?.kpiSafe ? (
            <p className="text-sm text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.reports.noFalseZero')}
            </p>
          ) : null}
        </div>
      ) : null}
      {pipelineReport ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t('admin-pages.crm.reports.pipelineStatus')}</span>
            <AdminStatusBadge tone="info">{pipelineReport.status}</AdminStatusBadge>
            {pipelineReport.honesty?.weightedUiEnabled === false ? (
              <span className="text-[var(--admin-text-muted)]">
                {t('admin-pages.crm.pipeline.weightedDark')}
              </span>
            ) : null}
          </div>
          {pipelineReport.status === 'EMPTY' || pipelineReport.status === 'UNAVAILABLE' ? (
            <p className="text-sm text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.reports.emptyEnvelope')}
            </p>
          ) : null}
          {pipelineReport.report && pipelineReport.status === 'READY' ? (
            <pre className="max-h-64 overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs text-[var(--admin-text)]">
              {JSON.stringify(
                {
                  winCount: pipelineReport.report.winCount,
                  lossCount: pipelineReport.report.lossCount,
                  openCount: pipelineReport.report.openCount,
                  openPipelineByCurrency: pipelineReport.report.openPipelineByCurrency,
                  weightedTotals: pipelineReport.report.weightedTotals,
                },
                null,
                2
              )}
            </pre>
          ) : null}
        </div>
      ) : null}
      {schedules ? (
        <pre className="mt-4 max-h-48 overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs text-[var(--admin-text)]">
          {JSON.stringify(
            {
              count: schedules.meta?.count ?? schedules.items?.length ?? null,
              unavailable: schedules.meta?.unavailable || false,
              items: (schedules.items || []).map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
                lastRunStatus: s.lastRunStatus,
              })),
            },
            null,
            2
          )}
        </pre>
      ) : null}
    </AdminPageContainer>
  );
}

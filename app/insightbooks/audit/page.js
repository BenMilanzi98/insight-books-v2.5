'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Download, RefreshCw, Shield, Users,
} from 'lucide-react';
import {
  AdminPageContainer, AdminPageHeader, AdminSummaryCard, AdminFilterBar,
  AdminDataTable, AdminStatusBadge, AdminLoadingState, AdminErrorState,
  AdminEmptyState, AdminField,
} from '@/components/admin';

const PAGE_SIZE_DEFAULT = 10;

function actionTone(action) {
  const a = String(action || '');
  if (a.includes('FAILED') || a.includes('UNAUTHORIZED') || a.includes('DELETE')) return 'danger';
  if (a.includes('CREATE') || a.includes('LOGIN_SUCCESS') || a === 'LOGIN') return 'success';
  if (a.includes('UPDATE') || a.includes('SETTINGS')) return 'warning';
  return 'neutral';
}

function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const btnGhost = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function AuditPage() {
  const { t } = useI18n();
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchFailed, setFetchFailed] = useState(false);
  const [selectedLogType, setSelectedLogType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setFetchFailed(false);
    try {
      const [auditRes, adminRes] = await Promise.all([
        adminFetch('/api/admin/audit/logs', { credentials: 'include' }),
        adminFetch('/api/admin/audit/admin-logs', { credentials: 'include' }),
      ]);

      let userLogs = [];
      let adminLogs = [];
      let hadError = false;

      if (auditRes.ok) {
        const data = await auditRes.json().catch(() => ({}));
        userLogs = Array.isArray(data.logs) ? data.logs.map((l) => ({ ...l, _source: 'user' })) : [];
      } else {
        hadError = true;
      }

      if (adminRes.ok) {
        const data = await adminRes.json().catch(() => ({}));
        adminLogs = Array.isArray(data.logs) ? data.logs.map((l) => ({ ...l, _source: 'admin' })) : [];
      } else {
        hadError = true;
      }

      setAuditLogs(userLogs);
      setAdminAuditLogs(adminLogs);

      if (hadError && userLogs.length === 0 && adminLogs.length === 0) {
        setFetchFailed(true);
        setError('Failed to load audit logs');
      }
    } catch (err) {
      setAuditLogs([]);
      setAdminAuditLogs([]);
      setFetchFailed(true);
      setError(err.message || 'Failed to fetch audit data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLogType, selectedAction, searchTerm, pageSize]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...auditLogs, ...adminAuditLogs]
      .filter((log) => {
        const matchesType =
          selectedLogType === 'all'
          || (selectedLogType === 'user' && log._source === 'user')
          || (selectedLogType === 'admin' && log._source === 'admin');
        const matchesAction = selectedAction === 'all' || log.action === selectedAction;
        const hay = [
          log.action, log.details, log.user, log.adminId, log.ipAddress,
        ].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = !q || hay.includes(q);
        return matchesType && matchesAction && matchesSearch;
      })
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
  }, [auditLogs, adminAuditLogs, selectedLogType, selectedAction, searchTerm]);

  const securityCount = useMemo(
    () => filtered.filter((log) => {
      const a = String(log.action || '');
      return a.includes('FAILED') || a.includes('UNAUTHORIZED') || a.includes('DELETE');
    }).length,
    [filtered]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(startIndex, startIndex + pageSize);

  const exportCsv = () => {
    const header = 'Timestamp,Action,User,IP Address,Details,Source\n';
    const rows = filtered.map((log) =>
      [
        log.timestamp || log.createdAt || '',
        log.action || '',
        log.user || log.adminId || '',
        log.ipAddress || '',
        `"${String(log.details || '').replace(/"/g, '""')}"`,
        log._source || '',
      ].join(',')
    ).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(`data:text/csv;charset=utf-8,${header}${rows}`);
    link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = useMemo(() => [
    {
      key: 'action',
      header: 'Action',
      render: (log) => (
        <AdminStatusBadge tone={actionTone(log.action)}>
          {log.action || '—'}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'actor',
      header: 'User / Admin',
      render: (log) => (
        <span className="text-[var(--admin-text)]">{log.user || log.adminId || 'System'}</span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      hideOnMobile: true,
      render: (log) => (
        <span className="line-clamp-2 max-w-xs text-[var(--admin-text-muted)]">
          {log.details || '—'}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      hideOnMobile: true,
      render: (log) => (
        <span className="font-mono text-xs text-[var(--admin-text-muted)]">
          {log.ipAddress || '—'}
        </span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      render: (log) => (
        <span className="whitespace-nowrap text-sm text-[var(--admin-text-muted)]">
          {fmtDateTime(log.timestamp || log.createdAt)}
        </span>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (log) => {
        const failed = String(log.action || '').includes('FAILED')
          || String(log.action || '').includes('UNAUTHORIZED');
        return (
          <AdminStatusBadge tone={failed ? 'danger' : 'success'}>
            {failed ? 'Failed' : 'Success'}
          </AdminStatusBadge>
        );
      },
    },
  ], []);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.audit.title')}
        description="Monitor platform activity and security events from real audit APIs."
        actions={
          <>
            <button type="button" onClick={exportCsv} className={btnGhost} disabled={!filtered.length}>
              <Download className="h-4 w-4" aria-hidden /> {tt('Export')}
            </button>
            <button type="button" onClick={load} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden /> {tt('Refresh')}
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Filtered activities"
          value={loading ? '…' : filtered.length}
          icon={Activity}
        />
        <AdminSummaryCard
          label="User activities"
          value={loading ? '…' : auditLogs.length}
          icon={Users}
          tone="success"
        />
        <AdminSummaryCard
          label="Admin activities"
          value={loading ? '…' : adminAuditLogs.length}
          icon={Shield}
        />
        <AdminSummaryCard
          label="Security events"
          value={loading ? '…' : securityCount}
          icon={AlertTriangle}
          tone={securityCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <AdminFilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search actions, users, details…"
      >
        <AdminField label="Log type" htmlFor="audit-type">
          <AdminField.Select
            id="audit-type"
            value={selectedLogType}
            onChange={(e) => setSelectedLogType(e.target.value)}
          >
            <option value="all">{tt('All logs')}</option>
            <option value="user">{tt('User activities')}</option>
            <option value="admin">{tt('Admin activities')}</option>
          </AdminField.Select>
        </AdminField>
        <AdminField label="Action" htmlFor="audit-action">
          <AdminField.Select
            id="audit-action"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
          >
            <option value="all">{tt('All actions')}</option>
            <option value="LOGIN">{tt('Login')}</option>
            <option value="LOGIN_SUCCESS">{tt('Login success')}</option>
            <option value="LOGIN_FAILED">{tt('Login failed')}</option>
            <option value="USER_CREATE">{tt('User create')}</option>
            <option value="USER_UPDATE">{tt('User update')}</option>
            <option value="USER_DELETE">{tt('User delete')}</option>
            <option value="TENANT_CREATE">{tt('Tenant create')}</option>
            <option value="TENANT_UPDATE">{tt('Tenant update')}</option>
            <option value="TENANT_DELETE">{tt('Tenant delete')}</option>
            <option value="SETTINGS_UPDATE">{tt('Settings update')}</option>
          </AdminField.Select>
        </AdminField>
        <AdminField label="Per page" htmlFor="audit-page-size">
          <AdminField.Select
            id="audit-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </AdminField.Select>
        </AdminField>
      </AdminFilterBar>

      {loading ? <AdminLoadingState label="Loading audit logs" /> : null}
      {!loading && fetchFailed ? (
        <AdminErrorState title="Audit logs unavailable" message={error} onRetry={load} />
      ) : null}
      {!loading && !fetchFailed && filtered.length === 0 ? (
        <AdminEmptyState
          title={searchTerm || selectedAction !== 'all' || selectedLogType !== 'all'
            ? 'No activities match your filters'
            : 'No audit activity yet'}
          description="Events appear here when users and admins perform tracked actions."
          icon={Activity}
        />
      ) : null}

      {!loading && !fetchFailed && pageRows.length > 0 ? (
        <>
          <AdminDataTable
            columns={columns}
            rows={pageRows}
            rowKey={(row, i) => row.id || `${row.timestamp || row.createdAt}-${row.action}-${i}`}
          />
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--admin-text-muted)]">
              Showing{' '}
              <span className="font-medium text-[var(--admin-text)]">
                {filtered.length === 0 ? 0 : startIndex + 1}
              </span>
              {' '}to{' '}
              <span className="font-medium text-[var(--admin-text)]">
                {Math.min(startIndex + pageSize, filtered.length)}
              </span>
              {' '}of <span className="font-medium text-[var(--admin-text)]">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={btnGhost}
              >
                {tt('Previous')}
              </button>
              <span className="text-sm text-[var(--admin-text-muted)]">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={btnGhost}
              >
                {tt('Next')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </AdminPageContainer>
  );
}

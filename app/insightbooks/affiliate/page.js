'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Clock, Copy, Download, Eye, Lock, Pencil, Plus,
  RefreshCw, Trash2, Users, X, DollarSign, Percent, Handshake,
} from 'lucide-react';
import {
  AdminPageContainer, AdminPageHeader, AdminSummaryCard, AdminFilterBar,
  AdminDataTable, AdminStatusBadge, AdminLoadingState, AdminErrorState,
  AdminEmptyState, AdminModal, AdminField, AdminConfirmationDialog,
} from '@/components/admin';

const PAGE_SIZE_DEFAULT = 10;
const EMPTY_FORM = {
  name: '',
  email: '',
  commissionRate: 20,
  status: 'active',
  paymentMethod: 'bank',
  bankDetails: {
    accountName: '',
    accountNumber: '',
    bankName: '',
    swiftCode: '',
  },
};

function statusTone(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'active') return 'success';
  if (v === 'pending') return 'warning';
  if (v === 'suspended' || v === 'inactive') return 'danger';
  return 'neutral';
}

function money(n) {
  return `MWK ${Number(n || 0).toLocaleString()}`;
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function Flash({ tone = 'danger', children, onDismiss }) {
  const cls = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-red-200 bg-red-50 text-red-800';
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-[var(--admin-radius)] border px-4 py-3 text-sm ${cls}`} role="status">
      <p className="min-w-0 flex-1 break-words">{children}</p>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="rounded p-1 opacity-70 hover:opacity-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function IconBtn({ title, children, onClick, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-text)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

const btnGhost = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

function formatMaskedBank(masked) {
  if (!masked || typeof masked !== 'object') return null;
  const parts = [
    masked.bankName,
    masked.accountName,
    masked.accountNumber,
    masked.swiftCode,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export default function AffiliatePage() {
  const { t } = useI18n();
  const [affiliates, setAffiliates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [actionLoading, setActionLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
    notifyAffiliate: true,
  });

  const showSuccess = (msg, ms = 4000) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), ms);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setStatsError(false);
    try {
      const [affRes, statsRes] = await Promise.all([
        adminFetch('/api/admin/affiliate', { credentials: 'include' }),
        adminFetch('/api/admin/affiliate/stats', { credentials: 'include' }),
      ]);

      const affBody = await affRes.json().catch(() => ({}));
      if (!affRes.ok) throw new Error(affBody.error || `Failed to load affiliates (${affRes.status})`);
      setAffiliates(Array.isArray(affBody.affiliates) ? affBody.affiliates : []);

      if (statsRes.ok) {
        const statsBody = await statsRes.json().catch(() => ({}));
        setStats(statsBody.stats || null);
      } else {
        setStats(null);
        setStatsError(true);
      }
    } catch (err) {
      setAffiliates([]);
      setError(err.message || 'Failed to fetch affiliate data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, searchTerm, pageSize]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return affiliates.filter((a) => {
      const matchesStatus = selectedStatus === 'all' || a.status === selectedStatus;
      const matchesSearch = !q
        || String(a.name || '').toLowerCase().includes(q)
        || String(a.email || '').toLowerCase().includes(q)
        || String(a.affiliateCode || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [affiliates, selectedStatus, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(startIndex, startIndex + pageSize);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (affiliate) => {
    setEditing(affiliate);
    setFormData({
      name: affiliate.name || '',
      email: affiliate.email || '',
      commissionRate: affiliate.commissionRate ?? 20,
      status: affiliate.status || 'active',
      paymentMethod: affiliate.paymentMethod || 'bank',
      bankDetails: {
        accountName: '',
        accountNumber: '',
        bankName: '',
        swiftCode: '',
      },
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormData(EMPTY_FORM);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      if (editing) {
        const payload = {
          affiliateId: editing.id,
          name: formData.name,
          email: formData.email,
          commissionRate: formData.commissionRate,
          status: formData.status,
          paymentMethod: formData.paymentMethod,
        };
        const hasNewBank = Object.values(formData.bankDetails || {}).some((v) => String(v || '').trim());
        if (hasNewBank) payload.bankDetails = formData.bankDetails;

        const res = await adminFetch('/api/admin/affiliate/update', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || 'Failed to update affiliate');
        closeForm();
        showSuccess('Affiliate updated successfully');
      } else {
        const res = await adminFetch('/api/admin/affiliate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to add affiliate');
        closeForm();
        showSuccess('Affiliate added successfully');
      }
      await load();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/affiliate/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: confirmDelete.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || 'Failed to delete affiliate');
      setConfirmDelete(null);
      showSuccess('Affiliate deleted successfully');
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordTarget) return;
    if (passwordData.password !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/affiliate/set-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId: passwordTarget.id,
          password: passwordData.password,
          notifyAffiliate: passwordData.notifyAffiliate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to set password');
      setPasswordTarget(null);
      setPasswordData({ password: '', confirmPassword: '', notifyAffiliate: true });
      showSuccess('Password updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to set password');
    } finally {
      setActionLoading(false);
    }
  };

  const copyAffiliateLink = async (code) => {
    const link = `${window.location.origin}/ref/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      showSuccess('Affiliate link copied');
    } catch {
      setError('Could not copy link');
    }
  };

  const exportCsv = () => {
    const header = 'Name,Email,Code,Status,Commission Rate,Commissions (MWK),Pending Payouts (MWK),Referrals,Join Date\n';
    const rows = filtered.map((a) =>
      [
        a.name,
        a.email,
        a.affiliateCode,
        a.status,
        `${a.commissionRate ?? 0}%`,
        a.totalCommissions || 0,
        a.pendingPayouts || 0,
        a.referralCount || 0,
        a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '',
      ].join(',')
    ).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(`data:text/csv;charset=utf-8,${header}${rows}`);
    link.download = `affiliates_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summaryValue = (key, format) => {
    if (loading && !stats) return '…';
    if (statsError || !stats) return '—';
    const v = stats[key];
    if (v == null) return '—';
    return format ? format(v) : v;
  };

  const columns = useMemo(() => [
    {
      key: 'affiliate',
      header: 'Affiliate',
      render: (a) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--admin-text)]">{a.name}</div>
          <div className="truncate text-xs text-[var(--admin-text-muted)]">{a.email}</div>
          <div className="truncate font-mono text-xs text-[var(--admin-text-muted)]">
            {a.affiliateCode || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <AdminStatusBadge tone={statusTone(a.status)}>
          {a.status || '—'}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'commission',
      header: 'Rate',
      render: (a) => (
        <span className="tabular-nums text-[var(--admin-text)]">{a.commissionRate ?? 0}%</span>
      ),
    },
    {
      key: 'performance',
      header: 'Performance',
      hideOnMobile: true,
      render: (a) => (
        <div className="text-xs text-[var(--admin-text-muted)]">
          <div>Commissions: {money(a.totalCommissions)}</div>
          <div>Pending: {money(a.pendingPayouts)}</div>
          <div>
            Referrals: {a.referralCount ?? 0}
            {a.completedReferralCount != null ? ` · ${a.completedReferralCount} completed` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      hideOnMobile: true,
      render: (a) => (
        <span className="text-sm text-[var(--admin-text-muted)]">{fmtDate(a.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IconBtn title="Copy referral link" onClick={() => copyAffiliateLink(a.affiliateCode)}>
            <Copy className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="View details" onClick={() => setDetails(a)}>
            <Eye className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Edit" onClick={() => openEdit(a)}>
            <Pencil className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="Set password"
            onClick={() => {
              setPasswordTarget(a);
              setPasswordData({ password: '', confirmPassword: '', notifyAffiliate: true });
            }}
          >
            <Lock className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="Delete"
            onClick={() => setConfirmDelete(a)}
          >
            <Trash2 className="h-4 w-4 text-[var(--admin-danger)]" />
          </IconBtn>
        </div>
      ),
    },
  ], []);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.affiliate.title')}
        description="Manage affiliates, commissions, and referral performance. Bank details are masked."
        actions={
          <>
            <button type="button" onClick={exportCsv} className={btnGhost} disabled={!filtered.length}>
              <Download className="h-4 w-4" aria-hidden /> Export
            </button>
            <button type="button" onClick={load} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </button>
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <Plus className="h-4 w-4" aria-hidden /> Add affiliate
            </button>
          </>
        }
      />

      {notice ? <Flash tone="success" onDismiss={() => setNotice('')}>{notice}</Flash> : null}
      {error ? <Flash onDismiss={() => setError('')}>{error}</Flash> : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <AdminSummaryCard label="Total affiliates" value={summaryValue('totalAffiliates')} icon={Users} error={statsError} />
        <AdminSummaryCard label="Active" value={summaryValue('activeAffiliates')} tone="success" icon={CheckCircle} error={statsError} />
        <AdminSummaryCard label="Total commissions" value={summaryValue('totalCommissions', money)} icon={DollarSign} error={statsError} />
        <AdminSummaryCard label="Pending payouts" value={summaryValue('pendingPayouts', money)} tone="warning" icon={Clock} error={statsError} />
        <AdminSummaryCard label="Monthly commissions" value={summaryValue('monthlyRevenue', money)} icon={Handshake} error={statsError} />
        <AdminSummaryCard label="Conversion rate" value={summaryValue('conversionRate', (v) => `${v}%`)} icon={Percent} error={statsError} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Total referrals" value={summaryValue('totalReferrals')} error={statsError} />
        <AdminSummaryCard label="Completed" value={summaryValue('completedReferrals')} tone="success" error={statsError} />
        <AdminSummaryCard label="Pending referrals" value={summaryValue('pendingReferrals')} tone="warning" error={statsError} />
        <AdminSummaryCard label="Avg commission" value={summaryValue('avgCommissionPerReferral', money)} error={statsError} />
      </div>

      <AdminFilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search name, email, or code…"
      >
        <AdminField label="Status" htmlFor="aff-status">
          <AdminField.Select
            id="aff-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </AdminField.Select>
        </AdminField>
        <AdminField label="Per page" htmlFor="aff-page-size">
          <AdminField.Select
            id="aff-page-size"
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

      {loading ? <AdminLoadingState label="Loading affiliates" /> : null}
      {!loading && error && affiliates.length === 0 ? (
        <AdminErrorState title="Affiliate list unavailable" message={error} onRetry={load} />
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <AdminEmptyState
          title={searchTerm || selectedStatus !== 'all' ? 'No affiliates match your filters' : 'No affiliates yet'}
          description="Add an affiliate to start tracking referrals and commissions."
          icon={Users}
          action={
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <Plus className="h-4 w-4" aria-hidden /> Add affiliate
            </button>
          }
        />
      ) : null}

      {!loading && pageRows.length > 0 ? (
        <>
          <AdminDataTable
            columns={columns}
            rows={pageRows}
            rowKey="id"
            emptyTitle="No affiliates"
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
                Previous
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
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      <AdminModal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit affiliate' : 'Add affiliate'}
        footer={
          <>
            <button type="button" onClick={closeForm} className={btnGhost} disabled={actionLoading}>
              Cancel
            </button>
            <button type="submit" form="affiliate-form" className={btnPrimary} disabled={actionLoading}>
              {actionLoading ? 'Saving…' : editing ? 'Update' : 'Add'}
            </button>
          </>
        }
      >
        <form id="affiliate-form" onSubmit={handleSave} className="space-y-4">
          <AdminField label="Name" htmlFor="aff-name" required>
            <AdminField.Input
              id="aff-name"
              required
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Email" htmlFor="aff-email" required>
            <AdminField.Input
              id="aff-email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Commission rate (%)" htmlFor="aff-rate" required>
            <AdminField.Input
              id="aff-rate"
              type="number"
              min={1}
              max={50}
              required
              value={formData.commissionRate}
              onChange={(e) => setFormData((p) => ({ ...p, commissionRate: Number(e.target.value) }))}
            />
          </AdminField>
          <AdminField label="Status" htmlFor="aff-form-status">
            <AdminField.Select
              id="aff-form-status"
              value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </AdminField.Select>
          </AdminField>
          <AdminField label="Payment method" htmlFor="aff-pay">
            <AdminField.Select
              id="aff-pay"
              value={formData.paymentMethod}
              onChange={(e) => setFormData((p) => ({ ...p, paymentMethod: e.target.value }))}
            >
              <option value="bank">Bank</option>
              <option value="mobile">Mobile money</option>
              <option value="other">Other</option>
            </AdminField.Select>
          </AdminField>
          {formData.paymentMethod === 'bank' ? (
            <div className="space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3">
              <p className="text-sm font-medium text-[var(--admin-text)]">
                {editing ? 'Update bank details (optional)' : 'Bank details'}
              </p>
              {editing?.bankDetailsMasked ? (
                <p className="text-xs text-[var(--admin-text-muted)]">
                  Current (masked): {formatMaskedBank(editing.bankDetailsMasked) || 'On file'}
                </p>
              ) : null}
              <AdminField label="Account name" htmlFor="bank-name">
                <AdminField.Input
                  id="bank-name"
                  value={formData.bankDetails.accountName}
                  onChange={(e) => setFormData((p) => ({
                    ...p,
                    bankDetails: { ...p.bankDetails, accountName: e.target.value },
                  }))}
                />
              </AdminField>
              <AdminField label="Account number" htmlFor="bank-number">
                <AdminField.Input
                  id="bank-number"
                  value={formData.bankDetails.accountNumber}
                  onChange={(e) => setFormData((p) => ({
                    ...p,
                    bankDetails: { ...p.bankDetails, accountNumber: e.target.value },
                  }))}
                />
              </AdminField>
              <AdminField label="Bank name" htmlFor="bank-bank">
                <AdminField.Input
                  id="bank-bank"
                  value={formData.bankDetails.bankName}
                  onChange={(e) => setFormData((p) => ({
                    ...p,
                    bankDetails: { ...p.bankDetails, bankName: e.target.value },
                  }))}
                />
              </AdminField>
              <AdminField label="SWIFT / branch" htmlFor="bank-swift">
                <AdminField.Input
                  id="bank-swift"
                  value={formData.bankDetails.swiftCode}
                  onChange={(e) => setFormData((p) => ({
                    ...p,
                    bankDetails: { ...p.bankDetails, swiftCode: e.target.value },
                  }))}
                />
              </AdminField>
            </div>
          ) : null}
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(details)}
        onClose={() => setDetails(null)}
        title="Affiliate details"
        footer={
          <button type="button" onClick={() => setDetails(null)} className={btnGhost}>
            Close
          </button>
        }
      >
        {details ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-[var(--admin-text)]">{details.name}</p>
              <p className="text-[var(--admin-text-muted)]">{details.email}</p>
              <p className="font-mono text-xs text-[var(--admin-text-muted)]">
                Code: {details.affiliateCode || '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge tone={statusTone(details.status)}>{details.status}</AdminStatusBadge>
              <AdminStatusBadge tone="info">{details.commissionRate ?? 0}%</AdminStatusBadge>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--admin-text-muted)]">Commissions</dt>
                <dd className="font-medium">{money(details.totalCommissions)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted)]">Pending payouts</dt>
                <dd className="font-medium">{money(details.pendingPayouts)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted)]">Referrals</dt>
                <dd className="font-medium">{details.referralCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted)]">Joined</dt>
                <dd className="font-medium">{fmtDate(details.createdAt)}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                Bank details
              </p>
              <p className="text-[var(--admin-text)]">
                {formatMaskedBank(details.bankDetailsMasked)
                  || (details.hasPaymentDetails ? 'On file (masked)' : 'Not provided')}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                Referral link
              </p>
              <div className="flex gap-2">
                <AdminField.Input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/ref/${details.affiliateCode}` : ''}
                />
                <IconBtn title="Copy link" onClick={() => copyAffiliateLink(details.affiliateCode)}>
                  <Copy className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        open={Boolean(passwordTarget)}
        onClose={() => setPasswordTarget(null)}
        title={`Set password — ${passwordTarget?.name || ''}`}
        footer={
          <>
            <button type="button" onClick={() => setPasswordTarget(null)} className={btnGhost} disabled={actionLoading}>
              Cancel
            </button>
            <button type="submit" form="aff-password-form" className={btnPrimary} disabled={actionLoading}>
              {actionLoading ? 'Saving…' : 'Set password'}
            </button>
          </>
        }
      >
        <form id="aff-password-form" onSubmit={handlePasswordSubmit} className="space-y-4">
          <AdminField label="New password" htmlFor="aff-pw" required hint="At least 8 characters">
            <AdminField.Input
              id="aff-pw"
              type="password"
              required
              minLength={8}
              value={passwordData.password}
              onChange={(e) => setPasswordData((p) => ({ ...p, password: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Confirm password" htmlFor="aff-pw2" required>
            <AdminField.Input
              id="aff-pw2"
              type="password"
              required
              minLength={8}
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))}
            />
          </AdminField>
          <AdminField.Checkbox
            id="notifyAffiliate"
            label="Notify affiliate via email"
            checked={passwordData.notifyAffiliate}
            onChange={(e) => setPasswordData((p) => ({ ...p, notifyAffiliate: e.target.checked }))}
          />
        </form>
      </AdminModal>

      <AdminConfirmationDialog
        open={Boolean(confirmDelete)}
        title="Delete affiliate"
        description={confirmDelete ? `Delete ${confirmDelete.name}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={actionLoading}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </AdminPageContainer>
  );
}

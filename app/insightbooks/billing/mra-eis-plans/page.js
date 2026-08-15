'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, FileCheck } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminLoadingState,
  AdminErrorState,
  AdminDataTable,
  AdminStatusBadge,
  AdminModal,
  AdminField,
} from '@/components/admin';

function fmtMoney(n, currency = 'MWK') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${currency} ${Number(n).toLocaleString()}`;
}

function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'PUBLISHED' || s === 'ACTIVE') return 'success';
  if (s === 'DRAFT' || s === 'PENDING_APPROVAL') return 'warning';
  if (s === 'SUSPENDED' || s === 'RETIRED' || s === 'SUPERSEDED') return 'danger';
  return 'neutral';
}

export default function MraEisPlansAdminPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [latest, setLatest] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    planCode: '',
    name: '',
    publicName: '',
    basePrice: '',
    billingFrequency: 'month',
    isPublic: false,
    isFeatured: false,
    trialEnabled: false,
    trialDays: '14',
    status: 'DRAFT',
    ctaText: 'Subscribe to MRA EIS',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/platform-billing/mra-eis-plans', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load MRA EIS plans');
      setLatest(Array.isArray(body.latest) ? body.latest : []);
    } catch (e) {
      setError(e.message || 'Failed to load plans');
      setLatest([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const published = latest.filter((p) =>
    ['PUBLISHED', 'ACTIVE'].includes(String(p.status || '').toUpperCase())
  ).length;
  const drafts = latest.filter((p) => String(p.status || '').toUpperCase() === 'DRAFT').length;
  const publicCount = latest.filter((p) => p.isPublic).length;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/platform-billing/mra-eis-plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planCode: form.planCode.trim(),
          name: form.name.trim(),
          publicName: form.publicName.trim() || form.name.trim(),
          basePrice: Number(form.basePrice),
          billingFrequency: form.billingFrequency,
          isPublic: form.isPublic,
          isFeatured: form.isFeatured,
          trialEnabled: form.trialEnabled,
          trialDays: form.trialEnabled ? Number(form.trialDays) || null : null,
          status: form.status,
          ctaText: form.ctaText,
          forceNewVersion: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to save plan');
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.billing.mraEisPlans.title')}
        description="Commercial MRA EIS pricing plans (separate from compliance entitlement). Published prices are versioned — material changes create a new version."
        actions={
          <>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-11 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-white px-3 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> {tt('Refresh')}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="admin-btn-primary inline-flex h-11 items-center gap-2 rounded-[var(--admin-radius)] px-3.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden /> {tt('Create plan')}
            </button>
          </>
        }
      />

      <p className="mb-4 rounded-[var(--admin-radius)] border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        {tt('Policy:')} <strong>{tt('subscription first')}</strong> — payment activates the commercial
        subscription; MRA EIS entitlement stays pending admin review before setup/transmit.
        Manage entitlement under Compliance → MRA EIS Entitlement.
      </p>

      {error ? (
        <AdminErrorState title="Unable to load plans" message={error} onRetry={load} />
      ) : null}

      <div className="admin-stagger mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Plan codes" value={latest.length} icon={FileCheck} tone="info" />
        <AdminSummaryCard label="Published" value={published} tone="success" icon={FileCheck} />
        <AdminSummaryCard label="Drafts" value={drafts} tone="warning" icon={FileCheck} />
        <AdminSummaryCard label="Publicly visible" value={publicCount} tone="info" icon={FileCheck} />
      </div>

      {loading ? <AdminLoadingState label="Loading MRA EIS plans" /> : null}

      {!loading ? (
        <AdminDataTable
          emptyTitle="No MRA EIS plans"
          emptyDescription="Create a draft plan or seed will appear from the catalog on first load."
          rows={latest}
          columns={[
            {
              key: 'planCode',
              header: 'Code',
              render: (p) => (
                <div>
                  <div className="font-semibold text-[var(--admin-text)]">{p.planCode}</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">v{p.version}</div>
                </div>
              ),
            },
            {
              key: 'name',
              header: 'Name',
              render: (p) => (
                <div>
                  <div className="font-medium">{p.publicName || p.name}</div>
                  {p.highlightText ? (
                    <div className="text-xs text-[var(--admin-text-muted)]">{p.highlightText}</div>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'price',
              header: 'Price',
              render: (p) => (
                <span className="tabular-nums">
                  {fmtMoney(p.basePrice, p.currency)} / {p.billingFrequency}
                </span>
              ),
            },
            {
              key: 'trial',
              header: 'Trial',
              hideOnMobile: true,
              render: (p) =>
                p.trialEnabled ? `${p.trialDays || '—'} days` : '—',
            },
            {
              key: 'visibility',
              header: 'Public',
              render: (p) => (
                <AdminStatusBadge tone={p.isPublic ? 'success' : 'neutral'}>
                  {p.isPublic ? 'Visible' : 'Hidden'}
                </AdminStatusBadge>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (p) => (
                <AdminStatusBadge tone={statusTone(p.status)}>{p.status}</AdminStatusBadge>
              ),
            },
          ]}
        />
      ) : null}

      <AdminModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create MRA EIS plan"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2 text-sm"
            >
              {tt('Cancel')}
            </button>
            <button
              type="submit"
              form="mra-eis-plan-form"
              disabled={saving}
              className="admin-btn-primary rounded-[var(--admin-radius)] px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
          </>
        }
      >
        <form id="mra-eis-plan-form" className="space-y-3" onSubmit={submit}>
          <AdminField label="Plan code" htmlFor="planCode">
            <AdminField.Input
              id="planCode"
              required
              value={form.planCode}
              onChange={(e) => setForm((f) => ({ ...f, planCode: e.target.value }))}
              placeholder={tt('eis-monthly')}
            />
          </AdminField>
          <AdminField label="Internal name" htmlFor="name">
            <AdminField.Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Public name" htmlFor="publicName">
            <AdminField.Input
              id="publicName"
              value={form.publicName}
              onChange={(e) => setForm((f) => ({ ...f, publicName: e.target.value }))}
            />
          </AdminField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AdminField label="Base price" htmlFor="basePrice">
              <AdminField.Input
                id="basePrice"
                type="number"
                min="0"
                step="1"
                required
                value={form.basePrice}
                onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
              />
            </AdminField>
            <AdminField label="Billing frequency" htmlFor="billingFrequency">
              <AdminField.Select
                id="billingFrequency"
                value={form.billingFrequency}
                onChange={(e) => setForm((f) => ({ ...f, billingFrequency: e.target.value }))}
              >
                <option value="month">{tt('Monthly')}</option>
                <option value="year">{tt('Annual')}</option>
                <option value="quarter">{tt('Quarterly')}</option>
              </AdminField.Select>
            </AdminField>
          </div>
          <AdminField label="Status" htmlFor="status">
            <AdminField.Select
              id="status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="DRAFT">{tt('Draft')}</option>
              <option value="PUBLISHED">{tt('Published')}</option>
            </AdminField.Select>
          </AdminField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
            />
            {tt('Publicly visible on landing/pricing')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
            />
            {tt('Featured / recommended')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.trialEnabled}
              onChange={(e) => setForm((f) => ({ ...f, trialEnabled: e.target.checked }))}
            />
            {tt('Trial enabled')}
          </label>
          {form.trialEnabled ? (
            <AdminField label="Trial days" htmlFor="trialDays">
              <AdminField.Input
                id="trialDays"
                type="number"
                min="1"
                value={form.trialDays}
                onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
              />
            </AdminField>
          ) : null}
        </form>
      </AdminModal>
    </AdminPageContainer>
  );
}

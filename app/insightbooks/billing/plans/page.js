'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
  AdminDataTable,
  AdminModal,
  AdminField,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

export default function AdminBillingPlansPage() {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    planCode: '',
    name: '',
    basePrice: '',
    currency: 'MWK',
    billingFrequency: 'month',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform-billing/plans', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load plans');
      setLatest(body.latest || body.plans || []);
    } catch (e) {
      setError(e.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createVersion = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform-billing/plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          basePrice: Number(form.basePrice),
          forceNewVersion: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create plan version');
      setShowForm(false);
      setForm({
        planCode: '',
        name: '',
        basePrice: '',
        currency: 'MWK',
        billingFrequency: 'month',
      });
      await load();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'planCode',
        header: 'Code',
        render: (p) => <span className="font-mono text-xs text-[var(--admin-text)]">{p.planCode}</span>,
      },
      {
        key: 'name',
        header: 'Name',
        render: (p) => <span className="font-medium text-[var(--admin-text)]">{p.name}</span>,
      },
      {
        key: 'version',
        header: 'Version',
        render: (p) => `v${p.version}`,
      },
      {
        key: 'basePrice',
        header: 'Price',
        cellClassName: 'tabular-nums',
        render: (p) => `${p.currency} ${Number(p.basePrice).toLocaleString()}`,
      },
      {
        key: 'billingFrequency',
        header: 'Frequency',
      },
      {
        key: 'status',
        header: 'Status',
        render: (p) => (
          <AdminStatusBadge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {p.status}
          </AdminStatusBadge>
        ),
      },
    ],
    []
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Subscription Plans"
        description="Versioned platform plans. Price changes create a new version — existing subscriptions keep agreed pricing until changed explicitly."
        actions={
          <>
            <button type="button" onClick={load} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </button>
            <button type="button" onClick={() => setShowForm(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" aria-hidden /> New version
            </button>
          </>
        }
      />

      {loading ? <AdminLoadingState label="Loading plans" /> : null}
      {!loading && error && latest.length === 0 ? (
        <AdminErrorState message={error} onRetry={load} />
      ) : null}
      {!loading && !error && latest.length === 0 ? (
        <AdminEmptyState title="No plans" description="Plans will seed from the catalog on first load." />
      ) : null}
      {!loading && latest.length > 0 ? <AdminDataTable columns={columns} rows={latest} rowKey="id" /> : null}

      <AdminModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create plan version"
        footer={
          <>
            <button type="button" onClick={() => setShowForm(false)} className={btnGhost}>
              Cancel
            </button>
            <button type="submit" form="plan-version-form" disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Create version'}
            </button>
          </>
        }
      >
        <p className="mb-4 text-xs text-[var(--admin-text-muted)]">
          Creating a new version supersedes the previous ACTIVE version for that plan code.
        </p>
        <form id="plan-version-form" onSubmit={createVersion} className="space-y-3">
          <AdminField label="Plan code" htmlFor="planCode" required>
            <AdminField.Input
              id="planCode"
              required
              value={form.planCode}
              onChange={(e) => setForm((p) => ({ ...p, planCode: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Name" htmlFor="planName" required>
            <AdminField.Input
              id="planName"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Base price" htmlFor="basePrice" required>
            <AdminField.Input
              id="basePrice"
              required
              type="number"
              value={form.basePrice}
              onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Currency" htmlFor="currency">
            <AdminField.Input
              id="currency"
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Billing frequency" htmlFor="billingFrequency">
            <AdminField.Select
              id="billingFrequency"
              value={form.billingFrequency}
              onChange={(e) => setForm((p) => ({ ...p, billingFrequency: e.target.value }))}
            >
              <option value="month">month</option>
              <option value="year">year</option>
            </AdminField.Select>
          </AdminField>
        </form>
      </AdminModal>
    </AdminPageContainer>
  );
}

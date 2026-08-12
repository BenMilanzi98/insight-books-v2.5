'use client';

import { useCallback, useEffect, useState } from 'react';

function Banner({ tone, children }) {
  const cls =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-slate-200 bg-slate-50 text-slate-800';
  return <div className={`rounded border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export default function TenantMraEisSettingsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mra-eis/availability');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load EIS availability');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function participation(action) {
    setError('');
    setMessage('');
    if ((action === 'pause' || action === 'opt_out') && !reason.trim()) {
      setError('A reason is required.');
      return;
    }
    const res = await fetch('/api/mra-eis/participation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || 'Action failed');
      return;
    }
    setMessage('Participation updated. Historical records are preserved.');
    setReason('');
    load();
  }

  async function businessAction(action) {
    setError('');
    setMessage('');
    if ((action === 'pause' || action === 'disable') && !reason.trim()) {
      setError('A reason is required.');
      return;
    }
    const res = await fetch('/api/mra-eis/business-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ action, reason, mode: 'DISABLE_BEFORE_ACTIVATION' }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || 'Action failed');
      return;
    }
    setMessage(json.message || 'Business EIS setting updated.');
    setReason('');
    load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">
        Loading MRA EIS availability…
      </div>
    );
  }

  const entitled = Boolean(data?.entitlement) &&
    ['ENTITLED_SANDBOX_ONLY', 'ENTITLED_PRODUCTION'].includes(data?.entitlement?.status);
  const managementUnlocked = Boolean(data?.managementAccess?.unlocked);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">Integrations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">MRA Electronic Invoicing (EIS)</h1>
        <p className="mt-2 text-sm text-slate-600">
          Local sales and accounting continue normally whether or not EIS is enabled. EIS is a compliance
          integration controlled by InsightBooks System Administration.
        </p>
      </header>

      {error && <Banner tone="danger">{error}</Banner>}
      {message && (
        <div className="mb-4">
          <Banner tone="ok">{message}</Banner>
        </div>
      )}

      {managementUnlocked ? (
        <div className="mb-6">
          <Banner tone="ok">
            Full MRA EIS management is unlocked
            {data?.managementAccess?.via
              ? ` via ${String(data.managementAccess.via).replace(/_/g, ' ')}`
              : ''}
            . Use the section navigation above or the sidebar MRA EIS Centre menu.
          </Banner>
        </div>
      ) : (
        <div className="mb-6">
          <Banner tone="warn">
            {!entitled
              ? 'EIS is not currently entitled for this business. Full management unlocks with an active MRA EIS subscription or after System Administration grants entitlement.'
              : 'Full MRA EIS management is not unlocked yet.'}{' '}
            Subscribe under Billing or contact InsightBooks support. There are no credential fields on this hub.
          </Banner>
        </div>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Availability</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Entitlement</dt>
            <dd className="font-medium">{data?.entitlementLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Participation</dt>
            <dd className="font-medium">{data?.participationLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Business operational status</dt>
            <dd className="font-medium">{data?.businessLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Allowed environment</dt>
            <dd className="font-medium">
              {data?.entitlement?.productionAllowed ? 'Sandbox + Production (authorized)' : data?.entitlement?.sandboxAllowed ? 'Sandbox only' : 'None'}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          System-controlled fields (not editable here): entitlement status, sandbox/production authorization,
          effective dates.
        </p>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Blockers & warnings</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {(data?.readiness?.blockers || []).slice(0, 12).map((b) => (
            <li key={b.code}>
              <span className="font-medium">{b.code}</span>: {b.message}
            </li>
          ))}
        </ul>
        {(data?.readiness?.warnings || []).length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {data.readiness.warnings.map((w) => (
              <li key={w.code}>
                {w.code}: {w.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      {entitled && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Participation & setup</h2>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Reason (for pause / opt-out / disable)</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" onClick={() => participation('opt_in')}>
              Opt in
            </button>
            <button type="button" className="rounded bg-amber-700 px-3 py-2 text-sm text-white" onClick={() => participation('pause')}>
              Pause participation
            </button>
            <button type="button" className="rounded bg-slate-800 px-3 py-2 text-sm text-white" onClick={() => participation('resume')}>
              Resume participation
            </button>
            <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => participation('opt_out')}>
              Opt out
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => businessAction('start_setup')}>
              Start setup
            </button>
            <button type="button" className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={() => businessAction('enable')}>
              Mark ready for activation
            </button>
            <button type="button" className="rounded bg-amber-700 px-3 py-2 text-sm text-white" onClick={() => businessAction('pause')}>
              Pause business operation
            </button>
            <button type="button" className="rounded border border-red-300 px-3 py-2 text-sm text-red-800" onClick={() => businessAction('disable')}>
              Disable before activation
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Configuration sync, product mapping and fiscal transmission remain Phase 8+. Offline mode is not
            available. Terminal onboarding (Phase 7) can proceed when readiness passes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <a
              href="/settings/integrations/mra-eis/terminals"
              className="inline-block rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Manage terminals & onboarding
            </a>
            <a
              href="/settings/integrations/mra-eis/mappings"
              className="inline-block rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Site, tax & payment mappings
            </a>
            <a
              href="/settings/integrations/mra-eis/catalogue"
              className="inline-block rounded bg-emerald-900 px-3 py-2 text-sm font-medium text-white"
            >
              Product & service catalogue
            </a>
            <a
              href="/settings/integrations/mra-eis/sales-bridge"
              className="inline-block rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800"
            >
              Sales eligibility & bridge
            </a>
            <a
              href="/settings/integrations/mra-eis/fiscal-snapshots"
              className="inline-block rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Fiscal snapshots & sequences
            </a>
            <a
              href="/settings/integrations/mra-eis/sales-transmission"
              className="inline-block rounded bg-rose-900 px-3 py-2 text-sm font-medium text-white"
            >
              Sales transmission
            </a>
            <a
              href="/settings/integrations/mra-eis/fiscal-receipts"
              className="inline-block rounded bg-teal-900 px-3 py-2 text-sm font-medium text-white"
            >
              Fiscal receipts &amp; QR
            </a>
            <a
              href="/settings/integrations/mra-eis/reconciliation"
              className="inline-block rounded bg-orange-900 px-3 py-2 text-sm font-medium text-white"
            >
              Reconciliation &amp; recovery
            </a>
            <a
              href="/settings/integrations/mra-eis/offline"
              className="inline-block rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white"
            >
              Certified Offline
            </a>
            <a
              href="/settings/integrations/mra-eis/restrictions"
              className="inline-block rounded bg-red-900 px-3 py-2 text-sm font-medium text-white"
            >
              Restrictions &amp; Unblock
            </a>
            <a
              href="/settings/integrations/mra-eis/centre"
              className="inline-block rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              EIS Administration Centre
            </a>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Recent control audit</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(data?.audit || []).map((a) => (
            <li key={a.id} className="rounded border border-slate-100 px-3 py-2">
              <div className="font-medium">{a.action}</div>
              <div className="text-xs text-slate-500">{a.createdAt}</div>
            </li>
          ))}
          {(data?.audit || []).length === 0 && <li className="text-slate-500">No control events yet.</li>}
        </ul>
      </section>
    </div>
  );
}

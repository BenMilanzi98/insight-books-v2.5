'use client';

import { useCallback, useEffect, useState } from 'react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'MRA Products' },
  { id: 'services', label: 'MRA Services' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'inventory', label: 'Initial Inventory' },
];

function Badge({ status }) {
  const tone =
    status === 'ACTIVE' || status === 'COMPLETE_FOR_CURRENT_USAGE'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : status === 'SUGGESTED'
        ? 'bg-sky-50 text-sky-900 border-sky-200'
        : 'bg-amber-50 text-amber-950 border-amber-200';
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${tone}`}>
      <span className="sr-only">Status: </span>
      {status}
    </span>
  );
}

export default function MraEisCataloguePage() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [terminalId, setTerminalId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cat, inv] = await Promise.all([
        fetch('/api/mra-eis/catalogue?environment=SANDBOX').then((r) => r.json()),
        fetch('/api/mra-eis/catalogue/inventory?environment=SANDBOX').then((r) => r.json()),
      ]);
      if (!cat.success) throw new Error(cat?.error?.message || 'Failed to load catalogue');
      setData(cat.data);
      setInventory(inv.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sync(catalogueType) {
    if (!terminalId.trim()) {
      setError('Enter an active terminal ID to synchronize the catalogue (MOCK only).');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/mra-eis/catalogue/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ terminalId, catalogueType, executeNow: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Sync failed');
      setMessage(json.message || 'Catalogue synchronized. Local master data was not modified.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function suggest(kind) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/mra-eis/catalogue/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ kind, persist: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Suggest failed');
      setMessage('Suggestions generated. They are not active.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(kind, id, action, version) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/mra-eis/mappings/${kind}/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ environment: 'SANDBOX', expectedVersion: version }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `${action} failed`);
      setMessage(`${kind} mapping ${action} succeeded.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    setBusy(true);
    try {
      const res = await fetch('/api/mra-eis/catalogue/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconcile' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Reconcile failed');
      setMessage(`Read-only reconciliation: ${json.data.lines?.length || 0} lines. No stock adjusted.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600" role="status">
        Loading catalogue workspace…
      </div>
    );
  }

  const products = (data?.items || []).filter((i) => i.externalType === 'PRODUCT');
  const services = (data?.items || []).filter((i) => i.externalType === 'SERVICE');
  const mappings = data?.mappings || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">
          <a href="/settings/integrations/mra-eis" className="hover:underline">
            MRA EIS
          </a>{' '}
          / Catalogue
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Product & Service Catalogue</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          External MRA catalogue is separate from local Products and Services. Sync never creates local items,
          overwrites prices/taxes, or adjusts stock. Suggestions never auto-activate.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {message}
        </div>
      )}

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Catalogue sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-2 text-sm ${tab === t.id ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Business type', data?.businessType?.businessType],
              ['Completeness', data?.completeness?.overallStatus],
              ['Products required', data?.completeness?.localProductsRequired],
              ['Products mapped', data?.completeness?.localProductsMapped],
              ['Services required', data?.completeness?.localServicesRequired],
              ['Services mapped', data?.completeness?.localServicesMapped],
              ['Product sync contract', data?.contracts?.product?.status],
              ['Inventory contract', data?.contracts?.initialInventory?.status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Blockers</h2>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {(data?.completeness?.blockers || []).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <h2 className="mt-4 font-semibold">Warnings</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
              {(data?.completeness?.warnings || []).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <label className="block text-sm">
            Terminal ID (MOCK sync)
            <input
              className="mt-1 w-full max-w-md rounded border px-3 py-2 font-mono text-xs"
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="rounded bg-indigo-800 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => sync('PRODUCTS')}>
              Sync products (MOCK)
            </button>
            <button type="button" disabled={busy} className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => sync('SERVICES')}>
              Sync services (MOCK)
            </button>
            <button type="button" disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => suggest('PRODUCT')}>
              Suggest product mappings
            </button>
            <button type="button" disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => suggest('SERVICE')}>
              Suggest service mappings
            </button>
          </div>
        </section>
      )}

      {tab === 'products' && (
        <section>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">External MRA products (read-only)</caption>
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Barcode</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">UOM</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Ext qty</th>
                  <th className="px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{p.mraCode}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.barcode || '—'}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">{p.unitOfMeasure || '—'}</td>
                    <td className="px-3 py-2">{String(p.sellingPrice ?? '—')}</td>
                    <td className="px-3 py-2">{String(p.quantity ?? '—')}</td>
                    <td className="px-3 py-2">{p.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-slate-500">
                      No external products. Run MOCK sync after terminal + site mapping are ready.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'services' && (
        <section>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{s.mraCode}</td>
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2">{s.unitOfMeasure || '—'}</td>
                    <td className="px-3 py-2">{String(s.sellingPrice ?? '—')}</td>
                    <td className="px-3 py-2">{s.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-slate-500">
                      No external services yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'mappings' && (
        <section>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Local</th>
                  <th className="px-3 py-2">External</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => {
                  const kind = m.localServiceId ? 'SERVICE' : 'PRODUCT';
                  return (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{m.mappingType}</td>
                      <td className="px-3 py-2 font-mono text-xs">{m.localItemId || m.localServiceId}</td>
                      <td className="px-3 py-2 font-mono text-xs">{m.externalCatalogueItemId}</td>
                      <td className="px-3 py-2">
                        <Badge status={m.status} />
                        {m.status === 'SUGGESTED' && <span className="ml-2 text-xs text-slate-500">(not active)</span>}
                      </td>
                      <td className="px-3 py-2">
                        {['SUGGESTED', 'MATCHED'].includes(m.status) && (
                          <button type="button" className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => lifecycle(kind, m.id, 'verify', m.version)}>
                            Verify
                          </button>
                        )}
                        {m.status === 'VERIFIED' && (
                          <button type="button" className="ml-1 rounded bg-slate-900 px-2 py-1 text-xs text-white" disabled={busy} onClick={() => lifecycle(kind, m.id, 'activate', m.version)}>
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'inventory' && (
        <section className="space-y-4">
          <p className="text-sm text-slate-600">
            Local Inventory remains the operational source of truth. Reconciliation is read-only. Initial upload
            remains blocked until the MRA contract is verified. This page cannot adjust stock.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['MRA inventory required (eval)', inventory?.mraInventoryRequired ? 'Yes' : 'No'],
              ['Upload required', inventory?.initialUploadRequired ? 'Yes' : 'No'],
              ['Contract verified', inventory?.initialUploadContractVerified ? 'Yes' : 'No'],
              ['Virtual warehouse', inventory?.virtualWarehouseRequired ? 'Blocked / required' : 'N/A'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-white p-4">
                <div className="text-xs uppercase text-slate-500">{k}</div>
                <div className="font-semibold">{String(v)}</div>
              </div>
            ))}
          </div>
          <button type="button" disabled={busy} className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={reconcile}>
            Run read-only reconciliation
          </button>
        </section>
      )}
    </div>
  );
}

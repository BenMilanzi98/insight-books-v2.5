'use client';

/**
 * Equity Management (Phase 11) — configuration, owners, transactions, dividends, recon.
 * Server-authoritative totals; posting via Posting Engine only.
 */

import { useCallback, useEffect, useState } from 'react';
import { Landmark, Users, Plus, RefreshCw, AlertCircle, CheckCircle2, Scale } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';


async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export default function EquityManagementPage() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [config, setConfig] = useState(null);
  const [owners, setOwners] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    partyName: '',
    relationshipType: 'OWNER',
  });
  const [txForm, setTxForm] = useState({
    transactionType: 'CAPITAL_CONTRIBUTION',
    relationshipId: '',
    amount: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    bankAccountId: '',
    description: '',
  });
  const [cfgForm, setCfgForm] = useState({
    legalStructure: 'SOLE_PROPRIETORSHIP',
    equityModel: 'OWNER_CAPITAL',
  });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [d, c, o, t] = await Promise.all([
        api('/api/equity-management/dashboard').catch(() => ({ dashboard: null })),
        api('/api/equity-management/config').catch(() => ({ configuration: null })),
        api('/api/equity-management/owners'),
        api('/api/equity-management/transactions'),
      ]);
      setDashboard(d.dashboard);
      setConfig(c.configuration);
      if (c.configuration) {
        setCfgForm({
          legalStructure: c.configuration.legalStructure,
          equityModel: c.configuration.equityModel,
        });
      }
      setOwners(o.owners || []);
      setTransactions(t.transactions || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = async () => {
    setBusy(true);
    try {
      await api('/api/equity-management/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfgForm),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createOwner = async () => {
    setBusy(true);
    try {
      await api('/api/equity-management/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ownerForm),
      });
      setOwnerForm({ partyName: '', relationshipType: 'OWNER' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createAndPostContribution = async () => {
    setBusy(true);
    try {
      const { transaction } = await api('/api/equity-management/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txForm),
      });
      await api(`/api/equity-management/transactions/${transaction.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      // Second user should approve in production; pilot path may use same user if SoD off
      try {
        await api(`/api/equity-management/transactions/${transaction.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: 'Approved' }),
        });
      } catch {
        /* SoD may block — leave pending */
      }
      const preview = await api(`/api/equity-management/transactions/${transaction.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (preview.balanced) {
        try {
          await api(`/api/equity-management/transactions/${transaction.id}/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
        } catch {
          /* may need approval first */
        }
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runRecon = async () => {
    setBusy(true);
    try {
      await api('/api/equity-management/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-secondary)] py-2 md:py-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Equity Management"
          description="Owners, capital, drawings, and dividends post through the Accounting Posting Engine. Balances derive from journals — never typed independently. Contributions are not revenue; drawings are not expenses; dividends are not operating expenses."
          breadcrumb={<Scale className="h-5 w-5 text-[var(--action-primary)]" aria-hidden="true" />}
          actions={
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
            </button>
          }
        />


        {error ? (
          <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}

        <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-sm">
          {['dashboard', 'config', 'owners', 'transactions'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 font-medium capitalize ${tab === t ? 'bg-indigo-700 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === 'dashboard' && dashboard ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Owners / partners" value={dashboard.ownerCount} icon={Users} />
            <Stat label="Contributions posted" value={dashboard.contributionsPosted} icon={Landmark} />
            <Stat label="Drawings posted" value={dashboard.drawingsPosted} />
            <Stat label="Dividends paid" value={dashboard.dividendsPaid} />
            <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
              {dashboard.note}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={runRecon} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-white">
                  Run equity reconciliation
                </button>
                {dashboard.lastReconciliation ? (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${dashboard.lastReconciliation.overallOk ? 'text-emerald-600' : 'text-amber-600'}`} />
                    Last recon OK: {String(dashboard.lastReconciliation.overallOk)}
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'config' ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3 max-w-lg">
            <h2 className="text-sm font-semibold">Business equity configuration</h2>
            <label className="block text-xs text-slate-500">Legal structure
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={cfgForm.legalStructure} onChange={(e) => setCfgForm((f) => ({ ...f, legalStructure: e.target.value }))}>
                <option value="SOLE_PROPRIETORSHIP">Sole proprietorship</option>
                <option value="PARTNERSHIP">Partnership</option>
                <option value="PRIVATE_COMPANY">Private company</option>
                <option value="PUBLIC_COMPANY">Public company</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500">Equity model
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={cfgForm.equityModel} onChange={(e) => setCfgForm((f) => ({ ...f, equityModel: e.target.value }))}>
                <option value="OWNER_CAPITAL">Owner capital</option>
                <option value="PARTNER_CAPITAL">Partner capital</option>
                <option value="SHARE_CAPITAL">Share capital</option>
                <option value="HYBRID_APPROVED_MODEL">Hybrid</option>
              </select>
            </label>
            <button type="button" onClick={saveConfig} className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white">Save configuration</button>
            {config ? <p className="text-xs text-slate-500">Current: {config.legalStructure} / {config.equityModel}</p> : null}
          </section>
        ) : null}

        {tab === 'owners' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add owner / partner / shareholder</h2>
              <div className="mt-3 space-y-2">
                <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Name" value={ownerForm.partyName} onChange={(e) => setOwnerForm((f) => ({ ...f, partyName: e.target.value }))} />
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={ownerForm.relationshipType} onChange={(e) => setOwnerForm((f) => ({ ...f, relationshipType: e.target.value }))}>
                  <option value="OWNER">Owner</option>
                  <option value="PARTNER">Partner</option>
                  <option value="SHAREHOLDER">Shareholder</option>
                </select>
                <button type="button" onClick={createOwner} className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white">Create</button>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Register</h2>
              <ul className="mt-2 max-h-80 overflow-auto text-sm divide-y">
                {owners.map((o) => (
                  <li key={o.id} className="py-2 flex justify-between gap-2">
                    <span>{o.partyName} <span className="text-xs text-slate-500">({o.relationshipType})</span></span>
                    <span className="text-xs font-medium">{o.ownershipStatus}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {tab === 'transactions' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
              <h2 className="text-sm font-semibold">New equity transaction</h2>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={txForm.transactionType} onChange={(e) => setTxForm((f) => ({ ...f, transactionType: e.target.value }))}>
                <option value="CAPITAL_CONTRIBUTION">Capital contribution</option>
                <option value="OWNER_DRAWING">Owner drawing</option>
                <option value="OWNER_LOAN_ADVANCE">Owner loan (not capital)</option>
                <option value="SHARE_ISSUANCE">Share issuance</option>
                <option value="DIVIDEND_DECLARATION">Dividend declaration</option>
              </select>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={txForm.relationshipId} onChange={(e) => setTxForm((f) => ({ ...f, relationshipId: e.target.value }))}>
                <option value="">Select owner…</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.partyName}</option>
                ))}
              </select>
              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Amount" value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))} />
              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Bank/Cash CoA account id" value={txForm.bankAccountId} onChange={(e) => setTxForm((f) => ({ ...f, bankAccountId: e.target.value }))} />
              <input type="date" className="w-full rounded-md border px-3 py-2 text-sm" value={txForm.transactionDate} onChange={(e) => setTxForm((f) => ({ ...f, transactionDate: e.target.value }))} />
              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Description" value={txForm.description} onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))} />
              <button type="button" onClick={createAndPostContribution} className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white">Create → approve → preview → post</button>
              <p className="text-xs text-slate-500">Accounting preview runs server-side before post. Posted journals are immutable.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Recent transactions</h2>
              <ul className="mt-2 max-h-96 overflow-auto text-xs divide-y">
                {transactions.map((t) => (
                  <li key={t.id} className="py-2">
                    <div className="font-medium">{t.transactionNumber} · {t.transactionType}</div>
                    <div className="text-slate-500">{String(t.amount)} · {t.status} · acct:{t.accountingStatus}</div>
                    {t.journalEntryId ? <div className="text-emerald-700">JE {t.journalEntryId}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value ?? '—'}</div>
    </div>
  );
}

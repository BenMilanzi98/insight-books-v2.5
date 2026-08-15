'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Equity Management (Phase 11) — configuration, owners, transactions, dividends, recon.
 * Server-authoritative totals; posting via Posting Engine only.
 */

import { useCallback, useEffect, useState } from 'react';
import { Landmark, Users, Plus, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';
import StatCard from '@/components/ui/StatCard';


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
    <div className="w-full">
      <div className="mx-auto max-w-6xl space-y-6">
        <PosStylePageHeader
          title="Equity Management"
          description="Owners, capital, drawings, and dividends post through the Accounting Posting Engine. Balances derive from journals — never typed independently. Contributions are not revenue; drawings are not expenses; dividends are not operating expenses."
          actions={
            <PosStyleHeaderButton type="button" onClick={load}>
              <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
              {tt('Refresh')}
            </PosStyleHeaderButton>
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
              className={`rounded-md px-3 py-1.5 font-medium capitalize ${tab === t ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white/80 text-slate-700 backdrop-blur-sm hover:bg-white hover:shadow-md'}`}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === 'dashboard' && dashboard ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Owners / partners" value={dashboard.ownerCount ?? '—'} icon={Users} />
            <StatCard label="Contributions posted" value={dashboard.contributionsPosted ?? '—'} icon={Landmark} />
            <StatCard label="Drawings posted" value={dashboard.drawingsPosted ?? '—'} />
            <StatCard label="Dividends paid" value={dashboard.dividendsPaid ?? '—'} />
            <PosStylePanel className="p-4 text-sm text-slate-600 sm:col-span-2 lg:col-span-4">
              {dashboard.note}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={runRecon} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-white">
                  {tt('Run equity reconciliation')}
                </button>
                {dashboard.lastReconciliation ? (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${dashboard.lastReconciliation.overallOk ? 'text-emerald-600' : 'text-amber-600'}`} />
                    Last recon OK: {String(dashboard.lastReconciliation.overallOk)}
                  </span>
                ) : null}
              </div>
            </PosStylePanel>
          </section>
        ) : null}

        {tab === 'config' ? (
          <PosStylePanel className="max-w-lg space-y-3 p-4" as="section">
            <h2 className="text-sm font-semibold">{tt('Business equity configuration')}</h2>
            <label className="block text-xs text-slate-500">{tt('Legal structure')}
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={cfgForm.legalStructure} onChange={(e) => setCfgForm((f) => ({ ...f, legalStructure: e.target.value }))}>
                <option value="SOLE_PROPRIETORSHIP">{tt('Sole proprietorship')}</option>
                <option value="PARTNERSHIP">{tt('Partnership')}</option>
                <option value="PRIVATE_COMPANY">{tt('Private company')}</option>
                <option value="PUBLIC_COMPANY">{tt('Public company')}</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500">{tt('Equity model')}
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={cfgForm.equityModel} onChange={(e) => setCfgForm((f) => ({ ...f, equityModel: e.target.value }))}>
                <option value="OWNER_CAPITAL">{tt('Owner capital')}</option>
                <option value="PARTNER_CAPITAL">{tt('Partner capital')}</option>
                <option value="SHARE_CAPITAL">{tt('Share capital')}</option>
                <option value="HYBRID_APPROVED_MODEL">{tt('Hybrid')}</option>
              </select>
            </label>
            <button type="button" onClick={saveConfig} className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">{tt('Save configuration')}</button>
            {config ? <p className="text-xs text-slate-500">Current: {config.legalStructure} / {config.equityModel}</p> : null}
          </PosStylePanel>
        ) : null}

        {tab === 'owners' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <PosStylePanel className="p-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> {tt('Add owner / partner / shareholder')}</h2>
              <div className="mt-3 space-y-2">
                <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder={tt('Name')} value={ownerForm.partyName} onChange={(e) => setOwnerForm((f) => ({ ...f, partyName: e.target.value }))} />
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={ownerForm.relationshipType} onChange={(e) => setOwnerForm((f) => ({ ...f, relationshipType: e.target.value }))}>
                  <option value="OWNER">{tt('Owner')}</option>
                  <option value="PARTNER">{tt('Partner')}</option>
                  <option value="SHAREHOLDER">{tt('Shareholder')}</option>
                </select>
                <button type="button" onClick={createOwner} className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">{tt('Create')}</button>
              </div>
            </PosStylePanel>
            <PosStylePanel className="p-4">
              <h2 className="text-sm font-semibold">{tt('Register')}</h2>
              <ul className="mt-2 max-h-80 overflow-auto text-sm divide-y">
                {owners.map((o) => (
                  <li key={o.id} className="py-2 flex justify-between gap-2">
                    <span>{o.partyName} <span className="text-xs text-slate-500">({o.relationshipType})</span></span>
                    <span className="text-xs font-medium">{o.ownershipStatus}</span>
                  </li>
                ))}
              </ul>
            </PosStylePanel>
          </section>
        ) : null}

        {tab === 'transactions' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <PosStylePanel className="space-y-2 p-4">
              <h2 className="text-sm font-semibold">{tt('New equity transaction')}</h2>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={txForm.transactionType} onChange={(e) => setTxForm((f) => ({ ...f, transactionType: e.target.value }))}>
                <option value="CAPITAL_CONTRIBUTION">{tt('Capital contribution')}</option>
                <option value="OWNER_DRAWING">{tt('Owner drawing')}</option>
                <option value="OWNER_LOAN_ADVANCE">Owner loan (not capital)</option>
                <option value="SHARE_ISSUANCE">{tt('Share issuance')}</option>
                <option value="DIVIDEND_DECLARATION">{tt('Dividend declaration')}</option>
              </select>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={txForm.relationshipId} onChange={(e) => setTxForm((f) => ({ ...f, relationshipId: e.target.value }))}>
                <option value="">{tt('Select owner…')}</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.partyName}</option>
                ))}
              </select>
              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder={tt('Amount')} value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))} />
              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder={tt('Bank/Cash CoA account id')} value={txForm.bankAccountId} onChange={(e) => setTxForm((f) => ({ ...f, bankAccountId: e.target.value }))} />
              <input type="date" className="w-full rounded-md border px-3 py-2 text-sm" value={txForm.transactionDate} onChange={(e) => setTxForm((f) => ({ ...f, transactionDate: e.target.value }))} />
              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder={tt('Description')} value={txForm.description} onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))} />
              <button type="button" onClick={createAndPostContribution} className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">{tt('Create → approve → preview → post')}</button>
              <p className="text-xs text-slate-500">{tt('Accounting preview runs server-side before post. Posted journals are immutable.')}</p>
            </PosStylePanel>
            <PosStylePanel className="p-4">
              <h2 className="text-sm font-semibold">{tt('Recent transactions')}</h2>
              <ul className="mt-2 max-h-96 overflow-auto text-xs divide-y">
                {transactions.map((t) => (
                  <li key={t.id} className="py-2">
                    <div className="font-medium">{t.transactionNumber} · {t.transactionType}</div>
                    <div className="text-slate-500">{String(t.amount)} · {t.status} · acct:{t.accountingStatus}</div>
                    {t.journalEntryId ? <div className="text-emerald-700">JE {t.journalEntryId}</div> : null}
                  </li>
                ))}
              </ul>
            </PosStylePanel>
          </section>
        ) : null}
      </div>
    </div>
  );
}

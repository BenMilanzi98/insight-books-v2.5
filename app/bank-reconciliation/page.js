'use client';

/**
 * Bank Reconciliation (Phase 10) — PaymentAccount statement matching workspace.
 * Server-authoritative totals only; all actions go through /api/bank-reconciliation/*.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Landmark,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Link2,
  FileSpreadsheet,
  PlayCircle,
} from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';


async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

const fmt = (d) => (d ? String(d).slice(0, 10) : '—');
const money = (v) => (v == null ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }));

const STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  REOPENED: 'bg-violet-100 text-violet-800',
  REVERSED: 'bg-rose-100 text-rose-800',
};

export default function BankReconciliationPage() {
  const [accounts, setAccounts] = useState([]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [reconciliations, setReconciliations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createForm, setCreateForm] = useState({
    statementDate: new Date().toISOString().slice(0, 10),
    statementClosingBalance: '',
    statementOpeningBalance: '',
  });
  const [file, setFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [selectedStmt, setSelectedStmt] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const notify = (msg, isErr) => {
    if (isErr) setError(msg);
    else setError('');
  };

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api('/api/bank-reconciliation/accounts');
      setAccounts(data.accounts || []);
      if (!paymentAccountId && data.accounts?.[0]) {
        setPaymentAccountId(data.accounts[0].id);
      }
    } catch (e) {
      notify(e.message, true);
    }
  }, [paymentAccountId]);

  const loadList = useCallback(async (paId) => {
    if (!paId) return;
    try {
      const data = await api(`/api/bank-reconciliation/reconciliations?paymentAccountId=${paId}`);
      setReconciliations(data.reconciliations || []);
    } catch (e) {
      notify(e.message, true);
    }
  }, []);

  const loadWorkspace = useCallback(async (id) => {
    if (!id) return;
    setBusy(true);
    try {
      const data = await api(`/api/bank-reconciliation/reconciliations/${id}`);
      setWorkspace(data);
      setActiveId(id);
      const paId = data.reconciliation?.paymentAccountId;
      if (paId) {
        const cand = await api(`/api/bank-reconciliation/candidates?paymentAccountId=${paId}`);
        setCandidates(cand.candidates || []);
      }
      notify('');
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (paymentAccountId) loadList(paymentAccountId);
  }, [paymentAccountId, loadList]);

  const createRecon = async () => {
    setBusy(true);
    try {
      const data = await api('/api/bank-reconciliation/reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentAccountId,
          ...createForm,
        }),
      });
      await loadList(paymentAccountId);
      await loadWorkspace(data.reconciliation.id);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action, body = {}) => {
    if (!activeId) return;
    setBusy(true);
    try {
      await api(`/api/bank-reconciliation/reconciliations/${activeId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await loadWorkspace(activeId);
      await loadList(paymentAccountId);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const previewImport = async () => {
    if (!file || !paymentAccountId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('paymentAccountId', paymentAccountId);
      if (createForm.statementOpeningBalance) fd.append('statementOpening', createForm.statementOpeningBalance);
      if (createForm.statementClosingBalance) fd.append('statementClosing', createForm.statementClosingBalance);
      const data = await api('/api/bank-reconciliation/import/preview', { method: 'POST', body: fd });
      setImportPreview(data);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!file || !importPreview?.batch?.id) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('batchId', importPreview.batch.id);
      if (activeId) fd.append('reconciliationId', activeId);
      await api('/api/bank-reconciliation/import/confirm', { method: 'POST', body: fd });
      setImportPreview(null);
      setFile(null);
      if (activeId) await loadWorkspace(activeId);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const linkMatch = async () => {
    if (!activeId || !selectedStmt || !selectedBook) return;
    setBusy(true);
    try {
      await api('/api/bank-reconciliation/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reconciliationId: activeId,
          statementIds: [selectedStmt],
          bookLinks: [{ journalEntryLineId: selectedBook.journalEntryLineId, journalEntryId: selectedBook.journalEntryId, allocatedAmountMinor: selectedBook.remainingAmountMinor }],
        }),
      });
      setSelectedStmt(null);
      setSelectedBook(null);
      await loadWorkspace(activeId);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const calc = workspace?.calculation?.calculation?.decimals;
  const recon = workspace?.reconciliation;

  return (
    <div className="min-h-screen bg-[var(--background-secondary)] py-2 md:py-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Bank Reconciliation"
          description="Match bank statement evidence to posted General Ledger lines. Totals are calculated on the server — difference must be zero to complete (no plug journals)."
          breadcrumb={
            <Landmark className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          }
          actions={
            <button
              type="button"
              onClick={() => (activeId ? loadWorkspace(activeId) : loadAccounts())}
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          }
        />


        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-800">Bank account</h2>
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={paymentAccountId}
              onChange={(e) => {
                setPaymentAccountId(e.target.value);
                setActiveId(null);
                setWorkspace(null);
              }}
            >
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.accountType}){a.coaAccount ? ` — ${a.coaAccount.code}` : ''}
                </option>
              ))}
            </select>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">History</h3>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
              {reconciliations.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => loadWorkspace(r.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-slate-50 ${activeId === r.id ? 'bg-emerald-50' : ''}`}
                  >
                    <span>{fmt(r.statementDate)} · v{r.version}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[r.status] || ''}`}>{r.status}</span>
                  </button>
                </li>
              ))}
              {!reconciliations.length ? <li className="text-slate-400">No sessions yet</li> : null}
            </ul>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">New session</h3>
            <div className="mt-2 space-y-2">
              <input
                type="date"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={createForm.statementDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, statementDate: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Statement closing balance"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={createForm.statementClosingBalance}
                onChange={(e) => setCreateForm((f) => ({ ...f, statementClosingBalance: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Opening (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={createForm.statementOpeningBalance}
                onChange={(e) => setCreateForm((f) => ({ ...f, statementOpeningBalance: e.target.value }))}
              />
              <button
                type="button"
                disabled={!paymentAccountId || !createForm.statementClosingBalance || busy}
                onClick={createRecon}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                Start reconciliation
              </button>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800">Summary (server)</h2>
                {recon ? (
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[recon.status] || ''}`}>{recon.status}</span>
                ) : null}
              </div>
              {calc ? (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div><dt className="text-slate-500">Statement closing</dt><dd className="font-semibold">{money(calc.statementClosing)}</dd></div>
                  <div><dt className="text-slate-500">Book balance</dt><dd className="font-semibold">{money(calc.bookBalance)}</dd></div>
                  <div><dt className="text-slate-500">Deposits in transit</dt><dd className="font-semibold">{money(calc.depositsInTransit)}</dd></div>
                  <div><dt className="text-slate-500">Outstanding payments</dt><dd className="font-semibold">{money(calc.outstandingPayments)}</dd></div>
                  <div><dt className="text-slate-500">Adjusted book</dt><dd className="font-semibold">{money(calc.adjustedBook)}</dd></div>
                  <div>
                    <dt className="text-slate-500">Difference</dt>
                    <dd className={`font-semibold ${Number(calc.difference) === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {money(calc.difference)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Select or create a reconciliation session.</p>
              )}

              {activeId ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionBtn onClick={() => runAction('calculate')} label="Recalculate" />
                  <ActionBtn onClick={() => runAction('auto-match')} label="Auto-match" />
                  <ActionBtn onClick={() => runAction('review')} label="Submit review" />
                  <ActionBtn onClick={() => runAction('approve')} label="Approve" />
                  <ActionBtn onClick={() => runAction('complete')} label="Complete" primary />
                  <ActionBtn onClick={() => runAction('reopen', { reason: 'User reopen' })} label="Reopen" />
                  <a
                    href={`/api/bank-reconciliation/export/${activeId}?format=csv`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Upload className="h-4 w-4" /> Import statement
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="file" accept=".csv,.xlsx,.xls,.ofx,.qfx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button type="button" disabled={!file || busy} onClick={previewImport} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
                  Preview
                </button>
                <button type="button" disabled={!importPreview || busy} onClick={confirmImport} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                  Confirm import
                </button>
              </div>
              {importPreview ? (
                <p className="mt-2 text-xs text-slate-600">
                  {importPreview.totalRows} rows · {importPreview.duplicateRowCount} prior duplicates · balance valid: {String(importPreview.balanceCheck?.valid)}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {workspace ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Statement lines</div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(workspace.statements || []).map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedStmt(s.id)}
                        className={`cursor-pointer border-t border-slate-50 hover:bg-emerald-50/50 ${selectedStmt === s.id ? 'bg-emerald-50' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{fmt(s.transactionDate)}</td>
                        <td className="px-3 py-2">{s.description}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(s.signedAmount)}</td>
                        <td className="px-3 py-2">{s.matchingStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-semibold">GL candidates (book)</span>
                <button
                  type="button"
                  disabled={!selectedStmt || !selectedBook}
                  onClick={linkMatch}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  <Link2 className="h-3.5 w-3.5" /> Match selected
                </button>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr
                        key={c.journalEntryLineId}
                        onClick={() => setSelectedBook(c)}
                        className={`cursor-pointer border-t border-slate-50 hover:bg-blue-50/50 ${selectedBook?.journalEntryLineId === c.journalEntryLineId ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{fmt(c.transactionDate)}</td>
                        <td className="px-3 py-2">{c.description || c.reference}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(c.remainingAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {workspace?.matches?.length ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Matches
            </h2>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {workspace.matches.map((m) => (
                <li key={m.id} className="flex justify-between border-b border-slate-50 py-1">
                  <span>{m.matchType} · {m.confidence} · {m.status}</span>
                  <span>{money(m.statementTotalMinor / 100)} / {money(m.bookTotalMinor / 100)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, label, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800'
          : 'rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
      }
    >
      {label}
    </button>
  );
}

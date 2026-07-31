'use client';

/**
 * General Ledger (Phase 5) — canonical ledger UI.
 *
 * Reads exclusively from the canonical ledger query engine
 * (/api/accounting-v2/ledger*): per-account opening/movement/closing summary,
 * account drill-down with chronological running balances, journal drill-down,
 * abnormal-balance warnings, and export links that use the SAME query engine
 * as the screen. Read-only: this page never posts, edits or deletes anything.
 * The legacy /general-ledger page remains available during the transition.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/shell/PageHeader';


const firstDayOfMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};
const today = () => new Date().toISOString().slice(0, 10);

function Badge({ tone = 'muted', children }) {
  const cls =
    tone === 'ok'
      ? 'bg-green-100 text-green-800'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : tone === 'bad'
          ? 'bg-red-100 text-red-800'
          : 'bg-slate-100 text-slate-700';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function JournalModal({ journalId, onClose }) {
  const [journal, setJournal] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/accounting-v2/ledger/journals?id=${encodeURIComponent(journalId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => !cancelled && setJournal(json.journal))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [journalId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">Journal detail</h2>
          <button className="text-slate-500 hover:text-slate-800" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <p className="text-red-600">{error}</p>}
        {!journal && !error && <p className="text-slate-500">Loading…</p>}
        {journal && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <div><span className="text-slate-500">Number:</span> {journal.journalNumber ?? journal.reference ?? journal.journalId}</div>
              <div><span className="text-slate-500">Status:</span> <Badge tone={journal.status === 'POSTED' ? 'ok' : 'muted'}>{journal.status}</Badge></div>
              <div><span className="text-slate-500">Kind:</span> {journal.journalKind}</div>
              <div><span className="text-slate-500">Posting date:</span> {String(journal.postingDate).slice(0, 10)}</div>
              <div><span className="text-slate-500">Type:</span> {journal.entryType}</div>
              <div><span className="text-slate-500">Source:</span> {journal.sourceType ? `${journal.sourceType} ${journal.sourceId ?? ''}` : '—'}</div>
            </div>
            <p className="text-slate-700">{journal.description}</p>
            {journal.isReversal && <Badge tone="warn">Reversal journal</Badge>}
            {journal.lineage?.reversedBy && (
              <p className="text-amber-700">Reversed by journal {journal.lineage.reversedBy.journalNumber ?? journal.lineage.reversedBy.id}</p>
            )}
            <table className="w-full border-t text-left">
              <thead>
                <tr className="text-xs uppercase text-slate-500">
                  <th className="py-2">#</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {journal.lines.map((line) => (
                  <tr key={line.lineId} className="border-t">
                    <td className="py-1.5">{line.lineNumber}</td>
                    <td>{line.accountId}</td>
                    <td>{line.description ?? '—'}</td>
                    <td className="text-right tabular-nums">{line.debit !== '0.00' ? line.debit : ''}</td>
                    <td className="text-right tabular-nums">{line.credit !== '0.00' ? line.credit : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={3} className="py-1.5">Totals</td>
                  <td className="text-right tabular-nums">{journal.totalDebit}</td>
                  <td className="text-right tabular-nums">{journal.totalCredit}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountDrilldown({ accountId, filters, onBack, onOpenJournal }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({
      ...(filters.startDate ? { startDate: filters.startDate } : {}),
      ...(filters.endDate ? { endDate: filters.endDate } : {}),
      page: String(page),
      pageSize: '50',
      order: 'asc',
    });
    fetch(`/api/accounting-v2/ledger/account/${encodeURIComponent(accountId)}?${qs}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => !cancelled && setData(json))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [accountId, filters.startDate, filters.endDate, page]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading account activity…</p>;

  const { account, opening, period, closing, lines, pagination } = data;
  const totalPages = Math.max(1, Math.ceil(pagination.totalLines / pagination.pageSize));
  const exportUrl = `/api/accounting-v2/ledger/export?type=account&accountId=${encodeURIComponent(accountId)}${
    filters.startDate ? `&startDate=${filters.startDate}` : ''
  }${filters.endDate ? `&endDate=${filters.endDate}` : ''}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button className="text-sm text-blue-600 hover:underline" onClick={onBack}>
            ← Back to ledger summary
          </button>
          <h2 className="text-xl font-bold">
            {account.accountCode} — {account.accountName}
          </h2>
          <p className="text-sm text-slate-500">
            {account.accountType} · normal balance {account.normalBalance}{' '}
            {account.isHeader && <Badge tone="warn">header account</Badge>}
          </p>
        </div>
        <a className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50" href={exportUrl}>
          Export CSV
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded border p-3">
          <div className="text-xs uppercase text-slate-500">Opening</div>
          <div className="text-lg font-semibold tabular-nums">{opening.display}</div>
          {opening.abnormal && <Badge tone="warn">abnormal</Badge>}
        </div>
        <div className="rounded border p-3">
          <div className="text-xs uppercase text-slate-500">Period debits</div>
          <div className="text-lg font-semibold tabular-nums">{period.debit}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs uppercase text-slate-500">Period credits</div>
          <div className="text-lg font-semibold tabular-nums">{period.credit}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs uppercase text-slate-500">Closing</div>
          <div className="text-lg font-semibold tabular-nums">{closing.display}</div>
          {closing.abnormal && <Badge tone="warn">abnormal</Badge>}
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-500">
            <th className="py-2">Date</th>
            <th>Journal</th>
            <th>Description</th>
            <th>Source</th>
            <th className="text-right">Debit</th>
            <th className="text-right">Credit</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.lineId} className="border-b hover:bg-slate-50">
              <td className="py-1.5">{String(line.postingDate).slice(0, 10)}</td>
              <td>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => onOpenJournal(line.journalId)}
                >
                  {line.journalNumber ?? line.reference ?? line.journalId.slice(0, 8)}
                </button>{' '}
                {line.isReversal && <Badge tone="warn">rev</Badge>}
              </td>
              <td>{line.lineDescription ?? line.description ?? '—'}</td>
              <td className="text-slate-500">{line.sourceType ?? line.journalKind}</td>
              <td className="text-right tabular-nums">{line.debit !== '0.00' ? line.debit : ''}</td>
              <td className="text-right tabular-nums">{line.credit !== '0.00' ? line.credit : ''}</td>
              <td className="text-right tabular-nums">{line.runningBalance.display}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-slate-500">
                No posted activity in this window.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            className="rounded border px-2 py-1 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages} ({pagination.totalLines} lines)
          </span>
          <button
            className="rounded border px-2 py-1 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

export default function GeneralLedgerV2Page() {
  const [filters, setFilters] = useState({ startDate: firstDayOfMonth(), endDate: today() });
  const [draft, setDraft] = useState(filters);
  const [includeZero, setIncludeZero] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [journalId, setJournalId] = useState(null);

  const loadSummary = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      ...(filters.startDate ? { startDate: filters.startDate } : {}),
      ...(filters.endDate ? { endDate: filters.endDate } : {}),
      includeZero: String(includeZero),
    });
    fetch(`/api/accounting-v2/ledger?${qs}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
        return res.json();
      })
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters, includeZero]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const exportUrl = useMemo(
    () =>
      `/api/accounting-v2/ledger/export?type=summary${
        filters.startDate ? `&startDate=${filters.startDate}` : ''
      }${filters.endDate ? `&endDate=${filters.endDate}` : ''}&includeZero=${includeZero}`,
    [filters, includeZero]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="General Ledger"
        description="Canonical ledger — every figure derives exclusively from posted journal lines. Read-only."
        actions={
          !selectedAccount ? (
            <a
              className="rounded-[var(--radius-sm)] border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              href={exportUrl}
            >
              Export CSV
            </a>
          ) : null
        }
      />


      {!selectedAccount && (
        <section className="flex flex-wrap items-end gap-3 rounded border p-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-slate-500">From</span>
            <input
              type="date"
              className="rounded border px-2 py-1"
              value={draft.startDate}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-slate-500">To</span>
            <input
              type="date"
              className="rounded border px-2 py-1"
              value={draft.endDate}
              onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
            />
            Include zero-activity accounts
          </label>
          <button
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() => setFilters(draft)}
          >
            Apply
          </button>
        </section>
      )}

      {error && <p className="text-red-600">{error}</p>}
      {loading && !selectedAccount && <p className="text-slate-500">Loading ledger…</p>}

      {selectedAccount ? (
        <AccountDrilldown
          accountId={selectedAccount}
          filters={filters}
          onBack={() => setSelectedAccount(null)}
          onOpenJournal={setJournalId}
        />
      ) : (
        summary && (
          <>
            {summary.anomalies?.length > 0 && (
              <section className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
                <h2 className="mb-1 font-semibold text-amber-800">Integrity anomalies</h2>
                <ul className="list-inside list-disc text-amber-800">
                  {summary.anomalies.map((a, i) => (
                    <li key={i}>
                      {a.rule}: {a.message} ({a.accountId})
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="rounded border p-4">
                <div className="text-xs uppercase text-slate-500">Period debits</div>
                <div className="text-xl font-bold tabular-nums">{summary.totals.periodDebit}</div>
              </div>
              <div className="rounded border p-4">
                <div className="text-xs uppercase text-slate-500">Period credits</div>
                <div className="text-xl font-bold tabular-nums">{summary.totals.periodCredit}</div>
              </div>
              <div className="rounded border p-4">
                <div className="text-xs uppercase text-slate-500">Double entry</div>
                <div className="text-xl font-bold">
                  {summary.totals.balanced ? <Badge tone="ok">Balanced</Badge> : <Badge tone="bad">UNBALANCED</Badge>}
                </div>
              </div>
            </section>

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2">Code</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="text-right">Opening</th>
                  <th className="text-right">Debits</th>
                  <th className="text-right">Credits</th>
                  <th className="text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {summary.accounts.map((account) => (
                  <tr key={account.accountId} className="border-b hover:bg-slate-50">
                    <td className="py-1.5">{account.accountCode}</td>
                    <td>
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => setSelectedAccount(account.accountId)}
                      >
                        {account.accountName}
                      </button>{' '}
                      {account.isHeader && <Badge>header</Badge>}
                      {account.closing.abnormal && <Badge tone="warn">abnormal</Badge>}
                    </td>
                    <td className="text-slate-500">{account.accountType}</td>
                    <td className="text-right tabular-nums">{account.opening.display}</td>
                    <td className="text-right tabular-nums">{account.periodDebit}</td>
                    <td className="text-right tabular-nums">{account.periodCredit}</td>
                    <td className="text-right tabular-nums">{account.closing.display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}

      {journalId && <JournalModal journalId={journalId} onClose={() => setJournalId(null)} />}
    </div>
  );
}

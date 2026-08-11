'use client';

/**
 * Financial Calendar (Phase 8) — canonical financial years, accounting
 * periods and the period-close workflow.
 *
 * Everything on this page runs through /api/accounting-v2/periods/*: the
 * server resolves and controls all statuses. There is no client-side status
 * update — every button dispatches an approved, permissioned workflow action
 * (begin close, run checks, complete tasks, approve, close, reopen, …).
 * The legacy /accounting-periods page remains available during rollout.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar, CalendarDays, Check, AlertCircle, Lock, Unlock, RefreshCw,
  PlayCircle, ShieldCheck, History, ClipboardList, AlertTriangle, X,
  ChevronRight, FileClock, Database,
} from 'lucide-react';

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');

const STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  OPEN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CLOSING: 'bg-amber-100 text-amber-800 border-amber-200',
  CLOSED: 'bg-rose-100 text-rose-800 border-rose-200',
  REOPENED: 'bg-violet-100 text-violet-800 border-violet-200',
  ARCHIVED: 'bg-slate-200 text-slate-600 border-slate-300',
};

const TASK_STYLES = {
  NOT_STARTED: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PASSED: 'bg-emerald-100 text-emerald-800',
  PASSED_WITH_WARNING: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-rose-100 text-rose-800',
  BLOCKED: 'bg-rose-200 text-rose-900',
  WAIVED: 'bg-violet-100 text-violet-800',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-500',
};

function StatusBadge({ status, styles = STATUS_STYLES }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {status === 'CLOSED' ? <Lock className="h-3 w-3" /> : status === 'OPEN' ? <Unlock className="h-3 w-3" /> : null}
      {status}
    </span>
  );
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

const periodAction = (periodId, body) =>
  api(`/api/accounting-v2/periods/${periodId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/* ------------------------------------------------------------------ */
/* Financial-year setup (preview → create → open)                      */
/* ------------------------------------------------------------------ */

function YearSetupCard({ onDone, notify }) {
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const doPreview = async () => {
    setBusy(true);
    try {
      const p = await api('/api/accounting-v2/periods/financial-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', startYear: Number(startYear) }),
      });
      setPreview(p);
    } catch (e) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const doCreateAndOpen = async () => {
    setBusy(true);
    try {
      const created = await api('/api/accounting-v2/periods/financial-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', startYear: Number(startYear) }),
      });
      const fyId = created.financialYear?.id ?? created.id;
      await api('/api/accounting-v2/periods/financial-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', financialYearId: fyId }),
      });
      notify('success', `Financial year created and opened with ${created.periods?.length ?? 12} periods.`);
      setPreview(null);
      onDone();
    } catch (e) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <CalendarDays className="h-5 w-5 text-indigo-600" /> Create Financial Year
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        The server generates all monthly periods atomically from your business calendar configuration
        (start month, timezone). Preview before creating — years cannot overlap.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Start year</label>
          <input
            type="number"
            className="w-32 rounded-xl border border-slate-200 px-3 py-2.5 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={doPreview}
          className="rounded-xl bg-slate-700 px-4 py-2.5 font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          Preview periods
        </button>
        {preview && (
          <button
            type="button"
            disabled={busy}
            onClick={doCreateAndOpen}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            Create and open {preview.code}
          </button>
        )}
      </div>
      {preview && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            {preview.name} · {fmtDate(preview.startDate)} → {fmtDate(preview.endDate)}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {(preview.periods ?? []).map((p) => (
              <div key={p.code} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
                <div className="font-semibold text-slate-700">{p.name}</div>
                <div className="text-slate-500">{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Close dashboard (checklist inside the period detail)                */
/* ------------------------------------------------------------------ */

function CloseDashboard({ period, runDetail, refresh, notify }) {
  const [busy, setBusy] = useState(false);
  const [taskComment, setTaskComment] = useState({});
  const run = runDetail?.run;
  const tasks = runDetail?.tasks ?? [];

  const act = async (body, ok) => {
    setBusy(true);
    try {
      await periodAction(period.id, body);
      if (ok) notify('success', ok);
      await refresh();
    } catch (e) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!run) return null;

  const done = tasks.filter((t) => ['PASSED', 'PASSED_WITH_WARNING', 'WAIVED', 'NOT_APPLICABLE'].includes(t.status)).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const blockingOpen = tasks.filter((t) => t.blocking && ['FAILED', 'BLOCKED'].includes(t.status));

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-semibold text-slate-800">
          <ClipboardList className="h-4 w-4 text-amber-600" />
          Close run #{run.closeNumber} v{run.closeVersion} — {run.status}
        </h4>
        <div className="flex items-center gap-2">
          <div className="h-2 w-36 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-600">{done}/{tasks.length} tasks · {pct}%</span>
        </div>
      </div>

      {run.trialBalanceStatus && (
        <p className="mb-2 text-xs text-slate-600">
          Trial Balance: <strong>{run.trialBalanceStatus}</strong> · Reports: <strong>{run.reportStatus ?? '—'}</strong> · Integrity: <strong>{run.integrityStatus ?? '—'}</strong>
        </p>
      )}
      {blockingOpen.length > 0 && (
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5" /> {blockingOpen.length} blocking task(s) unresolved — closure is blocked. No balancing entries are ever created.
        </p>
      )}

      <div className="mb-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b text-left text-slate-500">
              <th className="px-2 py-1.5">Task</th>
              <th className="px-2 py-1.5">Module</th>
              <th className="px-2 py-1.5">Kind</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5 text-right">Manual completion</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.taskKey} className="border-b border-slate-100">
                <td className="px-2 py-1.5 font-medium text-slate-700">
                  {t.name}
                  {t.blocking && <span className="ml-1 text-rose-500" title="Blocking">•</span>}
                </td>
                <td className="px-2 py-1.5 text-slate-500">{t.module}</td>
                <td className="px-2 py-1.5 text-slate-500">{t.kind}</td>
                <td className="px-2 py-1.5"><StatusBadge status={t.status} styles={TASK_STYLES} /></td>
                <td className="px-2 py-1.5 text-right">
                  {t.kind === 'MANUAL' && ['IN_PROGRESS', 'NOT_STARTED', 'FAILED'].includes(t.status) && (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        className="w-40 rounded border border-slate-200 px-1.5 py-1 text-xs"
                        placeholder="Evidence / comment (required)"
                        value={taskComment[t.taskKey] ?? ''}
                        onChange={(e) => setTaskComment((s) => ({ ...s, [t.taskKey]: e.target.value }))}
                      />
                      <button
                        type="button"
                        disabled={busy || !(taskComment[t.taskKey] ?? '').trim()}
                        className="rounded bg-emerald-600 px-2 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                        onClick={() =>
                          act(
                            {
                              action: 'update-task',
                              closeRunId: run.id,
                              taskKey: t.taskKey,
                              status: 'PASSED',
                              comment: taskComment[t.taskKey],
                              evidence: { note: taskComment[t.taskKey] },
                            },
                            `Task ${t.taskKey} completed.`
                          )
                        }
                      >
                        Pass
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => act({ action: 'run-checks', closeRunId: run.id }, 'Automated checks executed.')} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          <RefreshCw className="h-3.5 w-3.5" /> Run automated checks
        </button>
        {run.status === 'IN_PROGRESS' && (
          <button type="button" disabled={busy} onClick={() => act({ action: 'submit-review', closeRunId: run.id }, 'Close submitted for review.')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            Submit for review
          </button>
        )}
        {run.status === 'READY_FOR_REVIEW' && (
          <button type="button" disabled={busy} onClick={() => act({ action: 'approve-close', closeRunId: run.id }, 'Close approved.')} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
            Approve close (second person)
          </button>
        )}
        {run.status === 'APPROVED' && (
          <button type="button" disabled={busy} onClick={() => act({ action: 'close', closeRunId: run.id }, 'Period closed. Snapshots generated.')} className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
            <Lock className="h-3.5 w-3.5" /> Close period
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const reason = window.prompt('Reason for cancelling this close run:');
            if (reason) act({ action: 'cancel-close', closeRunId: run.id, reason }, 'Close cancelled; period returned to OPEN.');
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          Cancel close
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Period detail panel                                                 */
/* ------------------------------------------------------------------ */

function PeriodDetail({ periodId, onClose, notify, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [impact, setImpact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/accounting-v2/periods/${periodId}`);
      setDetail(d);
    } catch (e) {
      notify('error', e.message);
    }
  }, [periodId, notify]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { await load(); onChanged(); };

  const act = async (body, ok) => {
    setBusy(true);
    try {
      await periodAction(periodId, body);
      if (ok) notify('success', ok);
      await refresh();
    } catch (e) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-500 shadow-lg">
        Loading period…
      </div>
    );
  }

  const { period, statusHistory, activeCloseRun, closeRuns, exceptions, reopenRequests } = detail;
  const pendingReopen = (reopenRequests ?? []).filter((r) => r.status === 'PENDING_APPROVAL');

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            {period.name} <StatusBadge status={period.status} />
          </h3>
          <p className="text-sm text-slate-500">
            {period.code} · {fmtDate(period.startDate)} → {fmtDate(period.endDate)}
            {period.lockDate && <span className="ml-2 text-amber-700">· locked through {fmtDate(period.lockDate)}</span>}
          </p>
        </div>
        <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}><X className="h-5 w-5" /></button>
      </div>

      {/* Status-driven actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(period.status === 'OPEN' || period.status === 'REOPENED') && !activeCloseRun && (
          <button type="button" disabled={busy} onClick={() => act({ action: 'begin-close' }, period.status === 'REOPENED' ? 'Re-close started (new close run version).' : 'Close started.')} className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            <PlayCircle className="h-3.5 w-3.5" /> {period.status === 'REOPENED' ? 'Begin re-close' : 'Begin close'}
          </button>
        )}
        {period.status === 'CLOSED' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                try {
                  const d = await periodAction(periodId, { action: 'impact' });
                  setImpact(d.impact);
                } catch (e) { notify('error', e.message); }
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              View reopening impact
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Detailed reason for reopening (required, audited):');
                if (reason) act({ action: 'request-reopen', reason }, 'Reopening requested — awaiting a second-person approval.');
              }}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Request reopening
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const lockDate = window.prompt('Lock date (YYYY-MM-DD, empty to clear):');
            const reason = window.prompt('Reason for the lock-date change (required, audited):');
            if (reason != null && reason !== '') act({ action: 'set-lock-date', lockDate: lockDate || null, reason }, 'Lock date updated.');
          }}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <Lock className="h-3.5 w-3.5" /> Set lock date
        </button>
        <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
          <History className="h-3.5 w-3.5" /> Status history ({statusHistory.length})
        </button>
      </div>

      {/* Pending reopen approvals */}
      {pendingReopen.map((r) => (
        <div key={r.id} className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
          <p className="font-semibold text-violet-900">Reopening requested by {r.requestedBy}</p>
          <p className="mb-2 text-violet-800">{r.reason}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => act({ action: 'approve-reopen', reopenRequestId: r.id }, 'Period reopened under restricted correction scope.')} className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              Approve (second person)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const rejectionReason = window.prompt('Reason for rejection:');
                if (rejectionReason) act({ action: 'reject-reopen', reopenRequestId: r.id, rejectionReason }, 'Reopening rejected.');
              }}
              className="rounded border border-violet-300 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      {/* Reopening impact */}
      {impact && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="mb-1 font-semibold text-slate-800">Reopening impact analysis</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <span>Journals in period: <strong>{impact.journalCount}</strong></span>
            <span>Completed close runs: <strong>{impact.closeRunCount}</strong></span>
            <span>Snapshots affected: <strong>{impact.snapshotCount ?? '—'}</strong></span>
            <span>Downstream periods: <strong>{impact.downstreamPeriodCount ?? impact.downstreamPeriods?.length ?? 0}</strong></span>
            <span>Later years affected: <strong>{impact.downstreamYearCount ?? 0}</strong></span>
            <span>Open exceptions: <strong>{impact.openExceptionCount ?? 0}</strong></span>
          </div>
        </div>
      )}

      {/* Close dashboard */}
      {activeCloseRun && <CloseDashboard period={period} runDetail={activeCloseRun} refresh={refresh} notify={notify} />}

      {/* Exceptions */}
      {exceptions.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Period exceptions
          </h4>
          <div className="space-y-1">
            {exceptions.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                <span className="text-slate-700">
                  <strong>{e.category}</strong> · {e.severity} · {e.description}
                </span>
                <StatusBadge status={e.status} styles={TASK_STYLES} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Close run history */}
      {closeRuns.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
            <FileClock className="h-4 w-4 text-slate-500" /> Close runs (history preserved — never overwritten)
          </h4>
          <div className="space-y-1 text-xs">
            {closeRuns.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-slate-700">#{r.closeNumber} v{r.closeVersion} · started {fmtDateTime(r.startedAt)} {r.completedAt ? `· completed ${fmtDateTime(r.completedAt)}` : ''}</span>
                <StatusBadge status={r.status} styles={TASK_STYLES} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Immutable status history */}
      {showHistory && (
        <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b text-left text-slate-500">
                <th className="px-2 py-1.5">When</th>
                <th className="px-2 py-1.5">Action</th>
                <th className="px-2 py-1.5">Transition</th>
                <th className="px-2 py-1.5">By</th>
                <th className="px-2 py-1.5">Reason</th>
              </tr>
            </thead>
            <tbody>
              {statusHistory.map((h) => (
                <tr key={h.id} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-500">{fmtDateTime(h.createdAt)}</td>
                  <td className="px-2 py-1.5 font-medium text-slate-700">{h.action}</td>
                  <td className="px-2 py-1.5 text-slate-600">{h.previousStatus ?? '∅'} → {h.newStatus}</td>
                  <td className="px-2 py-1.5 text-slate-500">{h.executedBy}</td>
                  <td className="px-2 py-1.5 text-slate-500">{h.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integrity + migration panel                                         */
/* ------------------------------------------------------------------ */

function IntegrityPanel({ notify }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      setData(await api('/api/accounting-v2/periods/integrity'));
    } catch (e) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const migrate = async (execute) => {
    setBusy(true);
    try {
      const d = await api('/api/accounting-v2/periods/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: execute ? 'execute' : 'preview' }),
      });
      if (execute) {
        notify('success', `Migration complete: ${d.created?.length ?? 0} year(s) created, ${d.assignedJournals ?? 0} journal(s) assigned, ${d.unresolved?.length ?? 0} unresolved.`);
      } else {
        const pv = d.preview ?? d;
        notify('success', `Preview: ${pv.legacy?.totalPeriods ?? 0} legacy periods, ${pv.journals?.unassignedPosted ?? 0} unassigned posted journals, proposes ${pv.proposal?.financialYears?.length ?? 0} canonical year(s).`);
      }
    } catch (e) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <ShieldCheck className="h-5 w-5 text-emerald-600" /> Calendar Integrity and Readiness
        </h2>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={run} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            Run integrity audit
          </button>
          <button type="button" disabled={busy} onClick={() => migrate(false)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            <Database className="h-3.5 w-3.5" /> Preview legacy migration
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Execute the legacy period migration? Canonical years and periods are created and posted journals gain period references. Dates and amounts are never changed.')) migrate(true);
            }}
            className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            Execute migration
          </button>
        </div>
      </div>
      {data && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>Integrity: <StatusBadge status={data.integrity?.status === 'PASS' ? 'OPEN' : 'CLOSED'} /> <strong className="ml-1">{data.integrity?.status}</strong> ({data.integrity?.checkedYears} years, {data.integrity?.checkedPeriods} periods)</span>
            <span>Readiness: <strong>{data.readiness?.status}</strong></span>
            <span>Monitoring findings: <strong>{data.monitoring?.findings?.length ?? 0}</strong></span>
          </div>
          {(data.integrity?.findings ?? []).length > 0 && (
            <div className="space-y-1">
              {data.integrity.findings.map((f, i) => (
                <div key={i} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800">
                  <strong>{f.rule}</strong> {f.title}: {f.message}
                </div>
              ))}
            </div>
          )}
          {(data.readiness?.blockers ?? []).length > 0 && (
            <div className="space-y-1">
              {data.readiness.blockers.map((b, i) => (
                <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{typeof b === 'string' ? b : b.message ?? JSON.stringify(b)}</div>
              ))}
            </div>
          )}
          {(data.monitoring?.findings ?? []).map((f, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <strong>{f.code ?? f.rule}</strong> {f.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function FinancialCalendarV2Page() {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [years, setYears] = useState([]);
  const [yearFilter, setYearFilter] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);

  const notify = useCallback((type, message) => {
    setAlert({ type, message });
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setAlert(null), 8000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [periodData, yearData] = await Promise.all([
        api('/api/accounting-v2/periods'),
        api('/api/accounting-v2/periods/financial-years'),
      ]);
      setPeriods(periodData.periods ?? []);
      setSummary(periodData.summary ?? null);
      setYears(yearData.financialYears ?? []);
    } catch (e) {
      notify('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const visiblePeriods = useMemo(
    () => (yearFilter ? periods.filter((p) => p.financialYearId === yearFilter) : periods),
    [periods, yearFilter]
  );
  const hasCalendar = years.length > 0;

  return (
    <div className="w-full">
      <div className="w-full px-4 py-6 pb-12 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-6 shadow-xl shadow-indigo-200/50 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                <Calendar className="h-8 w-8 text-white sm:h-10 sm:w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Financial Calendar</h1>
                <p className="mt-0.5 text-sm text-indigo-100">
                  Canonical financial years, controlled period close, reopening and audit — server-enforced.
                </p>
              </div>
            </div>
            {summary?.currentFinancialYear && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Current year', summary.currentFinancialYear.code],
                  ['Current period', summary.currentPeriod?.name ?? '—'],
                  ['Days remaining', summary.currentPeriodDaysRemaining ?? '—'],
                  ['Open / closing', `${summary.openPeriodCount} / ${summary.closingPeriodCount}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/15 px-4 py-2.5 text-white backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-wider text-indigo-100">{label}</div>
                    <div className="text-lg font-bold">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {alert && (
          <div className={`mb-6 flex items-center gap-3 rounded-xl p-4 shadow-sm ${alert.type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-rose-200 bg-rose-50 text-rose-800'}`}>
            {alert.type === 'success' ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm">{alert.message}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {!hasCalendar && <YearSetupCard onDone={load} notify={notify} />}

            {hasCalendar && (
              <>
                {/* Year timeline */}
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-800">Financial Years</h2>
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50"
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                    >
                      <option value="">All years</option>
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>{y.code} — {y.status}{y.isCurrent ? ' (current)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {years.map((y) => (
                      <button
                        key={y.id}
                        type="button"
                        onClick={() => setYearFilter(yearFilter === y.id ? '' : y.id)}
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${yearFilter === y.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{y.code}</span>
                          <StatusBadge status={y.status} />
                          {y.isCurrent && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">CURRENT</span>}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{fmtDate(y.startDate)} → {fmtDate(y.endDate)} · {y.numberOfPeriods} periods</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <YearSetupCardInline onDone={load} notify={notify} />
                  </div>
                </div>

                {/* Period cards */}
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
                  <h2 className="mb-4 text-lg font-semibold text-slate-800">Accounting Periods</h2>
                  {visiblePeriods.length === 0 ? (
                    <p className="py-8 text-center text-slate-500">No periods for this selection.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {visiblePeriods.map((p) => {
                        const isCurrent = summary?.currentPeriod?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPeriodId(p.id)}
                            className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${selectedPeriodId === p.id ? 'border-indigo-400 ring-2 ring-indigo-200' : isCurrent ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800">{p.name}</span>
                              <StatusBadge status={p.status} />
                            </div>
                            <div className="text-xs text-slate-500">{p.code} · {fmtDate(p.startDate)} – {fmtDate(p.endDate)}</div>
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                              {p.lockDate && <span className="flex items-center gap-0.5 text-amber-600"><Lock className="h-3 w-3" /> locked ≤ {fmtDate(p.lockDate)}</span>}
                              {isCurrent && <span className="font-semibold text-indigo-600">current</span>}
                              <ChevronRight className="ml-auto h-3.5 w-3.5" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Period detail + close dashboard */}
                {selectedPeriodId && (
                  <PeriodDetail
                    periodId={selectedPeriodId}
                    onClose={() => setSelectedPeriodId(null)}
                    notify={notify}
                    onChanged={load}
                  />
                )}
              </>
            )}

            <IntegrityPanel notify={notify} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact "create next year" control shown under the year timeline. */
function YearSetupCardInline({ onDone, notify }) {
  const [startYear, setStartYear] = useState(new Date().getFullYear() + 1);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-600">Create next financial year:</span>
      <input
        type="number"
        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5"
        value={startYear}
        onChange={(e) => setStartYear(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const created = await api('/api/accounting-v2/periods/financial-years', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create', startYear: Number(startYear) }),
            });
            const fyId = created.financialYear?.id ?? created.id;
            await api('/api/accounting-v2/periods/financial-years', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'open', financialYearId: fyId }),
            });
            notify('success', 'Financial year created and opened.');
            onDone();
          } catch (e) {
            notify('error', e.message);
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        Create + open
      </button>
    </div>
  );
}

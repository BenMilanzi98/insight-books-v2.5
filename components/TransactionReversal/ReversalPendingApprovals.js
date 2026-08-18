"use client";
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from "react";
import { getPermission } from "@/lib/permissions";

export default function ReversalPendingApprovals({ currentUserId = null }) {
  const [pending, setPending] = useState([]);
  const [sod, setSod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [canConfigure, setCanConfigure] = useState(false);
  const [savingSod, setSavingSod] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/reverse?action=pending");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load pending approvals");
      setPending(data.pending || []);
      setSod(data.sod || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      getPermission("journal.reverse"),
      getPermission("journalEntries.update"),
      getPermission("settings.update"),
    ]).then(([jr, ju, su]) => {
      setCanApprove(Boolean(jr || ju));
      setCanConfigure(Boolean(su || jr));
    });
    load();
  }, [load]);

  const act = async (action, reversalId) => {
    setBusyId(reversalId);
    setError(null);
    try {
      const res = await fetch("/api/transactions/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reversalId,
          // execute needs source fields from register — load then call
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${action} failed`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const approveAndExecute = async (row) => {
    setBusyId(row.id);
    setError(null);
    try {
      const approveRes = await fetch("/api/transactions/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", reversalId: row.id }),
      });
      const approveData = await approveRes.json().catch(() => ({}));
      if (!approveRes.ok) throw new Error(approveData.error || "Approve failed");

      const execRes = await fetch("/api/transactions/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          reversalId: row.id,
          transactionId: row.sourceId,
          transactionType: row.sourceType,
          reversalReason: row.reason,
        }),
      });
      const execData = await execRes.json().catch(() => ({}));
      if (!execRes.ok) throw new Error(execData.error || "Execute failed");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleSod = async () => {
    if (!sod) return;
    setSavingSod(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/reversals/sod", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requireSeparateApprover: !sod.requireSeparateApprover,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update SoD");
      setSod(data.sod);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSod(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl bg-white shadow-lg border border-slate-100 p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{tt('Pending approvals')}</h2>
          <p className="text-sm text-slate-500">
            {tt('Segregation of duties: requester cannot approve or execute when SoD is on.')}
          </p>
        </div>
        {canConfigure ? (
          <button
            type="button"
            disabled={savingSod || !sod}
            onClick={toggleSod}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            SoD: {sod?.requireSeparateApprover ? "ON" : "OFF"}
            {savingSod ? "…" : ""}
          </button>
        ) : (
          <span className="text-sm text-slate-500">
            SoD: {sod?.requireSeparateApprover ? "ON" : "OFF"}
          </span>
        )}
      </div>

      {error ? (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">{tt('Loading…')}</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500">{tt('No pending reversal requests.')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-2">{tt('Type')}</th>
                <th className="px-2 py-2">{tt('Source')}</th>
                <th className="px-2 py-2">{tt('Status')}</th>
                <th className="px-2 py-2">{tt('Reason')}</th>
                <th className="px-2 py-2">{tt('Requested')}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => {
                const isRequester =
                  currentUserId && row.requestedById === currentUserId;
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium">{row.sourceType}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.sourceId}</td>
                    <td className="px-2 py-2">{row.status}</td>
                    <td className="max-w-xs truncate px-2 py-2" title={row.reason}>
                      {row.reason}
                    </td>
                    <td className="px-2 py-2 text-slate-500">
                      {row.requestedAt
                        ? new Date(row.requestedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {canApprove && !isRequester ? (
                        <div className="flex flex-wrap gap-2">
                          {row.status === "REQUESTED" || row.status === "APPROVED" ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => approveAndExecute(row)}
                              className="text-indigo-600 hover:underline disabled:opacity-50"
                            >
                              {row.status === "APPROVED" ? tt('Execute') : tt('Approve & execute')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => act("reject", row.id)}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            {tt('Reject')}
                          </button>
                        </div>
                      ) : isRequester ? (
                        <span className="text-xs text-slate-400">{tt('Awaiting another user')}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

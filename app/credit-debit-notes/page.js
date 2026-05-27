"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  Eye,
  CheckCircle,
  Clock,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  FileCheck,
} from "lucide-react";
import { getPermission } from "@/lib/permissions";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MWK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const StatusBadge = ({ status }) => {
  const isPosted = status === "Posted";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
        isPosted
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-slate-50 text-slate-600 border border-slate-200"
      }`}
    >
      {isPosted ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
};

export default function CreditDebitNotesPage() {
  const [activeTab, setActiveTab] = useState("credit");
  const [creditNotes, setCreditNotes] = useState([]);
  const [debitNotes, setDebitNotes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [posting, setPosting] = useState(false);
  const [permissions, setPermissions] = useState({ canCreate: false });

  const isCredit = activeTab === "credit";

  const fetchCreditNotes = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", pagination.page);
    params.set("limit", pagination.limit);
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("clientId", clientFilter);
    const res = await fetch(`/api/credit-notes?${params}`);
    if (!res.ok) throw new Error("Failed to fetch credit notes");
    const data = await res.json();
    setCreditNotes(data.creditNotes || []);
    setPagination((p) => ({ ...p, total: data.pagination?.total ?? 0, totalPages: data.pagination?.totalPages ?? 0 }));
  }, [pagination.page, pagination.limit, statusFilter, clientFilter]);

  const fetchDebitNotes = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", pagination.page);
    params.set("limit", pagination.limit);
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("clientId", clientFilter);
    const res = await fetch(`/api/debit-notes?${params}`);
    if (!res.ok) throw new Error("Failed to fetch debit notes");
    const data = await res.json();
    setDebitNotes(data.debitNotes || []);
    setPagination((p) => ({ ...p, total: data.pagination?.total ?? 0, totalPages: data.pagination?.totalPages ?? 0 }));
  }, [pagination.page, pagination.limit, statusFilter, clientFilter]);

  const loadClients = useCallback(async () => {
    const res = await fetch("/api/clients?limit=500");
    if (!res.ok) return;
    const data = await res.json();
    setClients(data.clients || []);
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const canCreate = await getPermission("invoices.create");
        setPermissions({ canCreate });
        await loadClients();
        if (isCredit) await fetchCreditNotes();
        else await fetchDebitNotes();
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [activeTab, isCredit, fetchCreditNotes, fetchDebitNotes, loadClients]);

  const refetch = () => {
    if (isCredit) fetchCreditNotes();
    else fetchDebitNotes();
  };

  const handlePostToLedger = async (note) => {
    const isCn = !!note.noteNumber && activeTab === "credit";
    const endpoint = isCn ? `/api/credit-notes/${note.id}` : `/api/debit-notes/${note.id}`;
    setPosting(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postToLedger: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to post to ledger");
      }
      refetch();
      setDetailOpen(false);
      setSelectedNote(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  };

  const notes = isCredit ? creditNotes : debitNotes;
  const noteLabel = isCredit ? "Credit note" : "Debit note";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Credit & Debit Notes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Credit notes reduce amount owed; debit notes increase amount owed. Both link to invoices or sales and post to the ledger.
          </p>
        </div>
        {permissions.canCreate && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New {noteLabel}
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("credit")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "credit"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ArrowDownCircle className="h-4 w-4 inline mr-2 text-emerald-600" />
          Credit Notes
        </button>
        <button
          onClick={() => setActiveTab("debit")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "debit"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ArrowUpCircle className="h-4 w-4 inline mr-2 text-amber-600" />
          Debit Notes
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 text-sm"
          >
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Posted">Posted</option>
          </select>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-md border border-gray-300 text-sm min-w-[180px]"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={refetch}
            disabled={loading}
            className="p-2 rounded-md border border-gray-300 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-md bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linked to</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {notes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No {noteLabel}s found.
                    </td>
                  </tr>
                ) : (
                  notes.map((note) => (
                    <tr key={note.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{note.noteNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{note.client?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {note.invoice?.invoiceNumber
                          ? `Invoice ${note.invoice.invoiceNumber}`
                          : note.sale?.saleNumber
                            ? `Sale ${note.sale.saleNumber}`
                            : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(note.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(note.noteDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={note.status} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setSelectedNote(note);
                            setDetailOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateNoteModal
          isCredit={isCredit}
          clients={clients}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            refetch();
          }}
        />
      )}

      {detailOpen && selectedNote && (
        <DetailModal
          note={selectedNote}
          isCredit={isCredit}
          onClose={() => {
            setDetailOpen(false);
            setSelectedNote(null);
          }}
          onPostToLedger={() => handlePostToLedger(selectedNote)}
          posting={posting}
          canPost={selectedNote.status === "Draft" && permissions.canCreate}
        />
      )}
    </div>
  );
}

function CreateNoteModal({ isCredit, clients, onClose, onSuccess }) {
  const [clientId, setClientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [postToLedger, setPostToLedger] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    if (!clientId) {
      setInvoices([]);
      setSales([]);
      return;
    }
    (async () => {
      try {
        const [invRes, saleRes] = await Promise.all([
          fetch(`/api/invoices?client=${clientId}&limit=100`),
          fetch(`/api/sales?clientId=${clientId}&limit=100`),
        ]);
        const invData = invRes.ok ? await invRes.json() : { invoices: [] };
        const saleData = saleRes.ok ? await saleRes.json() : { sales: [] };
        setInvoices(invData.invoices || []);
        setSales(saleData.sales || saleData.data?.sales || []);
      } catch {
        setInvoices([]);
        setSales([]);
      }
    })();
  }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const numAmount = parseFloat(amount);
    if (!clientId || !reason.trim() || isNaN(numAmount) || numAmount <= 0) {
      setError("Client, amount (positive number), and reason are required.");
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = isCredit ? "/api/credit-notes" : "/api/debit-notes";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          invoiceId: invoiceId || undefined,
          saleId: saleId || undefined,
          amount: numAmount,
          reason: reason.trim(),
          noteDate: noteDate || new Date().toISOString(),
          notes: notes.trim() || undefined,
          postToLedger,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create note");
      onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = isCredit ? "Credit" : "Debit";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">New {typeLabel} Note</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setInvoiceId("");
                  setSaleId("");
                }}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link to invoice (optional)</label>
              <select
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  if (e.target.value) setSaleId("");
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} – {formatCurrency(inv.total)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link to sale (optional)</label>
              <select
                value={saleId}
                onChange={(e) => {
                  setSaleId(e.target.value);
                  if (e.target.value) setInvoiceId("");
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.saleNumber || s.id} – {formatCurrency(s.total)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isCredit ? "e.g. Returned goods, discount" : "e.g. Undercharged, extra services"}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note date</label>
              <input
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={postToLedger}
                onChange={(e) => setPostToLedger(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Post to ledger (update AR and revenue)</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ note, isCredit, onClose, onPostToLedger, posting, canPost }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {isCredit ? "Credit" : "Debit"} Note – {note.noteNumber}
            </h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Client</dt>
              <dd className="font-medium text-gray-900">{note.client?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Linked to</dt>
              <dd className="text-gray-900">
                {note.invoice?.invoiceNumber
                  ? `Invoice ${note.invoice.invoiceNumber}`
                  : note.sale?.saleNumber
                    ? `Sale ${note.sale.saleNumber}`
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Amount</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(note.amount)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Date</dt>
              <dd className="text-gray-900">{formatDate(note.noteDate)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Reason</dt>
              <dd className="text-gray-900">{note.reason || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd>
                <StatusBadge status={note.status} />
              </dd>
            </div>
            {note.notes && (
              <div>
                <dt className="text-gray-500">Notes</dt>
                <dd className="text-gray-900">{note.notes}</dd>
              </div>
            )}
            {note.createdBy && (
              <div>
                <dt className="text-gray-500">Created by</dt>
                <dd className="text-gray-900">{note.createdBy.name}</dd>
              </div>
            )}
            {note.postedBy && (
              <div>
                <dt className="text-gray-500">Posted by</dt>
                <dd className="text-gray-900">{note.postedBy.name}</dd>
              </div>
            )}
          </dl>
          {canPost && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={onPostToLedger}
                disabled={posting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <FileCheck className="h-4 w-4" />
                {posting ? "Posting…" : "Post to ledger"}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Posts journal entry (AR and revenue) and marks this note as Posted.
              </p>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

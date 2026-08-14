"use client";

import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  RefreshCw,
  AlertCircle,
  Settings,
  X,
  Loader,
  CheckCircle,
  XCircle,
  FileDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import PaymentModal from "@/components/PaymentModal";
import PaymentChannelsPanel from "@/components/payments/PaymentChannelsPanel";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";

const PaymentAccountsPage = () => {
  const router = useRouter();
  const [channelRefreshKey, setChannelRefreshKey] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canCreatePayments: false,
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAccount, setHistoryAccount] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshChannels = () => setChannelRefreshKey((k) => k + 1);

  useEffect(() => {
    const fetchPermissions = async () => {
      const canCreatePayments = await getPermission("payments.create");
      setPagePermissions({ canCreatePayments });
    };
    fetchPermissions();
  }, []);

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handlePaymentSubmit = async (paymentData) => {
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || "Failed to create payment");
    }

    showNotification("Transfer completed successfully", "success");
    refreshChannels();
  };

  const handleSyncPayments = async () => {
    try {
      setSyncingPayments(true);
      const res = await fetch("/api/payments/sync", { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Sync failed");
      if (result.syncedPayments > 0) {
        showNotification(`Synced ${result.syncedPayments} payment(s)`, "success");
      } else {
        showNotification("No new payments to sync", "info");
      }
      refreshChannels();
    } catch (error) {
      console.error(error);
      showNotification(error.message || "Error syncing payments", "error");
    } finally {
      setSyncingPayments(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MWK",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

  const downloadHistoryExport = async (format) => {
    if (!historyAccount?.id) return;
    const ext = format === "excel" ? "xlsx" : format;
    try {
      const res = await fetch(
        `/api/payment-accounts/${historyAccount.id}/transactions/export?format=${encodeURIComponent(ext)}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(dispo);
      const fallback = `${(historyAccount.name || "account").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}-transactions.${ext === "excel" ? "xlsx" : ext}`;
      const filename = match ? match[1] : fallback;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification(`Downloaded ${filename}`, "success");
    } catch (e) {
      showNotification(e.message || "Export failed", "error");
    }
  };

  const openHistory = async (account) => {
    setHistoryAccount(account);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryRows([]);
    try {
      const res = await fetch(`/api/payment-accounts/${account.id}/transactions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load history");
      setHistoryRows(data.transactions || []);
    } catch (e) {
      showNotification(e.message || "Could not load history", "error");
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const StatusBadge = ({ status }) => {
    const s = String(status || "");
    if (s.toLowerCase() === "completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-800">
          <CheckCircle size={12} /> Completed
        </span>
      );
    }
    if (s.toLowerCase() === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-800">
          Pending
        </span>
      );
    }
    if (s.toLowerCase() === "failed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-800">
          <XCircle size={12} /> Failed
        </span>
      );
    }
    return <span className="text-xs text-gray-600">{s || "—"}</span>;
  };

  return (
    <PermissionGuard permission="payments.view">
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 pb-10">
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-100"
                : notification.type === "error"
                  ? "bg-red-50 text-red-900 border border-red-100"
                  : "bg-sky-50 text-sky-900 border border-sky-100"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" && <CheckCircle size={18} />}
              {notification.type === "error" && <XCircle size={18} />}
              {notification.type === "info" && <AlertCircle size={18} />}
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payment Accounts</h1>
            <p className="text-sm text-gray-500 mt-1">
              Active cash, bank, and mobile accounts. Add or activate channels under Manage accounts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2 shadow-sm"
              onClick={() => router.push("/payments/management")}
            >
              <Settings size={16} />
              Manage accounts
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2 shadow-sm"
              onClick={handleSyncPayments}
              disabled={syncingPayments}
            >
              <RefreshCw size={16} className={syncingPayments ? "animate-spin" : ""} />
              {syncingPayments ? "Syncing…" : "Sync payments"}
            </button>
            {pagePermissions.canCreatePayments && (
              <button
                type="button"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 inline-flex items-center gap-2 shadow-md"
                onClick={() => setIsModalOpen(true)}
              >
                <PlusCircle size={18} />
                Transfer Funds
              </button>
            )}
          </div>
        </div>

        <PaymentChannelsPanel
          mode="dashboard"
          refreshKey={channelRefreshKey}
          onSelectAccount={openHistory}
        />

        <PaymentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handlePaymentSubmit}
          mode="create"
          transferFundsOnly
        />

        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col border border-gray-100"
              role="dialog"
              aria-modal="true"
              aria-labelledby="acct-history-title"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-gray-100">
                <div className="min-w-0">
                  <h3 id="acct-history-title" className="text-lg font-semibold text-gray-900 truncate">
                    {historyAccount?.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Payments, POS deposits, and ledger lines on the linked account · newest first
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={historyLoading || !historyAccount}
                    onClick={() => downloadHistoryExport("csv")}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <FileDown size={14} /> CSV
                  </button>
                  <button
                    type="button"
                    disabled={historyLoading || !historyAccount}
                    onClick={() => downloadHistoryExport("xlsx")}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <FileDown size={14} /> Excel
                  </button>
                  <button
                    type="button"
                    disabled={historyLoading || !historyAccount}
                    onClick={() => downloadHistoryExport("pdf")}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <FileDown size={14} /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryOpen(false);
                      setHistoryAccount(null);
                      setHistoryRows([]);
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    aria-label="Close"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-3">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
                    <Loader className="h-5 w-5 animate-spin" />
                    Loading…
                  </div>
                ) : historyRows.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-12">No transactions found for this account.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                        <th className="py-2 pr-2">Date</th>
                        <th className="py-2 pr-2">Category</th>
                        <th className="py-2 pr-2">Summary</th>
                        <th className="py-2 pr-2 text-right">Amount</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {historyRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/80">
                          <td className="py-2.5 pr-2 whitespace-nowrap text-gray-600">
                            {formatDateDDMMYYYY(row.paymentDate)}
                          </td>
                          <td className="py-2.5 pr-2 text-xs text-gray-600 whitespace-nowrap">
                            {row.eventCategory || row.source || "—"}
                          </td>
                          <td className="py-2.5 pr-2 text-gray-800">
                            <div className="font-medium text-gray-900">{row.summary}</div>
                            {row.reference ? (
                              <div className="text-xs text-gray-500">Ref: {row.reference}</div>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="py-2.5">
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};

export default PaymentAccountsPage;

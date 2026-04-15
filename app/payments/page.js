"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  PlusCircle,
  RefreshCw,
  CreditCard,
  DollarSign,
  Landmark,
  Smartphone,
  AlertCircle,
  Settings,
  X,
  Loader,
  ChevronRight,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import PaymentModal from "@/components/PaymentModal";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";

const PaymentAccountsPage = () => {
  const router = useRouter();
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
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

  useEffect(() => {
    const fetchPermissions = async () => {
      const canCreatePayments = await getPermission("payments.create");
      setPagePermissions({ canCreatePayments });
    };
    fetchPermissions();
  }, []);

  const loadPaymentAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const response = await fetch("/api/payment-accounts/balances");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.accounts) {
          setPaymentAccounts(data.accounts);
        }
      } else {
        const accountsResponse = await fetch("/api/payment-accounts?activeOnly=true");
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          if (accountsData.success) {
            setPaymentAccounts(accountsData.paymentAccounts || []);
          }
        }
      }
    } catch (error) {
      console.error("Error loading payment accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentAccounts();
  }, [loadPaymentAccounts]);

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
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create payment");
    }

    showNotification("Transfer completed successfully", "success");
    await loadPaymentAccounts();
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
      await loadPaymentAccounts();
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);

  const totalBalance = useMemo(() => {
    return paymentAccounts.reduce((s, a) => {
      const b = typeof a.balance === "number" ? a.balance : parseFloat(a.balance) || 0;
      return s + Math.max(0, b);
    }, 0);
  }, [paymentAccounts]);

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

  const accountIcon = (type) => {
    const t = (type || "").toLowerCase();
    if (t === "bank") return Landmark;
    if (t === "mobile money") return Smartphone;
    if (t === "cash") return DollarSign;
    return CreditCard;
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
      <div className="max-w-6xl mx-auto pb-10">
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
              Balances match{" "}
              <a href="/payments/management" className="text-indigo-600 font-medium hover:underline">
                Payment Accounts management
              </a>
              . Tap a method to view its transaction history.
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

        <section className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payment method distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Share of funds across active accounts · Total {formatCurrency(totalBalance)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadPaymentAccounts()}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 self-start sm:self-auto"
            >
              Refresh balances
            </button>
          </div>

          {loadingAccounts ? (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
              <Loader className="h-5 w-5 animate-spin" />
              Loading accounts…
            </div>
          ) : paymentAccounts.length === 0 ? (
            <div className="text-center py-14 text-gray-500 text-sm">
              No payment accounts yet.{" "}
              <a href="/payments/management" className="text-indigo-600 font-medium hover:underline">
                Create accounts in management
              </a>
              .
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentAccounts.map((account) => {
                const bal = typeof account.balance === "number" ? account.balance : parseFloat(account.balance) || 0;
                const pct = totalBalance > 0 ? Math.min(100, Math.round((Math.max(0, bal) / totalBalance) * 100)) : 0;
                const Icon = accountIcon(account.accountType);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => openHistory(account)}
                    className="group text-left rounded-xl border border-gray-200/80 bg-white/90 backdrop-blur px-5 py-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 shrink-0">
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{account.name}</p>
                          <p className="text-xs text-gray-500">{account.accountType || "Account"}</p>
                        </div>
                      </div>
                      <ChevronRight
                        size={18}
                        className="text-gray-300 group-hover:text-indigo-500 shrink-0 mt-1"
                        aria-hidden
                      />
                    </div>
                    <p className="mt-4 text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(bal)}</p>
                    <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-400 font-medium">{pct}% of tracked balance</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

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
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col border border-gray-100"
              role="dialog"
              aria-modal="true"
              aria-labelledby="acct-history-title"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 id="acct-history-title" className="text-lg font-semibold text-gray-900">
                    {historyAccount?.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Transaction history · newest first</p>
                </div>
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

"use client";

import { useEffect, useState } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { getCurrentUser } from "@/lib/permissions";
import { Check, AlertCircle, Calendar, Lock, Unlock, PlusCircle } from "lucide-react";

const AccountingPeriodsPage = () => {
  const [periods, setPeriods] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleDenied, setRoleDenied] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [alert, setAlert] = useState(null);
  const [newPeriodType, setNewPeriodType] = useState("Monthly");
  const [newStartDate, setNewStartDate] = useState("");

  // Financial year always starts 1 January: when Yearly is selected, default start to 1 Jan of current year
  useEffect(() => {
    if (newPeriodType === "Yearly") {
      const y = new Date().getFullYear();
      setNewStartDate(`${y}-01-01`);
    }
  }, [newPeriodType]);

  const isFinanceAdminRole = (user) => {
    const roleName = user?.role?.name?.toLowerCase() || "";
    return roleName.includes("finance") || roleName.includes("admin") || roleName === "master_admin";
  };

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/accounting-periods");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load accounting periods.");
      }
      const data = await response.json();
      setPeriods(data.periods || []);
      setCurrentPeriod(data.currentPeriod || null);
    } catch (error) {
      setAlert({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const checkRole = async () => {
      try {
        const user = await getCurrentUser();
        if (!mounted) return;
        setRoleDenied(!isFinanceAdminRole(user));
      } catch (err) {
        if (!mounted) return;
        setRoleDenied(true);
      } finally {
        if (mounted) setAccessChecked(true);
      }
    };
    checkRole();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!roleDenied) {
      fetchPeriods();
    }
  }, [roleDenied]);

  const handleClosePeriod = async (periodId) => {
    if (!periodId) return;
    const confirmed = window.confirm("Close this accounting period? This will lock all activity inside the period.");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/accounting-periods/${periodId}/close`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to close period.");
      }
      setAlert({ type: "success", message: data.message || "Period closed." });
      fetchPeriods();
    } catch (error) {
      setAlert({ type: "error", message: error.message });
    }
  };

  const handleReopenPeriod = async (periodId) => {
    const reason = window.prompt("Provide a reason for reopening this period:");
    if (!reason) return;
    try {
      const response = await fetch(`/api/accounting-periods/${periodId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to reopen period.");
      }
      setAlert({ type: "success", message: data.message || "Period reopened." });
      fetchPeriods();
    } catch (error) {
      setAlert({ type: "error", message: error.message });
    }
  };

  const handleOpenPeriod = async () => {
    try {
      const payload = {
        periodType: newPeriodType,
        startDate: newStartDate || undefined,
      };
      const response = await fetch("/api/accounting-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to open period.");
      }
      setAlert({ type: "success", message: "Period opened successfully." });
      setNewStartDate("");
      fetchPeriods();
    } catch (error) {
      setAlert({ type: "error", message: error.message });
    }
  };

  if (!accessChecked) return null;

  return (
    <PermissionGuard permission="journalEntries.view">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-12">
          {roleDenied && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 sm:p-8 text-center shadow-sm">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-rose-800 mb-2">Access Denied</h3>
              <p className="text-rose-600">Only Finance or Admin roles can manage accounting periods.</p>
            </div>
          )}

          {!roleDenied && (
            <>
              <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                      <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Accounting Periods</h1>
                      <p className="text-indigo-100 text-sm mt-0.5">Open, close, and reopen fiscal periods</p>
                    </div>
                  </div>
                  {currentPeriod && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white text-sm">
                      <Calendar className="w-5 h-5 shrink-0" />
                      <span>Current: {currentPeriod.name} ({new Date(currentPeriod.startDate).toLocaleDateString()} – {new Date(currentPeriod.endDate).toLocaleDateString()})</span>
                    </div>
                  )}
                </div>
              </div>

              {alert && (
                <div className={`mb-6 rounded-xl p-4 flex items-center gap-3 shadow-sm ${alert.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"}`}>
                  {alert.type === "success" ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <span>{alert.message}</span>
                </div>
              )}

              <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-6 sm:p-8 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-600" />
                  Open New Period
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  The financial period always begins <strong>1 January</strong>. Yearly periods run 1 Jan – 31 Dec; reports align to the calendar year.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Period Type</label>
                    <select
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                      value={newPeriodType}
                      onChange={(e) => setNewPeriodType(e.target.value)}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly (1 Jan – 31 Dec)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {newPeriodType === "Yearly" ? "Start year (period will be 1 Jan – 31 Dec)" : "Start Date (optional)"}
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                      onClick={handleOpenPeriod}
                    >
                      Open Period
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <h2 className="text-lg font-semibold text-slate-800">Period History</h2>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                  </div>
                ) : periods.length === 0 ? (
                  <div className="py-16 text-center text-slate-500">No accounting periods configured yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Start</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">End</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {periods.map((period) => (
                          <tr key={period.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{period.name}</td>
                            <td className="px-4 py-3 text-slate-600">{period.periodType}</td>
                            <td className="px-4 py-3 text-slate-600">{new Date(period.startDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-slate-600">{new Date(period.endDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${period.status === "closed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {period.status === "closed" ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                {period.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {period.status === "open" ? (
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors"
                                    onClick={() => handleClosePeriod(period.id)}
                                  >
                                    Close
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
                                    onClick={() => handleReopenPeriod(period.id)}
                                  >
                                    Reopen
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};

export default AccountingPeriodsPage;

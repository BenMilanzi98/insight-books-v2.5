"use client";

import { useEffect, useState } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { getCurrentUser } from "@/lib/permissions";
import { Check, AlertCircle, Calendar } from "lucide-react";

const AccountingPeriodsPage = () => {
  const [periods, setPeriods] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleDenied, setRoleDenied] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [alert, setAlert] = useState(null);
  const [newPeriodType, setNewPeriodType] = useState("Monthly");
  const [newStartDate, setNewStartDate] = useState("");

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
      <div className="container mx-auto pb-8">
        {roleDenied && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-6">
            <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600">Only Finance or Admin roles can manage accounting periods.</p>
          </div>
        )}

        {!roleDenied && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Accounting Periods</h1>
              {currentPeriod && (
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                  Current period: {currentPeriod.name} ({new Date(currentPeriod.startDate).toLocaleDateString()} -{" "}
                  {new Date(currentPeriod.endDate).toLocaleDateString()})
                </div>
              )}
            </div>

            {alert && (
              <div
                className={`mb-6 rounded-md p-4 ${
                  alert.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                <div className="flex items-center">
                  {alert.type === "success" ? (
                    <Check className="mr-2 h-5 w-5" />
                  ) : (
                    <AlertCircle className="mr-2 h-5 w-5" />
                  )}
                  <span>{alert.message}</span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Open New Period</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Period Type</label>
                  <select
                    className="w-full border border-gray-300 rounded p-2"
                    value={newPeriodType}
                    onChange={(e) => setNewPeriodType(e.target.value)}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date (optional)</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded p-2"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                    onClick={handleOpenPeriod}
                  >
                    Open Period
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Period History</h2>
              {loading ? (
                <div className="text-gray-500">Loading periods...</div>
              ) : periods.length === 0 ? (
                <div className="text-gray-500">No accounting periods configured yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-3 font-medium">Name</th>
                        <th className="p-3 font-medium">Type</th>
                        <th className="p-3 font-medium">Start</th>
                        <th className="p-3 font-medium">End</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period.id} className="border-t border-gray-200">
                          <td className="p-3">{period.name}</td>
                          <td className="p-3">{period.periodType}</td>
                          <td className="p-3">{new Date(period.startDate).toLocaleDateString()}</td>
                          <td className="p-3">{new Date(period.endDate).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                period.status === "closed" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                              }`}
                            >
                              {period.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              {period.status === "open" ? (
                                <button
                                  type="button"
                                  className="px-3 py-1 text-sm bg-red-600 text-white rounded"
                                  onClick={() => handleClosePeriod(period.id)}
                                >
                                  Close
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="px-3 py-1 text-sm bg-yellow-500 text-white rounded"
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
    </PermissionGuard>
  );
};

export default AccountingPeriodsPage;

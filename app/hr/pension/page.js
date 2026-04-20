"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Search, User, Loader } from "lucide-react";
import { downloadPDF, downloadExcel } from "@/lib/exportUtils";
import { todayYmdLocal, calendarMonthYmdRangeLocal } from "@/lib/dateUtils";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";

function formatCurrency(amount) {
  return `MWK ${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatDate(date) {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "N/A";
  }
}

export default function PensionManagementPage() {
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: "success", message: "" });

  const [selectedClearEmployeeIds, setSelectedClearEmployeeIds] = useState([]);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearPaymentMethod, setClearPaymentMethod] = useState("");
  const [clearingPension, setClearingPension] = useState(false);

  // Set default payment method when accounts load
  useEffect(() => {
    if (paymentAccounts.length > 0 && !clearPaymentMethod) {
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      if (defaultAccount) {
        setClearPaymentMethod(defaultAccount.id);
      }
    }
  }, [paymentAccounts]);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  // Empty string means "not configured" (no default value).
  const [npsEmployeeRatePercent, setNpsEmployeeRatePercent] = useState("");
  const [npsEmployerRatePercent, setNpsEmployerRatePercent] = useState("");

  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    return calendarMonthYmdRangeLocal(d.getFullYear(), d.getMonth() + 1).startYmd;
  });
  const [reportEndDate, setReportEndDate] = useState(todayYmdLocal());
  const [reportEmployeeId, setReportEmployeeId] = useState("all");

  const [reportSummary, setReportSummary] = useState(null);
  const [reportByEmployee, setReportByEmployee] = useState([]);
  const [reportEntries, setReportEntries] = useState([]);

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast({ visible: false, type, message }), 3500);
  };

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const res = await fetch("/api/employees?limit=500");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load employees");
      setEmployees((data.employees || []).filter((e) => e.isActive !== false));
    } catch (e) {
      console.error("Error loading employees:", e);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchPensionSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await fetch("/api/pension/settings");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load pension settings");
      setNpsEmployeeRatePercent(
        data.npsEmployeeRatePercent === null || data.npsEmployeeRatePercent === undefined
          ? ""
          : String(Number(data.npsEmployeeRatePercent))
      );
      setNpsEmployerRatePercent(
        data.npsEmployerRatePercent === null || data.npsEmployerRatePercent === undefined
          ? ""
          : String(Number(data.npsEmployerRatePercent))
      );
    } catch (e) {
      console.error("Error loading pension settings:", e);
      // Keep defaults; don't block page
    } finally {
      setSettingsLoading(false);
    }
  };

  const savePensionSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await fetch("/api/pension/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npsEmployeeRatePercent: npsEmployeeRatePercent === "" ? null : Number(npsEmployeeRatePercent),
          npsEmployerRatePercent: npsEmployerRatePercent === "" ? null : Number(npsEmployerRatePercent),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save pension settings");
      setNpsEmployeeRatePercent(
        data.npsEmployeeRatePercent === null || data.npsEmployeeRatePercent === undefined
          ? ""
          : String(Number(data.npsEmployeeRatePercent))
      );
      setNpsEmployerRatePercent(
        data.npsEmployerRatePercent === null || data.npsEmployerRatePercent === undefined
          ? ""
          : String(Number(data.npsEmployerRatePercent))
      );
      showToast("success", "Pension rates updated");
    } catch (e) {
      console.error("Error saving pension settings:", e);
      showToast("error", e.message || "Failed to save pension rates");
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchPensionSettings();
  }, []);

  const loadPensionReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: reportStartDate,
        endDate: reportEndDate,
      });
      if (reportEmployeeId !== "all") {
        params.append("employeeId", reportEmployeeId);
      }

      const res = await fetch(`/api/pension?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load pension report");

      setReportSummary(data.summary || null);
      setReportByEmployee(data.byEmployee || []);
      setReportEntries(data.entries || []);
      setSelectedClearEmployeeIds([]);
    } catch (e) {
      console.error("Error loading pension report:", e);
      showToast("error", e.message || "Failed to load pension report");
      setReportSummary(null);
      setReportByEmployee([]);
      setReportEntries([]);
      setSelectedClearEmployeeIds([]);
    } finally {
      setReportLoading(false);
    }
  };

  const selectedEmployee = useMemo(() => {
    if (reportEmployeeId === "all") return null;
    return employees.find((e) => e.id === reportEmployeeId) || null;
  }, [employees, reportEmployeeId]);

  const canExport = useMemo(() => {
    return reportEmployeeId === "all" ? reportByEmployee.length > 0 : reportEntries.length > 0;
  }, [reportEmployeeId, reportByEmployee.length, reportEntries.length]);

  const selectedClearRows = useMemo(() => {
    if (reportEmployeeId !== "all") return [];
    if (!selectedClearEmployeeIds.length) return [];
    const set = new Set(selectedClearEmployeeIds);
    return reportByEmployee.filter((r) => set.has(r.employeeId));
  }, [reportEmployeeId, reportByEmployee, selectedClearEmployeeIds]);

  const selectedClearEmployerTotal = useMemo(() => {
    return selectedClearRows.reduce((sum, r) => sum + Number(r.npsEmployerTotal || 0), 0);
  }, [selectedClearRows]);

  const toggleClearSelection = (employeeId) => {
    setSelectedClearEmployeeIds((prev) => {
      const set = new Set(prev);
      if (set.has(employeeId)) set.delete(employeeId);
      else set.add(employeeId);
      return Array.from(set);
    });
  };

  const toggleClearSelectAll = () => {
    if (reportEmployeeId !== "all") return;
    if (selectedClearEmployeeIds.length === reportByEmployee.length) {
      setSelectedClearEmployeeIds([]);
      return;
    }
    setSelectedClearEmployeeIds(reportByEmployee.map((r) => r.employeeId));
  };

  const confirmClearPension = async () => {
    if (!selectedClearEmployeeIds.length) {
      showToast("error", "Select at least one employee to clear");
      return;
    }
    try {
      setClearingPension(true);
      const res = await fetch("/api/pension/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedClearEmployeeIds,
          startDate: reportStartDate,
          endDate: reportEndDate,
          paymentMethod: clearPaymentMethod,
          clearDate: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to clear pension");
      showToast(
        "success",
        `Cleared pension for ${data.employeeCount || selectedClearEmployeeIds.length} employee(s) - ${formatCurrency(data.totalAmount || 0)}`
      );
      setClearModalOpen(false);
      await loadPensionReport();
    } catch (e) {
      console.error("Error clearing pension:", e);
      showToast("error", e.message || "Failed to clear pension");
    } finally {
      setClearingPension(false);
    }
  };

  const exportPDF = () => {
    if (!canExport) {
      showToast("error", "No data to export");
      return;
    }

    const title = selectedEmployee
      ? `Pension (NPS) Report - ${selectedEmployee.name}`
      : "Pension (NPS) Report - All Employees";
    const subtitle = `Period: ${formatDate(reportStartDate)} - ${formatDate(reportEndDate)}`;

    const summaryData = [
      { label: "Employee Contributions", value: formatCurrency(reportSummary?.npsEmployeeTotal || 0) },
      { label: "Employer Contributions", value: formatCurrency(reportSummary?.npsEmployerTotal || 0) },
      { label: "Total Pension", value: formatCurrency(reportSummary?.npsTotal || 0) },
    ];

    if (reportEmployeeId === "all") {
      const headers = [
        { key: "name", label: "Employee" },
        { key: "employeeNumber", label: "Employee ID" },
        { key: "department", label: "Department" },
        { key: "npsEmployeeTotal", label: "Employee Contribution" },
        { key: "npsEmployerTotal", label: "Employer Contribution" },
        { key: "npsTotal", label: "Total" },
      ];

      const data = reportByEmployee.map((r) => ({
        name: r.name,
        employeeNumber: r.employeeNumber,
        department: r.department,
        npsEmployeeTotal: formatCurrency(r.npsEmployeeTotal),
        npsEmployerTotal: formatCurrency(r.npsEmployerTotal),
        npsTotal: formatCurrency(r.npsTotal),
      }));

      downloadPDF({ title, subtitle, data, headers, summaryData, orientation: "landscape" }, `pension-report-${reportStartDate}-${reportEndDate}.pdf`);
    } else {
      const headers = [
        { key: "period", label: "Period" },
        { key: "paymentDate", label: "Payment Date" },
        { key: "npsEmployeeAmount", label: "Employee Contribution" },
        { key: "npsEmployerAmount", label: "Employer Contribution" },
        { key: "totalNpsAmount", label: "Total" },
        { key: "status", label: "Status" },
      ];

      const data = reportEntries.map((e) => ({
        period: `${formatDate(e.periodStart)} - ${formatDate(e.periodEnd)}`,
        paymentDate: formatDate(e.paymentDate),
        npsEmployeeAmount: formatCurrency(e.npsEmployeeAmount),
        npsEmployerAmount: formatCurrency(e.npsEmployerAmount),
        totalNpsAmount: formatCurrency(e.totalNpsAmount),
        status: e.status || "N/A",
      }));

      downloadPDF({ title, subtitle, data, headers, summaryData }, `pension-report-${selectedEmployee?.name || "employee"}-${reportStartDate}-${reportEndDate}.pdf`);
    }

    showToast("success", "PDF exported successfully");
  };

  const exportExcel = async () => {
    if (!canExport) {
      showToast("error", "No data to export");
      return;
    }

    if (reportEmployeeId === "all") {
      const headers = [
        { key: "name", label: "Employee" },
        { key: "employeeNumber", label: "Employee ID" },
        { key: "department", label: "Department" },
        { key: "npsEmployeeTotal", label: "Employee Contribution" },
        { key: "npsEmployerTotal", label: "Employer Contribution" },
        { key: "npsTotal", label: "Total" },
      ];

      const data = reportByEmployee.map((r) => ({
        name: r.name,
        employeeNumber: r.employeeNumber,
        department: r.department,
        npsEmployeeTotal: r.npsEmployeeTotal,
        npsEmployerTotal: r.npsEmployerTotal,
        npsTotal: r.npsTotal,
      }));

      await downloadExcel(data, headers, "Pension Report", `pension-report-${reportStartDate}-${reportEndDate}.xlsx`);
    } else {
      const headers = [
        { key: "periodStart", label: "Period Start" },
        { key: "periodEnd", label: "Period End" },
        { key: "paymentDate", label: "Payment Date" },
        { key: "npsEmployeeAmount", label: "Employee Contribution" },
        { key: "npsEmployerAmount", label: "Employer Contribution" },
        { key: "totalNpsAmount", label: "Total" },
        { key: "status", label: "Status" },
      ];

      const data = reportEntries.map((e) => ({
        periodStart: formatDate(e.periodStart),
        periodEnd: formatDate(e.periodEnd),
        paymentDate: formatDate(e.paymentDate),
        npsEmployeeAmount: e.npsEmployeeAmount,
        npsEmployerAmount: e.npsEmployerAmount,
        totalNpsAmount: e.totalNpsAmount,
        status: e.status || "N/A",
      }));

      await downloadExcel(data, headers, "Employee Pension", `pension-report-${selectedEmployee?.name || "employee"}-${reportStartDate}-${reportEndDate}.xlsx`);
    }

    showToast("success", "Excel exported successfully");
  };

  return (
    <div className="p-6">
      {toast.visible && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-md shadow-lg px-4 py-3 border text-sm ${
            toast.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : toast.type === "warning"
              ? "bg-yellow-50 border-yellow-200 text-yellow-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pension (NPS) Management</h1>
          <p className="text-gray-600">View and export pension contributions (employee + employer) from payroll</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        {/* Pension Rate Settings */}
        <div className="mb-6 border-b pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Pension (NPS) Rates</h2>
            <button
              onClick={savePensionSettings}
              disabled={savingSettings || settingsLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingSettings ? "Saving..." : "Save Rates"}
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Set the NPS contribution rates. These rates are used when NPS is enabled for an employee.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={npsEmployeeRatePercent}
                onChange={(e) => setNpsEmployeeRatePercent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employer Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={npsEmployerRatePercent}
                onChange={(e) => setNpsEmployerRatePercent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col justify-center">
              <div className="text-sm text-gray-600">Total Rate</div>
              <div className="text-lg font-semibold text-gray-900">
                {(Number(npsEmployeeRatePercent || 0) + Number(npsEmployerRatePercent || 0)).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select
              value={reportEmployeeId}
              onChange={(e) => setReportEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={loadingEmployees}
            >
              <option value="all">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadPensionReport}
              disabled={reportLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {reportLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <button
            onClick={exportPDF}
            disabled={!canExport}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={18} />
            Export PDF
          </button>
          <button
            onClick={exportExcel}
            disabled={!canExport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FileSpreadsheet size={18} />
            Export Excel
          </button>

          {reportEmployeeId === "all" && reportByEmployee.length > 0 && (
            <button
              onClick={() => setClearModalOpen(true)}
              disabled={selectedClearEmployeeIds.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear employer pension contributions for selected employees (creates Pension expense + payment and marks payrolls as cleared)"
            >
              Clear Pension (Selected)
            </button>
          )}
        </div>

        {/* Summary */}
        {reportSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="text-sm text-blue-700">Employee Contributions</div>
              <div className="text-xl font-semibold text-blue-900">{formatCurrency(reportSummary.npsEmployeeTotal)}</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
              <div className="text-sm text-purple-700">Employer Contributions</div>
              <div className="text-xl font-semibold text-purple-900">{formatCurrency(reportSummary.npsEmployerTotal)}</div>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <div className="text-sm text-green-700">Total Pension</div>
              <div className="text-xl font-semibold text-green-900">{formatCurrency(reportSummary.npsTotal)}</div>
            </div>
          </div>
        )}

        {/* Tables */}
        {reportEmployeeId === "all" ? (
          reportByEmployee.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedClearEmployeeIds.length > 0 && selectedClearEmployeeIds.length === reportByEmployee.length}
                        onChange={toggleClearSelectAll}
                        className="h-4 w-4"
                        aria-label="Select all employees for clearing"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Employer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Last Period</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportByEmployee.map((r) => (
                    <tr key={r.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <input
                          type="checkbox"
                          checked={selectedClearEmployeeIds.includes(r.employeeId)}
                          onChange={() => toggleClearSelection(r.employeeId)}
                          className="h-4 w-4"
                          aria-label={`Select ${r.name} for clearing`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.employeeNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.department}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(r.npsEmployeeTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(r.npsEmployerTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(r.npsTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{formatDate(r.lastPeriodEnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">Generate a report to view pension totals.</div>
          )
        ) : reportEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Employer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportEntries.map((e) => (
                  <tr key={e.payrollId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{`${formatDate(e.periodStart)} - ${formatDate(e.periodEnd)}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(e.paymentDate)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(e.npsEmployeeAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(e.npsEmployerAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(e.totalNpsAmount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{e.status || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            {selectedEmployee ? (
              <div className="flex items-center justify-center gap-2">
                <User size={16} className="text-gray-400" />
                No pension entries found for {selectedEmployee.name} in this period.
              </div>
            ) : (
              "Generate a report to view pension entries."
            )}
          </div>
        )}
        {/* Clear Pension Modal */}
        {clearModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => (clearingPension ? null : setClearModalOpen(false))} />
            <div className="relative bg-white w-full max-w-lg rounded-lg shadow-lg p-6">
              <div className="text-lg font-semibold text-gray-900 mb-1">Clear Pension (Employer)</div>
              <div className="text-sm text-gray-600 mb-4">
                This will create a <span className="font-medium">Pension</span> expense for each selected employee and mark payroll records as cleared for this period.
              </div>

              <div className="grid grid-cols-1 gap-3 mb-4">
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-xs text-gray-500">Selected Employees</div>
                  <div className="text-sm font-medium text-gray-900">{selectedClearEmployeeIds.length}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-xs text-gray-500">Employer Total (to clear)</div>
                  <div className="text-sm font-semibold text-gray-900">{formatCurrency(selectedClearEmployerTotal)}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-xs text-gray-500">Period</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatDate(reportStartDate)} - {formatDate(reportEndDate)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={clearPaymentMethod}
                    onChange={(e) => setClearPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={clearingPension || isLoadingPaymentAccounts}
                  >
                    <option value="">{isLoadingPaymentAccounts ? 'Loading accounts...' : 'Select an account'}</option>
                    {paymentAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} {account.accountType ? `(${account.accountType})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setClearModalOpen(false)}
                  disabled={clearingPension}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearPension}
                  disabled={clearingPension || selectedClearEmployeeIds.length === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {clearingPension ? "Clearing..." : "Confirm Clear"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}



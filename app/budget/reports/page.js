"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  Download,
  Calendar,
  Filter,
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
} from "recharts";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function BudgetReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [reportType, setReportType] = useState("summary");
  const [reportData, setReportData] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canView: false,
    canExport: false,
  });
  const [filters, setFilters] = useState({
    status: "",
    periodType: "",
    startDate: "",
    endDate: "",
    baseStartDate: "",
    baseEndDate: "",
    comparisonStartDate: "",
    comparisonEndDate: "",
  });

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("type", reportType);

      if (reportType === "budget_vs_actual") {
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);
        if (filters.periodType) params.set("periodType", filters.periodType);
      } else if (reportType === "period_comparison") {
        if (filters.baseStartDate) params.set("baseStartDate", filters.baseStartDate);
        if (filters.baseEndDate) params.set("baseEndDate", filters.baseEndDate);
        if (filters.comparisonStartDate) params.set("comparisonStartDate", filters.comparisonStartDate);
        if (filters.comparisonEndDate) params.set("comparisonEndDate", filters.comparisonEndDate);
        if (filters.periodType) params.set("periodType", filters.periodType);
      }

      const res = await fetch(`/api/budgets/reports?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load report");
      setReportData(json?.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType]);

  useEffect(() => {
    const fetchPermissions = async () => {
      const canView = await getPermission("budgets.view");
      const canExport = await getPermission("budgets.view"); // Export uses same permission
      setPagePermissions({ canView, canExport });
    };
    fetchPermissions();
  }, []);

  const handleExport = () => {
    if (!reportData) return;
    const dataStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget_${reportType}_report_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Summary report chart data
  const summaryChartData = useMemo(() => {
    if (!reportData?.budgets || reportType !== "summary") return [];
    return reportData.budgets.slice(0, 10).map((b, i) => ({
      name: b.name?.substring(0, 15) || "Untitled",
      budgeted: b.budgeted,
      actual: b.actual,
      fill: COLORS[i % COLORS.length],
    }));
  }, [reportData, reportType]);

  // Budget vs Actual chart data
  const budgetVsActualChartData = useMemo(() => {
    if (!reportData?.data || reportType !== "budget_vs_actual") return [];
    return reportData.data.map((item) => ({
      name: item.budget?.name?.substring(0, 15) || "Untitled",
      budgeted: item.budgetedAmount || 0,
      actual: item.comparison?.actualRevenue || 0,
    }));
  }, [reportData, reportType]);

  // Period comparison chart data
  const periodComparisonChartData = useMemo(() => {
    if (!reportData?.periods || reportType !== "period_comparison") return [];
    return [
      {
        name: "Base Period",
        budgeted: reportData.periods.base.totals?.budgeted || 0,
        actual: reportData.periods.base.totals?.actual || 0,
      },
      {
        name: "Comparison Period",
        budgeted: reportData.periods.comparison.totals?.budgeted || 0,
        actual: reportData.periods.comparison.totals?.actual || 0,
      },
    ];
  }, [reportData, reportType]);

  return (
    <PermissionGuard permission="budgets.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link href="/budget" className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft size={18} />
            Back to Budgets
          </Link>

          <div className="flex items-center gap-2">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="summary">Summary Report</option>
              <option value="budget_vs_actual">Budget vs Actual</option>
              <option value="period_comparison">Period Comparison</option>
            </select>

            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            {reportData && pagePermissions.canExport && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <Download size={16} />
                Export
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 border border-green-200 bg-green-50 rounded-md text-green-700 flex items-center gap-2">
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">Report Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportType === "budget_vs_actual" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </>
            )}
            {reportType === "period_comparison" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Start</label>
                  <input
                    type="date"
                    value={filters.baseStartDate}
                    onChange={(e) => setFilters((f) => ({ ...f, baseStartDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base End</label>
                  <input
                    type="date"
                    value={filters.baseEndDate}
                    onChange={(e) => setFilters((f) => ({ ...f, baseEndDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comparison Start</label>
                  <input
                    type="date"
                    value={filters.comparisonStartDate}
                    onChange={(e) => setFilters((f) => ({ ...f, comparisonStartDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comparison End</label>
                  <input
                    type="date"
                    value={filters.comparisonEndDate}
                    onChange={(e) => setFilters((f) => ({ ...f, comparisonEndDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
              <select
                value={filters.periodType}
                onChange={(e) => setFilters((f) => ({ ...f, periodType: e.target.value }))}
                onBlur={loadReport}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">All</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-10 flex items-center justify-center text-gray-600">
            <Loader2 size={24} className="animate-spin mr-2 text-green-600" />
            Loading report...
          </div>
        ) : reportData ? (
          <>
            {/* Summary Report */}
            {reportType === "summary" && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <DollarSign size={18} className="text-blue-600" />
                      <span className="text-sm font-medium">Total Budgeted</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.totals?.totalBudgeted || 0)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <TrendingUp size={18} className="text-green-600" />
                      <span className="text-sm font-medium">Total Actual</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.totals?.totalActual || 0)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      {(reportData.totals?.totalActual || 0) >= (reportData.totals?.totalBudgeted || 0) ? (
                        <TrendingUp size={18} className="text-green-600" />
                      ) : (
                        <TrendingDown size={18} className="text-red-600" />
                      )}
                      <span className="text-sm font-medium">Variance</span>
                    </div>
                    <div className={`text-2xl font-bold ${
                      (reportData.totals?.totalActual || 0) >= (reportData.totals?.totalBudgeted || 0)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                      {formatCurrency(reportData.totals?.totalVariance || 0)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <BarChart3 size={18} className="text-purple-600" />
                      <span className="text-sm font-medium">Achievement</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {(reportData.totals?.overallAchievement || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Chart */}
                {summaryChartData.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Budget Performance Overview</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summaryChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(v) => formatCurrency(v).replace("MWK ", "")} />
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="budgeted" name="Budgeted" fill="#3b82f6" />
                          <Bar dataKey="actual" name="Actual" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Budget Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Budget Details</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Budget Name</th>
                          <th className="text-left px-4 py-3 font-medium">Period</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-right px-4 py-3 font-medium">Budgeted</th>
                          <th className="text-right px-4 py-3 font-medium">Actual</th>
                          <th className="text-right px-4 py-3 font-medium">Variance</th>
                          <th className="text-right px-4 py-3 font-medium">Achievement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reportData.budgets?.map((budget) => (
                          <tr key={budget.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-medium">
                              <Link href={`/budget/${budget.id}`} className="hover:underline text-blue-600">
                                {budget.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-gray-600 capitalize">{budget.status}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(budget.budgeted)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(budget.actual)}</td>
                            <td className={`px-4 py-3 text-right font-medium ${
                              budget.variance >= 0 ? "text-green-600" : "text-red-600"
                            }`}>
                              {budget.variance >= 0 ? "+" : ""}{formatCurrency(budget.variance)}
                            </td>
                            <td className="px-4 py-3 text-right">{budget.achievementPercent?.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Budget vs Actual Report */}
            {reportType === "budget_vs_actual" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <DollarSign size={18} className="text-blue-600" />
                      <span className="text-sm font-medium">Total Budgeted</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.totals?.totalBudgeted || 0)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <TrendingUp size={18} className="text-green-600" />
                      <span className="text-sm font-medium">Total Actual</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.totals?.totalActual || 0)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <BarChart3 size={18} className="text-purple-600" />
                      <span className="text-sm font-medium">Achievement</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {(reportData.totals?.totalAchievementPercent || 0).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <FileText size={18} className="text-gray-500" />
                      <span className="text-sm font-medium">Budget Count</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {reportData.totals?.budgetCount || 0}
                    </div>
                  </div>
                </div>

                {budgetVsActualChartData.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Budget vs Actual Comparison</h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={budgetVsActualChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(v) => formatCurrency(v).replace("MWK ", "")} />
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="budgeted" name="Budgeted" fill="#3b82f6" />
                          <Bar dataKey="actual" name="Actual" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Detailed Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Budget</th>
                          <th className="text-left px-4 py-3 font-medium">Period</th>
                          <th className="text-right px-4 py-3 font-medium">Budgeted</th>
                          <th className="text-right px-4 py-3 font-medium">Actual</th>
                          <th className="text-right px-4 py-3 font-medium">Variance</th>
                          <th className="text-right px-4 py-3 font-medium">Achievement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reportData.data?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-medium">{item.budget?.name}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {new Date(item.budget?.startDate).toLocaleDateString()} - {new Date(item.budget?.endDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.budgetedAmount || 0)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.comparison?.actualRevenue || 0)}</td>
                            <td className={`px-4 py-3 text-right font-medium ${
                              item.comparison?.variance?.amount >= 0 ? "text-green-600" : "text-red-600"
                            }`}>
                              {item.comparison?.variance?.amount >= 0 ? "+" : ""}
                              {formatCurrency(item.comparison?.variance?.amount || 0)}
                            </td>
                            <td className="px-4 py-3 text-right">{item.comparison?.achievement?.percent?.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Period Comparison Report */}
            {reportType === "period_comparison" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Base Period */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar size={18} className="text-blue-600" />
                      Base Period
                    </h3>
                    <div className="text-sm text-gray-600 mb-4">
                      {filters.baseStartDate && filters.baseEndDate ? (
                        `${new Date(filters.baseStartDate).toLocaleDateString()} - ${new Date(filters.baseEndDate).toLocaleDateString()}`
                      ) : (
                        "Select date range"
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Budgeted</span>
                        <span className="font-semibold">{formatCurrency(reportData.periods?.base?.totals?.budgeted || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Actual</span>
                        <span className="font-semibold">{formatCurrency(reportData.periods?.base?.totals?.actual || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Variance</span>
                        <span className={`font-semibold ${
                          reportData.periods?.base?.totals?.variance >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {reportData.periods?.base?.totals?.variance >= 0 ? "+" : ""}
                          {formatCurrency(reportData.periods?.base?.totals?.variance || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Achievement</span>
                        <span className="font-semibold">{(reportData.periods?.base?.totals?.achievement || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Comparison Period */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar size={18} className="text-purple-600" />
                      Comparison Period
                    </h3>
                    <div className="text-sm text-gray-600 mb-4">
                      {filters.comparisonStartDate && filters.comparisonEndDate ? (
                        `${new Date(filters.comparisonStartDate).toLocaleDateString()} - ${new Date(filters.comparisonEndDate).toLocaleDateString()}`
                      ) : (
                        "Select date range"
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Budgeted</span>
                        <span className="font-semibold">{formatCurrency(reportData.periods?.comparison?.totals?.budgeted || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Actual</span>
                        <span className="font-semibold">{formatCurrency(reportData.periods?.comparison?.totals?.actual || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Variance</span>
                        <span className={`font-semibold ${
                          reportData.periods?.comparison?.totals?.variance >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {reportData.periods?.comparison?.totals?.variance >= 0 ? "+" : ""}
                          {formatCurrency(reportData.periods?.comparison?.totals?.variance || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Achievement</span>
                        <span className="font-semibold">{(reportData.periods?.comparison?.totals?.achievement || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Period over Period Change */}
                <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Period-over-Period Change</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Budgeted Change</span>
                      <div className={`text-xl font-bold ${
                        reportData.periodOverPeriod?.change?.budgeted >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {reportData.periodOverPeriod?.change?.budgeted >= 0 ? "+" : ""}
                        {formatCurrency(reportData.periodOverPeriod?.change?.budgeted || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Actual Change</span>
                      <div className={`text-xl font-bold ${
                        reportData.periodOverPeriod?.change?.actual >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {reportData.periodOverPeriod?.change?.actual >= 0 ? "+" : ""}
                        {formatCurrency(reportData.periodOverPeriod?.change?.actual || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Achievement Change</span>
                      <div className={`text-xl font-bold ${
                        reportData.periodOverPeriod?.change?.achievement >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {reportData.periodOverPeriod?.change?.achievement >= 0 ? "+" : ""}
                        {(reportData.periodOverPeriod?.change?.achievement || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Actual % Change</span>
                      <div className={`text-xl font-bold ${
                        reportData.periodOverPeriod?.percentChange?.actual >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {reportData.periodOverPeriod?.percentChange?.actual >= 0 ? "+" : ""}
                        {(reportData.periodOverPeriod?.percentChange?.actual || 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparison Chart */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Period Comparison Chart</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={periodComparisonChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => formatCurrency(v).replace("MWK ", "")} />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="budgeted" name="Budgeted" fill="#3b82f6" />
                        <Bar dataKey="actual" name="Actual" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-600">
            <BarChart3 size={48} className="mx-auto mb-3 text-gray-300" />
            <div className="font-medium">No report data available</div>
            <div className="text-sm text-gray-500 mt-1">Try adjusting your filters or create a budget first.</div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}

'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar/Sidebar';
import BusinessScopeSelector, { useBusinessScope } from '@/components/BusinessScopeSelector';
import { appendBusinessScopeParams } from '@/lib/businessScopeStorage';
import { formatSalaryAmount } from '@/lib/currencyUtils';
import {
  AlertCircle,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const PAYROLL_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'Pending', label: 'Pending / Draft' },
  { value: 'Reviewed', label: 'Reviewed' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Processed', label: 'Processed' },
  { value: 'Posted', label: 'Posted' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Closed', label: 'Closed' },
];

function toYmdLocal(value) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function statusBadge(status, isProvisional) {
  if (isProvisional) {
    return (
      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
        {tt('Provisional')}
      </span>
    );
  }
  const map = {
    Processed: 'bg-green-100 text-green-800',
    Posted: 'bg-green-100 text-green-800',
    Paid: 'bg-emerald-100 text-emerald-800',
    Approved: 'bg-blue-100 text-blue-800',
    Pending: 'bg-gray-100 text-gray-700',
    Draft: 'bg-gray-100 text-gray-700',
    Reversed: 'bg-red-100 text-red-800',
  };
  const cls = map[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {status || '—'}
    </span>
  );
}

function journalBadge(status) {
  const map = {
    Posted: 'bg-blue-100 text-blue-800',
    'Not posted': 'bg-gray-100 text-gray-600',
    'Pending post': 'bg-yellow-100 text-yellow-800',
    Reversed: 'bg-red-100 text-red-800',
  };
  const cls = map[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {status}
    </span>
  );
}

export default function PayeSummaryClient() {
  const {
    mode: businessScope,
    tenantIds: businessTenantIds,
    setScope: setBusinessScope,
    hydrated: scopeHydrated,
  } = useBusinessScope('paye-summary');

  const now = new Date();
  const [periodType, setPeriodType] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [payrollStatus, setPayrollStatus] = useState('all');
  const [journalPosted, setJournalPosted] = useState('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [employees, setEmployees] = useState([]);

  const dateRange = useMemo(() => {
    if (periodType === 'month' && selectedMonth && selectedYear) {
      const start = new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10) - 1, 1);
      const end = new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10), 0);
      return { fromDate: toYmdLocal(start), toDate: toYmdLocal(end) };
    }
    if (periodType === 'year') {
      const y = parseInt(selectedYear, 10) || now.getFullYear();
      return { fromDate: `${y}-01-01`, toDate: `${y}-12-31` };
    }
    if (periodType === 'lastMonth') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const start = new Date(lm.getFullYear(), lm.getMonth(), 1);
      const end = new Date(lm.getFullYear(), lm.getMonth() + 1, 0);
      return { fromDate: toYmdLocal(start), toDate: toYmdLocal(end) };
    }
    if (periodType === 'custom' && fromDate && toDate) {
      return { fromDate, toDate };
    }
    if (periodType === 'custom' && fromDate) {
      return { fromDate, toDate: fromDate };
    }
    const y = now.getFullYear();
    return { fromDate: `${y}-01-01`, toDate: `${y}-12-31` };
  }, [periodType, selectedMonth, selectedYear, fromDate, toDate, now]);

  const periodLabel = useMemo(() => {
    if (periodType === 'month' && selectedMonth && selectedYear) {
      const name = MONTHS.find((m) => m.value === selectedMonth)?.label;
      return `${name} ${selectedYear}`;
    }
    if (periodType === 'year') return `Year ${selectedYear}`;
    if (periodType === 'lastMonth') return 'Last month';
    if (periodType === 'custom') return `${fromDate || '…'} to ${toDate || '…'}`;
    return 'All periods';
  }, [periodType, selectedMonth, selectedYear, fromDate, toDate]);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (dateRange.fromDate) params.set('fromDate', dateRange.fromDate);
    if (dateRange.toDate) params.set('toDate', dateRange.toDate);
    if (department) params.set('department', department);
    if (branch) params.set('branch', branch);
    if (employeeId) params.set('employeeId', employeeId);
    if (payrollStatus !== 'all') params.set('payrollStatus', payrollStatus);
    if (journalPosted !== 'all') params.set('journalPosted', journalPosted);
    appendBusinessScopeParams(params, {
      mode: businessScope,
      tenantIds: businessTenantIds,
    });
    return params;
  }, [
    dateRange,
    department,
    branch,
    employeeId,
    payrollStatus,
    journalPosted,
    businessScope,
    businessTenantIds,
  ]);

  const fetchReport = useCallback(async () => {
    if (!scopeHydrated) return;
    setLoading(true);
    setError('');
    try {
      const params = buildQueryParams();
      const res = await fetch(`/api/payroll/paye-summary?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load PAYE summary');
      }
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load PAYE summary');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, scopeHydrated]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/employees?limit=500&status=Active');
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.employees || data.data || []);
        }
      } catch {
        /* optional */
      }
    })();
  }, []);

  const filteredRows = useMemo(() => {
    const rows = report?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.employeeName?.toLowerCase().includes(q) ||
        r.employeeNumber?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q),
    );
  }, [report?.rows, search]);

  const summary = report?.summary || {};
  const formatCurrency = (n) => formatSalaryAmount(n ?? 0);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const params = buildQueryParams();
      params.set('format', format);
      const res = await fetch(`/api/payroll/paye-summary/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paye-summary-${periodLabel.replace(/\s+/g, '-')}.${format === 'pdf' ? tt('pdf') : tt('xlsx')}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const summaryCards = [
    { label: 'Employees in payroll', value: summary.employeeCount ?? 0, format: 'number' },
    { label: 'Total gross pay', value: summary.totalGrossPay, format: 'currency' },
    { label: 'Total taxable income', value: summary.totalTaxableIncome, format: 'currency' },
    { label: 'Total PAYE deducted', value: summary.totalPayeDeducted, format: 'currency', highlight: 'blue' },
    { label: 'Total net pay', value: summary.totalNetPay, format: 'currency' },
    { label: 'Pension (employee)', value: summary.totalPensionEmployee, format: 'currency' },
    { label: 'Pension (employer)', value: summary.totalPensionEmployer, format: 'currency' },
    { label: 'Salary advance recovery', value: summary.totalAdvanceRecovery, format: 'currency' },
    { label: 'Other deductions', value: summary.totalOtherDeductions, format: 'currency' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        <PosStylePageHeader
          title={tt('PAYE Summary')}
          description="Statutory PAYE report from finalized payroll records — filterable, exportable, and aligned with accounting postings."
          actions={
            <>
              <BusinessScopeSelector
                mode={businessScope}
                selectedTenantIds={businessTenantIds}
                onChange={setBusinessScope}
                compact
              />
              <PosStyleHeaderButton type="button" onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {tt('Refresh')}
              </PosStyleHeaderButton>
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                disabled={!!exporting || !filteredRows.length}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {exporting === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Excel
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                disabled={!!exporting || !filteredRows.length}
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:shadow-md disabled:opacity-50"
              >
                {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                PDF
              </button>
            </>
          }
        />

        {summary.provisionalCount > 0 && (
          <div className="mb-4 flex items-start gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              {summary.provisionalCount} payroll line(s) are still draft/pending — figures shown are
              provisional until payroll is approved and posted.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        <PosStylePanel className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Period type')}</label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="month">{tt('Specific month')}</option>
                <option value="lastMonth">{tt('Last month')}</option>
                <option value="year">{tt('Full year')}</option>
                <option value="custom">{tt('Custom range')}</option>
              </select>
            </div>
            {(periodType === 'month' || periodType === 'year') && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Year')}</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({ length: 10 }, (_, i) => {
                    const y = now.getFullYear() - 5 + i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {periodType === 'month' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Month')}</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {periodType === 'custom' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{tt('From')}</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{tt('To')}</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Department')}</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={tt('Filter by department')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Branch / location')}</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder={tt('Filter by branch')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Employee')}</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{tt('All employees')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId || emp.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Payroll status')}</label>
              <select
                value={payrollStatus}
                onChange={(e) => setPayrollStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {PAYROLL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Journal status')}</label>
              <select
                value={journalPosted}
                onChange={(e) => setJournalPosted(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">{tt('All')}</option>
                <option value="posted">{tt('Posted to GL')}</option>
                <option value="unposted">{tt('Not posted')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{tt('Search')}</label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tt('Name, employee no., department…')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm text-gray-500">
            <Calendar className="w-4 h-4 mr-1.5" />
            {periodLabel}
            {report?.scope?.businessLabel && (
              <span className="ml-3 text-gray-400">· {report.scope.businessLabel}</span>
            )}
          </div>
        </PosStylePanel>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`bg-white rounded-xl shadow-sm border p-4 ${
                card.highlight === 'blue' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'
              }`}
            >
              <p className="text-xs font-medium text-gray-500">{card.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {card.format === 'number' ? card.value : formatCurrency(card.value)}
              </p>
            </div>
          ))}
        </div>

        {(summary.totalPayeRemitted != null || summary.totalPayeOutstanding != null) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-medium text-green-700">{tt('PAYE remitted to MRA')}</p>
              <p className="min-w-0 break-words text-lg font-bold leading-tight tabular-nums text-green-900 sm:text-xl">{formatCurrency(summary.totalPayeRemitted)}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs font-medium text-yellow-700">PAYE outstanding (MRA)</p>
              <p className="min-w-0 break-words text-lg font-bold leading-tight tabular-nums text-yellow-900 sm:text-xl">{formatCurrency(summary.totalPayeOutstanding)}</p>
            </div>
          </div>
        )}

        <PosStylePanel className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">{tt('Payroll detail')}</h2>
            <span className="text-sm text-gray-500">{filteredRows.length} line(s)</span>
          </div>
          {loading ? (
            <div className="p-12 flex flex-col items-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              {tt('Loading payroll records…')}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {tt('No payroll records match the selected filters.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-3 text-left">{tt('Emp #')}</th>
                    <th className="px-3 py-3 text-left">{tt('Employee')}</th>
                    <th className="px-3 py-3 text-left">{tt('Department')}</th>
                    <th className="px-3 py-3 text-right">{tt('Basic')}</th>
                    <th className="px-3 py-3 text-right">{tt('Taxable Allw.')}</th>
                    <th className="px-3 py-3 text-right">{tt('Non-tax Allw.')}</th>
                    <th className="px-3 py-3 text-right">{tt('Gross')}</th>
                    <th className="px-3 py-3 text-right">{tt('Taxable Inc.')}</th>
                    <th className="px-3 py-3 text-right">PAYE</th>
                    <th className="px-3 py-3 text-right">NPS</th>
                    <th className="px-3 py-3 text-right">{tt('Other Ded.')}</th>
                    <th className="px-3 py-3 text-right">{tt('Net Pay')}</th>
                    <th className="px-3 py-3 text-left">{tt('Period')}</th>
                    <th className="px-3 py-3 text-left">{tt('Status')}</th>
                    <th className="px-3 py-3 text-left">{tt('Journal')}</th>
                    <th className="px-3 py-3 text-center">{tt('Payslip')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((row) => (
                    <tr key={row.payrollId} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{row.employeeNumber}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">{row.employeeName}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{row.department}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatCurrency(row.basicSalary)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatCurrency(row.taxableAllowances)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatCurrency(row.nonTaxableAllowances)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatCurrency(row.grossPay)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatCurrency(row.taxableIncome)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums font-medium text-blue-700">{formatCurrency(row.payeDeducted)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatCurrency(row.pensionEmployee)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatCurrency(row.otherDeductions)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums font-medium">{formatCurrency(row.netPay)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">{row.payrollPeriod?.label}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{statusBadge(row.payrollStatus, row.isProvisional)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{journalBadge(row.journalStatus)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <a
                          href={`/api/payroll/${row.payrollId}/payslip`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          title={tt('Download payslip')}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-right text-gray-700">
                      Totals ({filteredRows.length} lines)
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(filteredRows.reduce((s, r) => s + r.grossPay, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(filteredRows.reduce((s, r) => s + r.taxableIncome, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-blue-700">{formatCurrency(filteredRows.reduce((s, r) => s + r.payeDeducted, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(filteredRows.reduce((s, r) => s + r.pensionEmployee, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(filteredRows.reduce((s, r) => s + r.otherDeductions, 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(filteredRows.reduce((s, r) => s + r.netPay, 0))}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </PosStylePanel>

        {(report?.byEmployee?.length ?? 0) > 0 && (
          <PosStylePanel className="mt-6 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{tt('PAYE by employee')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">{tt('Employee')}</th>
                    <th className="px-4 py-3 text-left">{tt('Department')}</th>
                    <th className="px-4 py-3 text-right">{tt('Total PAYE')}</th>
                    <th className="px-4 py-3 text-right">{tt('Total gross')}</th>
                    <th className="px-4 py-3 text-right">{tt('Total net')}</th>
                    <th className="px-4 py-3 text-center">{tt('Periods')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.byEmployee.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50/80">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{emp.employeeName}</div>
                        <div className="text-xs text-gray-500">{emp.employeeNumber}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{emp.department}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-blue-700">{formatCurrency(emp.totalPaye)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(emp.totalGross)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(emp.totalNet)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{emp.periods?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PosStylePanel>
        )}
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar/Sidebar';
import { FileSpreadsheet, FileText, CheckSquare, Square, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatSalaryAmount } from '@/lib/currencyUtils';

export default function PayeSummaryPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [byEmployee, setByEmployee] = useState([]);
  const [dateRange, setDateRange] = useState('year');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Month options
  const months = [
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

  const toYmdLocal = (value) => {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    fetchPayeSummary();
  }, [dateRange, fromDate, toDate, selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectAll) {
      setSelectedEmployees(byEmployee.map(emp => emp.employeeId));
    } else {
      setSelectedEmployees([]);
    }
  }, [selectAll, byEmployee]);

  const fetchPayeSummary = async () => {
    setLoading(true);
    try {
      let url = '/api/payroll/paye-summary?';
      
      if (dateRange === 'month' && selectedMonth && selectedYear) {
        // Filter by specific month
        const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
        const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);
        url += `fromDate=${toYmdLocal(startDate)}&toDate=${toYmdLocal(endDate)}`;
      } else if (dateRange === 'custom' && fromDate && toDate) {
        url += `fromDate=${fromDate}&toDate=${toDate}`;
      } else if (dateRange === 'custom' && fromDate) {
        url += `fromDate=${fromDate}&`;
      } else if (dateRange === 'custom' && toDate) {
        url += `toDate=${toDate}`;
      } else if (dateRange === 'lastMonth') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        url += `fromDate=${toYmdLocal(startDate)}&toDate=${toYmdLocal(endDate)}`;
      } else if (dateRange === 'lastYear') {
        const lastYear = new Date().getFullYear() - 1;
        url += `fromDate=${lastYear}-01-01&toDate=${lastYear}-12-31`;
      } else if (dateRange === 'year') {
        const currentYear = new Date().getFullYear();
        url += `fromDate=${currentYear}-01-01&toDate=${currentYear}-12-31`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.summary) {
        setSummary(data.summary);
        setByEmployee(data.byEmployee || []);
      }
    } catch (error) {
      console.error('Error fetching PAYE summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => formatSalaryAmount(amount ?? 0);

  const getDateRangeLabel = () => {
    if (dateRange === 'month' && selectedMonth && selectedYear) {
      const monthName = months.find(m => m.value === selectedMonth)?.label;
      return `${monthName} ${selectedYear}`;
    }
    switch (dateRange) {
      case 'month': return 'This Month';
      case 'lastMonth': return 'Last Month';
      case 'year': return 'This Year';
      case 'lastYear': return 'Last Year';
      case 'custom': return 'Custom Range';
      default: return 'All Time';
    }
  };

  const toggleEmployeeSelection = (empId) => {
    if (selectedEmployees.includes(empId)) {
      setSelectedEmployees(selectedEmployees.filter(id => id !== empId));
      setSelectAll(false);
    } else {
      setSelectedEmployees([...selectedEmployees, empId]);
      if (selectedEmployees.length + 1 === byEmployee.length) {
        setSelectAll(true);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
      setSelectAll(false);
    } else {
      setSelectedEmployees(byEmployee.map(emp => emp.employeeId));
      setSelectAll(true);
    }
  };

  const getExportData = () => {
    if (selectedEmployees.length === 0) {
      return byEmployee;
    }
    return byEmployee.filter(emp => selectedEmployees.includes(emp.employeeId));
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      const data = getExportData();
      const headers = ['Employee Name', 'Employee ID', 'Department', 'Total PAYE', 'Pending', 'Paid', 'Periods Count'];
      const rows = data.map(emp => [
        emp.employeeName,
        emp.employeeNumber,
        emp.department,
        emp.totalPaye.toFixed(2),
        emp.pendingAmount.toFixed(2),
        emp.paidAmount.toFixed(2),
        emp.periods.length.toString()
      ]);

      let csvContent = headers.join(',') + '\n';
      rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });

      // Add summary row
      const totalRow = ['TOTAL', '', '', 
        data.reduce((sum, emp) => sum + emp.totalPaye, 0).toFixed(2),
        data.reduce((sum, emp) => sum + emp.pendingAmount, 0).toFixed(2),
        data.reduce((sum, emp) => sum + emp.paidAmount, 0).toFixed(2),
        ''
      ];
      csvContent += totalRow.map(cell => `"${cell}"`).join(',') + '\n';

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `paye_summary_${getDateRangeLabel().replace(/\s+/g, '_')}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting CSV:', error);
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = () => {
    setExporting(true);
    try {
      const data = getExportData();
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['PAYE Summary Report'],
        [''],
        ['Period', getDateRangeLabel()],
        ['Generated On', new Date().toLocaleDateString()],
        [''],
        ['Total PAYE', formatCurrency(summary?.totalPaye || 0)],
        ['Pending PAYE', formatCurrency(summary?.pendingPaye || 0)],
        ['Paid PAYE', formatCurrency(summary?.paidPaye || 0)],
        ['Employees', summary?.employeeCount || 0],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Employee breakdown sheet
      const employeeData = [
        ['Employee Name', 'Employee ID', 'Department', 'Total PAYE', 'Pending PAYE', 'Paid PAYE', 'Periods Count'],
        ...data.map(emp => [
          emp.employeeName,
          emp.employeeNumber,
          emp.department,
          emp.totalPaye,
          emp.pendingAmount,
          emp.paidAmount,
          emp.periods.length
        ]),
        ['TOTAL', '', '',
          data.reduce((sum, emp) => sum + emp.totalPaye, 0),
          data.reduce((sum, emp) => sum + emp.pendingAmount, 0),
          data.reduce((sum, emp) => sum + emp.paidAmount, 0),
          data.reduce((sum, emp) => sum + emp.periods.length, 0)
        ]
      ];
      const employeeSheet = XLSX.utils.aoa_to_sheet(employeeData);
      
      // Format currency columns
      const range = XLSX.utils.decode_range(employeeSheet['!ref']);
      for (let R = 1; R <= range.e.r; R++) {
        for (let C = 3; C <= 5; C++) {
          const cell = employeeSheet[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && typeof cell.v === 'number') {
            cell.z = '#,##0.00';
          }
        }
      }
      
      XLSX.utils.book_append_sheet(workbook, employeeSheet, 'By Employee');

      // Period details sheet
      const periodData = [
        ['Employee Name', 'Period', 'Amount', 'Status']
      ];
      data.forEach(emp => {
        emp.periods.forEach(period => {
          periodData.push([
            emp.employeeName,
            period.period,
            period.amount,
            period.status
          ]);
        });
      });
      const periodSheet = XLSX.utils.aoa_to_sheet(periodData);
      XLSX.utils.book_append_sheet(workbook, periodSheet, 'Period Details');

      XLSX.writeFile(workbook, `paye_summary_${getDateRangeLabel().replace(/\s+/g, '_')}.xlsx`);
    } catch (error) {
      console.error('Error exporting Excel:', error);
    } finally {
      setExporting(false);
    }
  };

  const totalPaye = summary?.totalPaye || 0;
  const pendingPaye = summary?.pendingPaye || 0;
  const paidPaye = summary?.paidPaye || 0;
  const exportData = getExportData();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">PAYE Summary for MRA</h1>
            <p className="text-gray-600">Track and manage PAYE tax by employee for revenue authority settlement</p>
          </div>
          
          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              disabled={exporting || byEmployee.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={18} />
              CSV
            </button>
            <button
              onClick={exportToExcel}
              disabled={exporting || byEmployee.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
              >
                <option value="month">Specific Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="year">This Year</option>
                <option value="lastYear">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            {dateRange === 'month' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Select Month</option>
                    {months.map(month => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2"
                  >
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
              </>
            )}
            
            {dateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              </>
            )}
            
            <div className="ml-auto text-sm text-gray-600">
              <Calendar className="inline mr-1" size={16} />
              {getDateRangeLabel()}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total PAYE</h3>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPaye)}</p>
            <p className="text-sm text-gray-500 mt-1">{getDateRangeLabel()}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6 border-l-4 border-yellow-400">
            <h3 className="text-sm font-medium text-yellow-700">Pending PAYE</h3>
            <p className="text-2xl font-bold text-yellow-900">{formatCurrency(pendingPaye)}</p>
            <p className="text-sm text-yellow-600 mt-1">For MRA Settlement</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6 border-l-4 border-green-400">
            <h3 className="text-sm font-medium text-green-700">Paid PAYE</h3>
            <p className="text-2xl font-bold text-green-900">{formatCurrency(paidPaye)}</p>
            <p className="text-sm text-green-600 mt-1">Remitted to MRA</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6 border-l-4 border-blue-400">
            <h3 className="text-sm font-medium text-blue-700">Employees</h3>
            <p className="text-2xl font-bold text-blue-900">{summary?.employeeCount || 0}</p>
            <p className="text-sm text-blue-600 mt-1">With PAYE</p>
          </div>
        </div>

        {/* Employee Breakdown */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">PAYE by Employee</h2>
            <div className="text-sm text-gray-600">
              {selectedEmployees.length > 0 ? (
                <span>{selectedEmployees.length} employee(s) selected for export</span>
              ) : (
                <span>All {byEmployee.length} employees</span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : byEmployee.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No PAYE records found for the selected period</div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {selectAll ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total PAYE</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-yellow-600 uppercase tracking-wider">Pending</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-green-600 uppercase tracking-wider">Paid</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {byEmployee.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleEmployeeSelection(emp.employeeId)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {selectedEmployees.includes(emp.employeeId) ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{emp.employeeName}</div>
                      <div className="text-sm text-gray-500">ID: {emp.employeeNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {emp.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatCurrency(emp.totalPaye)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-yellow-600">
                      {formatCurrency(emp.pendingAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                      {formatCurrency(emp.paidAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="3" className="px-6 py-3 text-sm font-medium text-gray-900">
                    {selectedEmployees.length > 0 ? `Selected (${selectedEmployees.length})` : 'Total'}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    {formatCurrency(exportData.reduce((sum, emp) => sum + emp.totalPaye, 0))}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-yellow-600">
                    {formatCurrency(exportData.reduce((sum, emp) => sum + emp.pendingAmount, 0))}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-green-600">
                    {formatCurrency(exportData.reduce((sum, emp) => sum + emp.paidAmount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Period Details */}
        {byEmployee.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Period Details</h2>
            </div>
            <div className="p-4">
              {byEmployee.slice(0, 5).map((emp) => (
                <div key={emp.employeeId} className="mb-4 pb-4 border-b last:border-0">
                  <div className="font-medium text-gray-800 mb-2">{emp.employeeName}</div>
                  <div className="text-sm text-gray-600 ml-4">
                    {emp.periods.slice(0, 3).map((period, idx) => (
                      <div key={idx} className="flex justify-between py-1">
                        <span>{period.period}</span>
                        <span className={period.status === 'Pending' ? 'text-yellow-600' : 'text-green-600'}>
                          {formatCurrency(period.amount)} ({period.status})
                        </span>
                      </div>
                    ))}
                    {emp.periods.length > 3 && (
                      <div className="text-blue-600 mt-1">+ {emp.periods.length - 3} more periods</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

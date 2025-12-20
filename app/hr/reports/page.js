"use client";

import { useState, useEffect } from "react";
import { FileText, Download, DollarSign, TrendingUp } from "lucide-react";

export default function HRReports() {
  const [reportType, setReportType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notification, setNotification] = useState(null);

  const reportTypes = [
    {
      id: 'payslips',
      name: 'Employee Payslips',
      description: 'Generate individual payslips for employees',
      icon: FileText,
      color: 'blue'
    },
    {
      id: 'statutory',
      name: 'Statutory Remittances',
      description: 'PAYE and NPS remittance reports',
      icon: DollarSign,
      color: 'green'
    },
    {
      id: 'payroll',
      name: 'Payroll Summary',
      description: 'Complete payroll breakdown by period',
      icon: TrendingUp,
      color: 'red'
    }
  ];

  // Fetch employees when payslips report is selected
  useEffect(() => {
    if (reportType === 'payslips') {
      fetchEmployees();
    } else {
      setEmployees([]);
      setSelectedEmployee('');
    }
  }, [reportType]);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!reportType || !startDate || !endDate) {
      setNotification({
        type: 'error',
        message: 'Please select report type and date range before generating.'
      });
      return;
    }

    try {
      setGenerating(true);
      setNotification(null);
      
      let endpoint = '';
      switch (reportType) {
        case 'payslips':
          endpoint = '/api/hr-reports/payslips';
          break;
        case 'statutory':
          endpoint = '/api/hr-reports/statutory-remittances';
          break;
        case 'payroll':
          endpoint = '/api/hr-reports/payroll-summary';
          break;
        default:
          throw new Error('Invalid report type');
      }

      // Always request PDF format and include employee filter when applicable
      const formatParam = '&format=pdf';
      const employeeParam = reportType === 'payslips' && selectedEmployee ? `&employeeId=${selectedEmployee}` : '';
      const response = await fetch(`${endpoint}?startDate=${startDate}&endDate=${endDate}${formatParam}${employeeParam}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate report' }));
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const contentType = response.headers.get('content-type');
      
      // Check if response is PDF
      if (contentType && contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${reportType}-report-${startDate}-to-${endDate}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        setNotification({
          type: 'success',
          message: 'Report generated successfully. Your download should begin shortly.'
        });
      } else if (contentType && contentType.includes('application/json')) {
        // Handle JSON responses for other report types
        const data = await response.json();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${reportType}-report-${startDate}-to-${endDate}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        setNotification({
          type: 'success',
          message: 'Report generated successfully. Check your downloads for the JSON file.'
        });
      } else {
        // Fallback for other content types
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${reportType}-report-${startDate}-to-${endDate}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        setNotification({
          type: 'success',
          message: 'Report generated successfully.'
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to generate report.'
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">HR Reports</h1>
        <p className="text-gray-600">Generate comprehensive HR and payroll reports</p>
      </div>

      {notification && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 flex items-start gap-2 ${
            notification.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span className="font-semibold">
            {notification.type === 'success' ? 'Success' : 'Error'}:
          </span>
          <span>{notification.message}</span>
          <button
            className="ml-auto text-sm underline"
            onClick={() => setNotification(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Report Type Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Report Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => {
            const IconComponent = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => setReportType(report.id)}
                className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                  reportType === report.id
                    ? `border-${report.color}-500 bg-${report.color}-50`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-${report.color}-100`}>
                    <IconComponent size={24} className={`text-${report.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{report.name}</h3>
                    <p className="text-sm text-gray-600">{report.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Employee Filter (for payslips only) */}
      {reportType === 'payslips' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filter by Employee (Optional)</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              disabled={loadingEmployees}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeId || employee.id} - {employee.name}
                </option>
              ))}
            </select>
            {loadingEmployees && (
              <p className="text-sm text-gray-500 mt-1">Loading employees...</p>
            )}
          </div>
        </div>
      )}

      {/* Date Range Selection */}
      {reportType && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Select Date Range</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {reportType && startDate && endDate && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Ready to Generate Report</h3>
              <p className="text-sm text-gray-600">
                {reportTypes.find(r => r.id === reportType)?.name} from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Generating...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Information Box */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Report Information</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Payslips:</strong> Individual employee payslips with detailed breakdown of salary, deductions, and net pay</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Statutory Remittances:</strong> Summary of PAYE and NPS contributions for tax authority submission</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Leave Summary:</strong> Employee leave balances, requests, and usage patterns</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Attendance Summary:</strong> Employee attendance records, hours worked, and overtime</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Payroll Summary:</strong> Complete payroll breakdown including all employees and totals</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

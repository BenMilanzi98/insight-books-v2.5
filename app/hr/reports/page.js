"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  DollarSign, 
  TrendingUp, 
  Users,
  Clock,
  Calendar,
  BarChart3,
  PieChart,
  User,
  Building2,
  Filter,
  X,
  Eye,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  Mail,
  Printer
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/currencyUtils";

export default function HRReports() {
  const [reportType, setReportType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [reportPreview, setReportPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Payslip-specific state
  const [payslipMonth, setPayslipMonth] = useState('');
  const [payslipYear, setPayslipYear] = useState(new Date().getFullYear().toString());
  const [selectedPayslipEmployee, setSelectedPayslipEmployee] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingPayslip, setGeneratingPayslip] = useState(false);

  const reportTypes = [
    {
      id: 'payslips',
      name: 'Employee Payslips',
      description: 'Generate individual payslips for employees',
      icon: FileText,
      color: 'blue',
      requiresEmployee: true,
      requiresDateRange: true
    },
    {
      id: 'statutory',
      name: 'Statutory Remittances',
      description: 'PAYE and NPS remittance reports',
      icon: DollarSign,
      color: 'green',
      requiresEmployee: false,
      requiresDateRange: true
    },
    {
      id: 'payroll',
      name: 'Payroll Summary',
      description: 'Complete payroll breakdown by period',
      icon: TrendingUp,
      color: 'purple',
      requiresEmployee: false,
      requiresDateRange: true
    },
    {
      id: 'attendance',
      name: 'Attendance Report',
      description: 'Employee attendance records and hours worked',
      icon: Clock,
      color: 'orange',
      requiresEmployee: false,
      requiresDateRange: true
    },
    {
      id: 'employee-summary',
      name: 'Employee Summary',
      description: 'Comprehensive employee information and statistics',
      icon: Users,
      color: 'indigo',
      requiresEmployee: false,
      requiresDateRange: false
    },
    {
      id: 'department',
      name: 'Department Report',
      description: 'Department-wise employee and payroll analysis',
      icon: Building2,
      color: 'teal',
      requiresEmployee: false,
      requiresDateRange: false
    }
  ];

  // Fetch employees and departments on mount
  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  // Fetch employees when needed
  useEffect(() => {
    if (reportType && reportTypes.find(r => r.id === reportType)?.requiresEmployee) {
      fetchEmployees();
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

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        // API returns array directly, not wrapped in departments
        setDepartments(Array.isArray(data) ? data : (data.departments || []));
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handlePreviewReport = async () => {
    if (!reportType) {
      setNotification({
        type: 'error',
        message: 'Please select a report type first.'
      });
      return;
    }

    const selectedReport = reportTypes.find(r => r.id === reportType);
    if (selectedReport?.requiresDateRange && (!startDate || !endDate)) {
      setNotification({
        type: 'error',
        message: 'Please select date range before previewing.'
      });
      return;
    }

    try {
      setPreviewLoading(true);
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
        case 'attendance':
          endpoint = '/api/hr-reports/attendance';
          break;
        case 'employee-summary':
          endpoint = '/api/hr-reports/employee-summary';
          break;
        case 'department':
          endpoint = '/api/hr-reports/department';
          break;
        default:
          throw new Error('Invalid report type');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedEmployee) params.append('employeeId', selectedEmployee);
      if (selectedDepartment) params.append('departmentId', selectedDepartment);
      params.append('format', 'json');

      const response = await fetch(`${endpoint}?${params.toString()}`);
      
      if (!response.ok) {
        let errorMessage = 'Failed to load preview';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          if (response.status === 404) {
            errorMessage = 'No data found for the selected criteria. Please try a different date range or filters.';
          } else {
            errorMessage = `Server error (${response.status}). Please try again.`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setReportPreview(data);
      setShowPreview(true);
    } catch (error) {
      console.error('Error previewing report:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to load preview.'
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    const selectedReport = reportTypes.find(r => r.id === reportType);
    
    if (!reportType) {
      setNotification({
        type: 'error',
        message: 'Please select report type before generating.'
      });
      return;
    }

    if (selectedReport?.requiresDateRange && (!startDate || !endDate)) {
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
        case 'attendance':
          endpoint = '/api/hr-reports/attendance';
          break;
        case 'employee-summary':
          endpoint = '/api/hr-reports/employee-summary';
          break;
        case 'department':
          endpoint = '/api/hr-reports/department';
          break;
        default:
          throw new Error('Invalid report type');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedEmployee) params.append('employeeId', selectedEmployee);
      if (selectedDepartment) params.append('departmentId', selectedDepartment);
      params.append('format', exportFormat);

      const response = await fetch(`${endpoint}?${params.toString()}`);
      
      if (!response.ok) {
        let errorMessage = 'Failed to generate report';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          if (response.status === 404) {
            errorMessage = 'No data found for the selected criteria. Please try a different date range or filters.';
          } else {
            errorMessage = `Server error (${response.status}). Please try again.`;
          }
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      
      // Handle PDF
      if (contentType && contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const filename = `${reportType}-report-${startDate || 'all'}-to-${endDate || 'all'}.pdf`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setNotification({
          type: 'success',
          message: 'Report generated successfully. Your download should begin shortly.'
        });
      } 
      // Handle Excel/CSV
      else if (contentType && (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || contentType.includes('text/csv'))) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const ext = contentType.includes('csv') ? 'csv' : 'xlsx';
        const filename = `${reportType}-report-${startDate || 'all'}-to-${endDate || 'all'}.${ext}`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setNotification({
          type: 'success',
          message: 'Report generated successfully. Your download should begin shortly.'
        });
      }
      // Fallback - if we get JSON when expecting PDF/Excel, show error
      else if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({ error: 'Unexpected response format' }));
        throw new Error(errorData.error || 'Server returned JSON instead of PDF/Excel. Please try again.');
      }
      // Fallback
      else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${reportType}-report-${startDate || 'all'}-to-${endDate || 'all'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
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

  const selectedReportType = reportTypes.find(r => r.id === reportType);

  // Get month/year for payslip period
  const getPayslipPeriod = () => {
    if (!payslipMonth || !payslipYear) return null;
    const month = parseInt(payslipMonth);
    const year = parseInt(payslipYear);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  // Handle payslip print
  const handlePrintPayslip = async () => {
    const period = getPayslipPeriod();
    if (!period) {
      setNotification({
        type: 'error',
        message: 'Please select month and year'
      });
      return;
    }
    if (!selectedPayslipEmployee) {
      setNotification({
        type: 'error',
        message: 'Please select an employee'
      });
      return;
    }

    try {
      setGeneratingPayslip(true);
      const params = new URLSearchParams();
      params.append('startDate', period.start);
      params.append('endDate', period.end);
      params.append('employeeId', selectedPayslipEmployee);
      params.append('format', 'pdf');

      const response = await fetch(`/api/hr-reports/payslips?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to generate payslip');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to generate payslip for printing'
      });
    } finally {
      setGeneratingPayslip(false);
    }
  };

  // Handle payslip PDF download
  const handleDownloadPayslipPDF = async () => {
    const period = getPayslipPeriod();
    if (!period) {
      setNotification({
        type: 'error',
        message: 'Please select month and year'
      });
      return;
    }
    if (!selectedPayslipEmployee) {
      setNotification({
        type: 'error',
        message: 'Please select an employee'
      });
      return;
    }

    try {
      setGeneratingPayslip(true);
      const params = new URLSearchParams();
      params.append('startDate', period.start);
      params.append('endDate', period.end);
      params.append('employeeId', selectedPayslipEmployee);
      params.append('format', 'pdf');

      const response = await fetch(`/api/hr-reports/payslips?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to generate payslip');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const employee = employees.find(e => e.id === selectedPayslipEmployee);
      const employeeName = employee?.name?.replace(/\s+/g, '-') || 'employee';
      a.download = `payslip-${employeeName}-${payslipMonth}-${payslipYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setNotification({
        type: 'success',
        message: 'Payslip downloaded successfully'
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to download payslip'
      });
    } finally {
      setGeneratingPayslip(false);
    }
  };

  // Handle sending payslip via email
  const handleEmailPayslip = async () => {
    const period = getPayslipPeriod();
    if (!period) {
      setNotification({
        type: 'error',
        message: 'Please select month and year'
      });
      return;
    }
    if (!selectedPayslipEmployee) {
      setNotification({
        type: 'error',
        message: 'Please select an employee'
      });
      return;
    }

    try {
      setSendingEmail(true);
      const response = await fetch('/api/hr-reports/payslips/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedPayslipEmployee,
          startDate: period.start,
          endDate: period.end
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send payslip');

      setNotification({
        type: 'success',
        message: 'Payslip sent to employee email successfully'
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to send payslip via email'
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">HR Reports</h1>
        <p className="text-gray-600 mt-1">Generate comprehensive HR and payroll reports</p>
      </div>

      {/* Payslip Generation Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={24} className="text-blue-600" />
          Employee Payslip Generator
        </h2>
        <p className="text-gray-600 mb-6">Generate, print, email, or export payslips for employees</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Month Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month <span className="text-red-500">*</span>
            </label>
            <select
              value={payslipMonth}
              onChange={(e) => setPayslipMonth(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select Month</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          {/* Year Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={payslipYear}
              onChange={(e) => setPayslipYear(e.target.value)}
              min="2020"
              max={new Date().getFullYear() + 1}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPayslipEmployee}
              onChange={(e) => setSelectedPayslipEmployee(e.target.value)}
              disabled={loadingEmployees}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              required
            >
              <option value="">Select Employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeId || employee.id.substring(0, 8)} - {employee.name}
                </option>
              ))}
            </select>
            {loadingEmployees && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                Loading employees...
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePrintPayslip}
            disabled={generatingPayslip || !payslipMonth || !payslipYear || !selectedPayslipEmployee}
            className="px-6 py-2.5 bg-gray-700 text-white rounded-lg flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingPayslip ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Printer size={18} />
                Print Payslip
              </>
            )}
          </button>

          <button
            onClick={handleDownloadPayslipPDF}
            disabled={generatingPayslip || !payslipMonth || !payslipYear || !selectedPayslipEmployee}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingPayslip ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download size={18} />
                Export PDF
              </>
            )}
          </button>

          <button
            onClick={handleEmailPayslip}
            disabled={sendingEmail || !payslipMonth || !payslipYear || !selectedPayslipEmployee}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendingEmail ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail size={18} />
                Send via Email
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 flex items-start gap-3 ${
            notification.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-semibold block">
              {notification.type === 'success' ? 'Success' : 'Error'}:
            </span>
            <span>{notification.message}</span>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            onClick={() => setNotification(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Report Type Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Select Report Type
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => {
            const IconComponent = report.icon;
            const isSelected = reportType === report.id;
            return (
              <button
                key={report.id}
                onClick={() => {
                  setReportType(report.id);
                  if (!report.requiresEmployee) {
                    setSelectedEmployee('');
                  }
                }}
                className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                  isSelected
                    ? `border-${report.color}-500 bg-${report.color}-50 shadow-sm`
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg ${
                    isSelected ? `bg-${report.color}-100` : 'bg-gray-100'
                  }`}>
                    <IconComponent 
                      size={24} 
                      className={isSelected ? `text-${report.color}-600` : 'text-gray-600'} 
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold mb-1 ${
                      isSelected ? `text-${report.color}-900` : 'text-gray-900'
                    }`}>
                      {report.name}
                    </h3>
                    <p className="text-sm text-gray-600">{report.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Section */}
      {reportType && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Filter size={20} />
            Report Filters
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Employee Filter */}
            {selectedReportType?.requiresEmployee && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee (Optional)
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  disabled={loadingEmployees}
                  className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">All Employees</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employeeId || employee.id.substring(0, 8)} - {employee.name}
                    </option>
                  ))}
                </select>
                {loadingEmployees && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    Loading employees...
                  </p>
                )}
              </div>
            )}

            {/* Department Filter */}
            {(reportType === 'department' || reportType === 'employee-summary' || reportType === 'attendance') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department (Optional)
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            {selectedReportType?.requiresDateRange && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Export Format Selection */}
      {reportType && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setExportFormat('pdf')}
              className={`px-4 py-2 rounded-md border-2 transition-all flex items-center gap-2 ${
                exportFormat === 'pdf'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <FileText size={18} />
              PDF
            </button>
            <button
              onClick={() => setExportFormat('excel')}
              className={`px-4 py-2 rounded-md border-2 transition-all flex items-center gap-2 ${
                exportFormat === 'excel'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {reportType && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Ready to Generate Report</h3>
              <p className="text-sm text-gray-600">
                {selectedReportType?.name}
                {startDate && endDate && ` from ${formatDate(startDate)} to ${formatDate(endDate)}`}
                {selectedEmployee && ` - ${employees.find(e => e.id === selectedEmployee)?.name || 'Selected Employee'}`}
                {selectedDepartment && ` - ${departments.find(d => d.id === selectedDepartment)?.name || 'Selected Department'}`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePreviewReport}
                disabled={previewLoading || (selectedReportType?.requiresDateRange && (!startDate || !endDate))}
                className="px-5 py-2.5 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {previewLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye size={18} />
                    Preview
                  </>
                )}
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generating || (selectedReportType?.requiresDateRange && (!startDate || !endDate))}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Generate & Download
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && reportPreview && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Report Preview</h2>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setReportPreview(null);
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ReportPreviewContent reportType={reportType} data={reportPreview} />
            </div>
            <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setReportPreview(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleGenerateReport();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Download size={18} />
                Download Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Information Box */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Info size={20} />
          Report Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Available Reports:</h4>
            <ul className="space-y-1.5">
              <li className="flex items-start">
                <span className="mr-2 text-blue-600">•</span>
                <span><strong>Employee Payslips:</strong> Individual employee payslips with detailed breakdown of salary, deductions, and net pay</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-green-600">•</span>
                <span><strong>Statutory Remittances:</strong> Summary of PAYE and NPS contributions for tax authority submission</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-purple-600">•</span>
                <span><strong>Payroll Summary:</strong> Complete payroll breakdown including all employees and totals</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Additional Reports:</h4>
            <ul className="space-y-1.5">
              <li className="flex items-start">
                <span className="mr-2 text-orange-600">•</span>
                <span><strong>Attendance Report:</strong> Employee attendance records, hours worked, and overtime</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-indigo-600">•</span>
                <span><strong>Employee Summary:</strong> Comprehensive employee information and statistics</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-teal-600">•</span>
                <span><strong>Department Report:</strong> Department-wise employee and payroll analysis</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview Component
function ReportPreviewContent({ reportType, data }) {
  if (!data) return <div>No preview data available</div>;

  switch (reportType) {
    case 'payslips':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Payslips Preview</h3>
          {data.payslips && Array.isArray(data.payslips) && data.payslips.length > 0 ? (
            <div className="space-y-4">
              {data.payslips.map((payslip, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold">{payslip.employee?.name || 'Employee'}</h4>
                      <p className="text-sm text-gray-600">{payslip.employee?.employeeId || payslip.employee?.id}</p>
                      {payslip.employee?.jobTitle && (
                        <p className="text-xs text-gray-500">{payslip.employee.jobTitle}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {payslip.period && (
                        <p className="text-sm text-gray-600">
                          {formatDate(new Date(payslip.period.start))} - {formatDate(new Date(payslip.period.end))}
                        </p>
                      )}
                      <p className="font-semibold text-green-600">{formatCurrency(payslip.netPay || 0)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-3 pt-3 border-t border-gray-200">
                    <div>
                      <span className="text-gray-600">Gross Pay:</span>
                      <span className="ml-2 font-medium">{formatCurrency(payslip.earnings?.grossPay || payslip.grossPay || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">PAYE:</span>
                      <span className="ml-2 font-medium">{formatCurrency(payslip.deductions?.paye || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">NPS:</span>
                      <span className="ml-2 font-medium">{formatCurrency(payslip.deductions?.npsEmployee || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Deductions:</span>
                      <span className="ml-2 font-medium">{formatCurrency(payslip.deductions?.totalDeductions || 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {data.summary && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Employees</p>
                      <p className="text-lg font-bold">{data.summary.totalEmployees || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Gross Pay</p>
                      <p className="text-lg font-bold">{formatCurrency(data.summary.totalGrossPay || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Net Pay</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(data.summary.totalNetPay || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Deductions</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency((data.summary.totalPAYE || 0) + (data.summary.totalNPS || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">No payslips found for the selected period</p>
          )}
        </div>
      );

    case 'statutory':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Statutory Remittances Preview</h3>
          {data.summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Employees</p>
                  <p className="text-2xl font-bold text-blue-600">{data.summary.totalEmployees || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total PAYE</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(data.summary.totalPAYE || 0)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total NPS</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(data.summary.totalNPS || 0)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Statutory</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.summary.totalStatutory || 0)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );

    case 'payroll':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Payroll Summary Preview</h3>
          {data.summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Employees</p>
                  <p className="text-2xl font-bold text-blue-600">{data.summary.totalEmployees || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Gross Pay</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(data.summary.totalGrossPay || 0)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Deductions</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(data.summary.totalDeductions || 0)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Net Pay</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(data.summary.totalNetPay || 0)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );

    case 'attendance':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Attendance Report Preview</h3>
          {data.summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Records</p>
                  <p className="text-2xl font-bold text-blue-600">{data.summary.totalRecords || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Present Days</p>
                  <p className="text-2xl font-bold text-green-600">{data.summary.totalPresent || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Absent Days</p>
                  <p className="text-2xl font-bold text-red-600">{data.summary.totalAbsent || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold text-purple-600">{data.summary.totalHours || 0}</p>
                </div>
              </div>
              {data.employeeStatistics && data.employeeStatistics.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Employee Statistics</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.employeeStatistics.slice(0, 5).map((stat, idx) => (
                      <div key={idx} className="border border-gray-200 rounded p-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{stat.employeeName}</span>
                          <span className="text-gray-600">{stat.presentDays} present / {stat.absentDays} absent</span>
                        </div>
                      </div>
                    ))}
                    {data.employeeStatistics.length > 5 && (
                      <p className="text-sm text-gray-500">... and {data.employeeStatistics.length - 5} more employees</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );

    case 'employee-summary':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Employee Summary Preview</h3>
          {data.employees && Array.isArray(data.employees) && data.employees.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Employees</p>
                  <p className="text-2xl font-bold text-blue-600">{data.employees.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {data.employees.filter(e => e.status === 'Active').length}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Departments</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {new Set(data.employees.map(e => e.department).filter(Boolean)).size}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Avg Salary</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(
                      data.employees.reduce((sum, e) => sum + (e.salary || 0), 0) / data.employees.length || 0
                    )}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.employees.slice(0, 10).map((emp, idx) => (
                  <div key={idx} className="border border-gray-200 rounded p-3 text-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-gray-500 ml-2">({emp.employeeId || emp.id})</span>
                        {emp.department && (
                          <span className="text-gray-500 ml-2">• {emp.department}</span>
                        )}
                      </div>
                      <div className="text-right">
                        {emp.salary && (
                          <span className="font-medium">{formatCurrency(emp.salary)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {data.employees.length > 10 && (
                  <p className="text-sm text-gray-500">... and {data.employees.length - 10} more employees</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-600">No employee data found</p>
          )}
        </div>
      );

    case 'department':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Department Report Preview</h3>
          {data.departments && Array.isArray(data.departments) && data.departments.length > 0 ? (
            <div className="space-y-4">
              {data.departments.map((dept, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold">{dept.name || 'Department'}</h4>
                      <p className="text-sm text-gray-600">{dept.totalEmployees || 0} employees</p>
                    </div>
                    {dept.averageSalary && (
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Avg Salary</p>
                        <p className="font-semibold">{formatCurrency(dept.averageSalary)}</p>
                      </div>
                    )}
                  </div>
                  {dept.employees && dept.employees.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Sample employees:</p>
                      <div className="flex flex-wrap gap-2">
                        {dept.employees.slice(0, 5).map((emp, empIdx) => (
                          <span key={empIdx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {emp.name}
                          </span>
                        ))}
                        {dept.employees.length > 5 && (
                          <span className="text-xs text-gray-500">+{dept.employees.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No department data found</p>
          )}
        </div>
      );

    default:
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-600">Preview not available for this report type. Please generate the report to view.</p>
          </div>
        </div>
      );
  }
}

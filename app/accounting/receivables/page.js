"use client";
import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  X,
  ChevronDown as ChevronDownIcon
} from "lucide-react";
import { getPermission } from "@/lib/permissions";
import UniversalDateRangeFilter from "@/components/UniversalDateRangeFilter";
import { calculateDateRange } from "@/lib/dateUtils";
import InvoiceTemplatePreview from "@/components/InvoiceTemplatePreview";
import InvoiceTemplateCapture from '@/components/InvoiceTemplateCapture';
import { getInvoiceById } from "@/app/services/invoiceService";
import { downloadInvoiceAsImage } from '@/lib/invoiceCapture';
import ClickableStatCard from '@/components/ui/ClickableStatCard';

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MWK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('MWK', 'MWK');
};

// Format date (DD-MM-YYYY)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    return 'N/A';
  }
};

// Skeleton element
const SkeletonElement = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

const AccountsReceivable = () => {
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [customDateRange, setCustomDateRange] = useState(null);
  const [receivables, setReceivables] = useState(null);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canViewReceivables: false
  });
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState("dueDate");
  const [sortDirection, setSortDirection] = useState("asc");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [invoiceForPreview, setInvoiceForPreview] = useState(null);
  const [brandingSettings, setBrandingSettings] = useState(null);
  const [invoiceTemplates, setInvoiceTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [captureInvoiceData, setCaptureInvoiceData] = useState(null);
  const [isCapturingPdf, setIsCapturingPdf] = useState(false);
  const [captureInvoiceType, setCaptureInvoiceType] = useState("capture");

  useEffect(() => {
    const fetchPermissions = async () => {
      setPermissionsLoading(true);
      // Temporarily allow access while permissions are being set up
      const canViewReceivables = true; // await getPermission("receivables.view");
      setPagePermissions({
        canViewReceivables
      });
      setPermissionsLoading(false);
    };
  
    fetchPermissions();
  }, []);

  // Get current date range based on timeframe and custom range
  const getCurrentDateRange = () => {
    if (timeframe === 'custom' && customDateRange) {
      return customDateRange;
    }
    const range = calculateDateRange(timeframe);
    return {
      startDate: range.startDate.toISOString().split('T')[0],
      endDate: range.endDate.toISOString().split('T')[0]
    };
  };

  // Fetch receivables data
  useEffect(() => {
    const fetchReceivablesData = async () => {
      setIsLoading(true);
      setError(null);
      
      const dateRange = getCurrentDateRange();
      
      try {
        const params = new URLSearchParams();
        // Always send the selected period as a concrete range so filters like "Today"
        // reliably show invoices issued within that period.
        params.set('dateRange', 'custom');
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);

        const response = await fetch(`/api/dashboard/receivables?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch receivables data');
        }
        
        const data = await response.json();
        setReceivables(data.accountsReceivable || data);
        setOutstandingInvoices(data.invoices || []);
        
      } catch (err) {
        console.error("Error fetching receivables data:", err);
        setError("Failed to load receivables data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReceivablesData();
  }, [timeframe, customDateRange]);

  // Fetch branding settings and templates
  useEffect(() => {
    const fetchBrandingAndTemplates = async () => {
      try {
        // Fetch branding settings from tenant settings
        const brandingResponse = await fetch('/api/tenant/settings');
        if (brandingResponse.ok) {
          const brandingData = await brandingResponse.json();
          setBrandingSettings(brandingData);
        }

        // Fetch invoice templates
        const templatesResponse = await fetch('/api/invoice/templates');
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          setInvoiceTemplates(templatesData.templates || []);
          // Set default template
          const defaultTemplate = templatesData.templates?.find(t => t.isDefault) || templatesData.templates?.[0];
          setSelectedTemplate(defaultTemplate);
        }
      } catch (error) {
        console.error('Error fetching branding/templates:', error);
      }
    };

    fetchBrandingAndTemplates();
  }, []);

  // Handle view invoice
  const handleViewInvoice = async (invoiceId) => {
    setIsLoadingInvoice(true);
    try {
      const invoice = await getInvoiceById(invoiceId);
      setInvoiceForPreview(invoice);
      setPreviewModalOpen(true);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      alert('Failed to load invoice details');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  // Handle download invoice
  const handleDownload = async (invoiceId) => {
    try {
      setIsCapturingPdf(true);
      setCaptureInvoiceType("capture");
      
      // Fetch the invoice data
      const data = await downloadInvoiceAsImage(invoiceId, selectedTemplate?.id);
      
      // Set the data in state to trigger the InvoiceTemplateCapture component
      setCaptureInvoiceData(data);
      
      // Success message will be shown after the PDF is generated
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Failed to download invoice. Please try again.');
      setIsCapturingPdf(false);
    }
  };

  // Handle capture success
  const handleCaptureSuccess = () => {
    console.log('Invoice captured successfully');
    setIsCapturingPdf(false);
    setCaptureInvoiceData(null);
  };

  // Handle capture error
  const handleCaptureError = (error) => {
    console.error('Error capturing invoice:', error);
    alert('Failed to capture invoice. Please try again.');
    setIsCapturingPdf(false);
    setCaptureInvoiceData(null);
  };

  // Handle export
  const handleExport = async () => {
    try {
      // Build query parameters based on current filters
      const queryParams = new URLSearchParams();
      
      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }
      
      if (statusFilter && statusFilter !== 'All') {
        queryParams.append('statusFilter', statusFilter);
      }

      const queryString = queryParams.toString();
      const url = `/api/receivables/export${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to export receivables');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `accounts_receivable_export_${new Date().toISOString().split('T')[0]}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].trim();
          // Ensure it ends with .csv
          if (!filename.endsWith('.csv')) {
            filename = filename.replace(/\.csv_?$/, '') + '.csv';
          }
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting receivables:', error);
      alert('Failed to export receivables. Please try again.');
    }
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
    if (newTimeframe !== 'custom') {
      setCustomDateRange(null);
    }
  };

  // Handle custom date range change
  const handleCustomDateChange = (range) => {
    setCustomDateRange(range);
  };

  // Handle refresh
  const handleRefresh = () => {
    const fetchReceivablesData = async () => {
      setIsLoading(true);
      setError(null);
      
      const dateRange = getCurrentDateRange();
      
      try {
        const params = new URLSearchParams();
        params.set('dateRange', 'custom');
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);

        const response = await fetch(`/api/dashboard/receivables?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch receivables data');
        }
        
        const data = await response.json();
        setReceivables(data.accountsReceivable || data);
        setOutstandingInvoices(data.invoices || []);
        
      } catch (err) {
        console.error("Error refreshing receivables data:", err);
        setError("Failed to refresh receivables data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReceivablesData();
  };

  // Error state
  if (error) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Error Loading Receivables</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (permissionsLoading) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <DollarSign className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Loading Permissions</h2>
          <p className="text-gray-600">Checking user permissions...</p>
        </div>
      </div>
    );
  }

  if (!pagePermissions.canViewReceivables) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Accounts Receivable</h1>
          <p className="text-gray-600 mt-1">
            Manage and track outstanding invoices and customer payments
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <UniversalDateRangeFilter
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onCustomDateChange={handleCustomDateChange}
            onRefresh={handleRefresh}
            loading={isLoading}
            showRefresh={true}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <ClickableStatCard
          label="Total Receivables"
          value={receivables?.current !== undefined ? formatCurrency(receivables.current) : '—'}
          icon={DollarSign}
          active={statusFilter === 'All'}
          onClick={() => setStatusFilter('All')}
          valueClassName="text-blue-700"
          iconWrapClassName="bg-blue-100 text-blue-600"
          barClassName="from-blue-400 via-indigo-500 to-blue-600"
        />
        <ClickableStatCard
          label="Not Due"
          value={receivables?.notDue !== undefined ? formatCurrency(receivables.notDue) : '—'}
          icon={CheckCircle2}
          active={statusFilter === 'Not Due'}
          onClick={() => setStatusFilter((prev) => (prev === 'Not Due' ? 'All' : 'Not Due'))}
          valueClassName="text-green-700"
          iconWrapClassName="bg-green-100 text-green-600"
          barClassName="from-emerald-400 via-green-500 to-teal-500"
        />
        <ClickableStatCard
          label="Overdue"
          value={receivables?.overdue !== undefined ? formatCurrency(receivables.overdue) : '—'}
          icon={AlertCircle}
          active={statusFilter === 'Overdue'}
          onClick={() => setStatusFilter((prev) => (prev === 'Overdue' ? 'All' : 'Overdue'))}
          valueClassName="text-red-700"
          iconWrapClassName="bg-red-100 text-red-600"
          barClassName="from-red-400 via-rose-500 to-red-600"
        />
        <ClickableStatCard
          label="Active Customers"
          value={receivables?.aging ? receivables.aging.length : '—'}
          icon={Users}
          active={false}
          onClick={() => setStatusFilter('All')}
          title="Show all receivables"
          iconWrapClassName="bg-blue-100 text-blue-600"
          barClassName="from-blue-400 via-sky-500 to-indigo-500"
        />
      </div>

      {/* Aging Summary */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Aging Summary</h2>
        </div>
        <div className="p-5">
          {receivables?.aging ? (
            <div className="space-y-4">
              {receivables.aging.map((period, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-32 text-sm font-medium text-gray-700">{period.range}</div>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          index > 2 ? 'bg-red-500' : index > 1 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(period.amount / (receivables?.current || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="min-w-[7rem] max-w-[40%] shrink-0 text-right">
                    <div className="break-words text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(period.amount)}</div>
                    <div className="text-xs text-gray-500">
                      {((period.amount / (receivables?.current || 1)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-32"><SkeletonElement className="h-4 w-24" /></div>
                  <div className="flex-1 mx-4"><SkeletonElement className="h-3 w-full" /></div>
                  <div className="w-32 text-right"><SkeletonElement className="h-5 w-20 ml-auto" /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search invoices, customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
                <option value="Not Due">Not Due</option>
              </select>
              <button 
                onClick={handleExport}
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Receivables Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Outstanding Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-5">
              <div className="space-y-3">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <SkeletonElement className="h-4 w-24" />
                    <SkeletonElement className="h-4 w-32" />
                    <SkeletonElement className="h-4 w-24" />
                    <SkeletonElement className="h-4 w-24" />
                    <SkeletonElement className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ) : outstandingInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Outstanding Invoices</h3>
              <p className="text-gray-600">All invoices have been paid or there are no unpaid invoices.</p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {outstandingInvoices
                  .filter(invoice => {
                    // Apply search filter
                    if (searchTerm) {
                      const searchLower = searchTerm.toLowerCase();
                      return (
                        invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
                        invoice.clientName.toLowerCase().includes(searchLower) ||
                        (invoice.clientEmail && invoice.clientEmail.toLowerCase().includes(searchLower))
                      );
                    }
                    return true;
                  })
                  .filter(invoice => {
                    // Apply status filter
                    if (statusFilter === "All") return true;
                    if (statusFilter === "Pending") return invoice.status === "Pending" || invoice.originalStatus === "Pending";
                    if (statusFilter === "Overdue") return invoice.status === "Overdue";
                    if (statusFilter === "Not Due") return invoice.status === "Not Due";
                    return true;
                  })
                  .map((invoice) => {
                    const getStatusBadge = () => {
                      if (invoice.status === "Overdue") {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Overdue ({invoice.daysPastDue} days)
                          </span>
                        );
                      } else if (invoice.status === "Not Due") {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Not Due
                          </span>
                        );
                      } else if (invoice.originalStatus === "Partial") {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="mr-1 h-3 w-3" />
                            Partial
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </span>
                        );
                      }
                    };

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.clientName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invoice.issueDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                          {formatCurrency(invoice.totalPaid)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(invoice.amountOwed)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {getStatusBadge()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleViewInvoice(invoice.id)}
                            disabled={isLoadingInvoice}
                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {previewModalOpen && invoiceForPreview && brandingSettings && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Invoice Details</h2>
              <div className="flex items-center space-x-3">
                {invoiceTemplates.length > 0 && (
                  <div className="relative">
                    <select
                      className="px-3 py-2 border border-gray-200 rounded-md bg-white text-sm appearance-none pr-8"
                      value={selectedTemplate?.id || ""}
                      onChange={(e) => {
                        const selected = invoiceTemplates.find(t => t.id === e.target.value);
                        setSelectedTemplate(selected || null);
                      }}
                    >
                      {invoiceTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} {template.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDownIcon size={16} className="text-gray-500" />
                    </div>
                  </div>
                )}
                <button
                  className="px-3 py-2 bg-blue-600 text-white rounded-md flex items-center text-sm hover:bg-blue-700"
                  onClick={() => handleDownload(invoiceForPreview.id)}
                >
                  <Download size={16} className="mr-2" />
                  Download
                </button>
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setPreviewModalOpen(false)}
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <InvoiceTemplatePreview
                template={selectedTemplate}
                branding={brandingSettings}
                invoice={invoiceForPreview}
                isPrint={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Invoice Template Capture Component for PDF generation */}
      {captureInvoiceData && (
        <InvoiceTemplateCapture
          invoice={captureInvoiceData.invoice}
          template={captureInvoiceData.template}
          branding={captureInvoiceData.branding}
          type={captureInvoiceType}
          onSuccess={handleCaptureSuccess}
          onError={handleCaptureError}
        />
      )}

      {/* Loading overlay while preparing invoice for download */}
      {isCapturingPdf && !captureInvoiceData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <p>Preparing invoice for download...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsReceivable; 
"use client";

import { useState, useEffect, useRef } from "react";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  ChevronDown,
  Send,
  Printer,
  Edit,
  Trash2,
  X,
  CreditCard,
  FileText,
  Calendar,
  Eye,
  Ban,
  RotateCcw
} from "lucide-react";
import { downloadInvoiceAsImage } from '@/lib/invoiceCapture';
import SendInvoiceModal from '@/components/SendInvoiceModal';
import InvoiceModal from "@/components/InvoiceModal";
import InvoiceTemplatePreview from "@/components/InvoiceTemplatePreview";
import InvoiceTemplateCapture from '@/components/InvoiceTemplateCapture';
import VoidInvoiceModal from "@/components/VoidInvoiceModal";
import RefundInvoiceModal from "@/components/RefundInvoiceModal";
import PartialPaymentModal from "@/components/PartialPaymentModal";
import PaymentHistory from "@/components/PaymentHistory";
import { 
  fetchInvoices, 
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  getInvoiceStatistics,
  exportInvoices,
  downloadInvoice,
  getInvoiceById
} from "@/app/services/invoiceService";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

const InvoicingPage = () => {
  // State management
  const [activeTab, setActiveTab] = useState("all");
  const [invoices, setInvoices] = useState([]);
  const [statistics, setStatistics] = useState({
    paid: { count: 0, amount: '0' },
    pending: { count: 0, amount: '0' },
    overdue: { count: 0, amount: '0' },
    partial: { count: 0, amount: '0' },
    draft: { count: 0, amount: '0' },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [sortBy, setSortBy] = useState("date"); // Frontend uses "date" but API uses "issueDate"
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    client: ""
  });
  const [clients, setClients] = useState([]);
  const [captureInvoiceData, setCaptureInvoiceData] = useState(null);
  const [isCapturingPdf, setIsCapturingPdf] = useState(false);
  const [captureInvoiceType, setCaptureInvoiceType] = useState("capture");
  const [isSendingInvoice, setIsSendingInvoice] = useState(false); // Add flag to prevent duplicate sends
  const [customMessage, setCustomMessage] = useState(""); // Add state for custom message
  // Invoice modal states
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState("create");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Void and Refund modal states
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedInvoiceForAction, setSelectedInvoiceForAction] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  // Template related states
  const [invoiceTemplates, setInvoiceTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [brandingSettings, setBrandingSettings] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [invoiceForPreview, setInvoiceForPreview] = useState(null);
  
  // Filter and sort refs for click outside handling
  const filterRef = useRef(null);
  const sortRef = useRef(null);
  const [sendInvoiceModalOpen, setSendInvoiceModalOpen] = useState(false);
const [selectedInvoiceForSending, setSelectedInvoiceForSending] = useState(null);
const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Partial payment modal states
  const [partialPaymentModalOpen, setPartialPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
const [pagePermissions, setPagePermissions] = useState({ 
  canSendInvoices: false,
  canCreateInvoices: false,
  canDeleteInvoices:false, 
  canExportInvoices:false, 
  canMarkAsPaid:false, 
  canUpdateInvoices:false, 
});      
 
useEffect(() => {
  const fetchPermissions = async () => { 
    const canSendInvoices = await getPermission("invoices.send");
    const canCreateInvoices = await getPermission("invoices.create");
    const canDeleteInvoices = await getPermission("invoices.delete");
    const canExportInvoices = await getPermission("invoices.export"); 
    const canMarkAsPaid = await getPermission("invoices.markAsPaid");
    const canUpdateInvoices = await getPermission("invoices.update"); 

    setPagePermissions({ 
      canSendInvoices,
      canCreateInvoices,
      canDeleteInvoices, 
      canExportInvoices, 
      canMarkAsPaid, 
      canUpdateInvoices,   
      });
  };

  fetchPermissions();
}, []);
// Update the handleSendInvoice function
const handleSendInvoice = (invoice) => {
  console.log('🚀 handleSendInvoice called for invoice:', invoice.id);
  
  // Prevent duplicate sends
  if (isCapturingPdf) {
    console.log('⏳ Already capturing PDF, skipping...');
    return;
  }
  
  setSelectedInvoiceForSending(invoice);
  setCustomMessage(""); // Reset custom message
  setSendInvoiceModalOpen(true);
  
  // Start the PDF capture process directly
  (async () => {
    try {
      console.log('📧 Starting PDF capture for invoice:', invoice.id);
      setIsCapturingPdf(true);
      // Fetch the invoice data
      const data = await downloadInvoiceAsImage(invoice.id, selectedTemplate?.id);
      // Set the data in state to trigger the InvoiceTemplateCapture component
      setCaptureInvoiceData(data);
      setCaptureInvoiceType("save");
      console.log('✅ PDF capture data set for invoice:', invoice.id);
    } catch (error) {
      console.error("Error starting invoice send process:", error);
      alert("Failed to start invoice send process: " + error.message);
      setIsCapturingPdf(false);
    }
  })();
};

  // Handle custom message from modal
  const handleMessageSubmit = (message) => {
    setCustomMessage(message);
  };

  // Handle void invoice
  const handleVoidInvoice = async (invoiceId, reason) => {
    try {
      setIsProcessingAction(true);
      const response = await fetch('/api/invoices/void', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId, reason }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to void invoice');
      }

      // Refresh invoices list
      await loadInvoices();
      setSuccessMessage('Invoice voided successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error voiding invoice:', error);
      throw error;
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle refund invoice
  const handleRefundInvoice = async (invoiceId, refundAmount, refundReason, refundMethod, notes) => {
    try {
      setIsProcessingAction(true);
      const response = await fetch('/api/invoices/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          invoiceId, 
          refundAmount, 
          refundReason, 
          refundMethod, 
          notes 
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to process refund');
      }

      // Refresh invoices list
      await loadInvoices();
      setSuccessMessage('Refund processed successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle partial payment
  const handlePartialPayment = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPartialPaymentModalOpen(true);
  };

  // Handle payment success
  const handlePaymentSuccess = (data) => {
    // Refresh invoices list to show updated payment status
    loadInvoices();
    setSuccessMessage('Payment processed successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Toggle payment history
  const togglePaymentHistory = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setShowPaymentHistory(!showPaymentHistory);
  };

  // Helper function to check if invoice is eligible for partial payment
  const isEligibleForPartialPayment = (invoice) => {
    const status = invoice.status?.toLowerCase();
    return status === 'pending' || status === 'partial';
  };

  // Open void modal
  const openVoidModal = (invoice) => {
    setSelectedInvoiceForAction(invoice);
    setVoidModalOpen(true);
  };

  // Open refund modal
  const openRefundModal = (invoice) => {
    setSelectedInvoiceForAction(invoice);
    setRefundModalOpen(true);
  };
async function waitForFile(id,type, maxRetries = 10, interval = 1000) {
  console.log(`🔍 Starting waitForFile for ${type} ${id}`);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`🔍 Attempt ${attempt + 1}/${maxRetries} - checking for file...`);
    const res = await fetch(`/api/invoices/upload?id=${id}&type=${type}`);
    const result = await res.json();
    console.log(`🔍 File check result:`, result);

    if (result.exists) {
      console.log(`✅ File found on attempt ${attempt + 1}`);
      return true;
    }

    console.log(`⏳ File not found, waiting ${interval}ms before next attempt...`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  console.error(`❌ File not available after ${maxRetries} attempts`);
  throw new Error('File not available after waiting');
}
// Client-side function to send HTML invoice
const sendInvoiceWithMessage = async (customMessage) => {
  if (!selectedInvoiceForSending) return;
  try {
    setIsCapturingPdf(true);  
    // Fetch the invoice data
    const data = await downloadInvoiceAsImage(selectedInvoiceForSending.id, selectedTemplate?.id);
    // Set the data in state to trigger the InvoiceTemplateCapture component
    setCaptureInvoiceData(data);
    setCaptureInvoiceType("save");
    setIsSendingEmail(true);
    // Note: The file waiting and email sending now happen in handleCaptureSuccess
  } catch (error) {
    console.error("Error sending invoice:", error);
    alert("Failed to send invoice: " + error.message);
    setIsCapturingPdf(false);
  } finally {
    setIsSendingEmail(false);
    setIsCapturingPdf(false);
  }
};
  // Load invoices, statistics, and templates on initial render
  useEffect(() => {
    loadInvoices();
    loadStatistics();
    loadClients();
    loadTemplates();
    loadBrandingSettings();
  }, [activeTab, pagination.page, sortBy, sortOrder]);
  
  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setSortOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Handle search query changes with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      loadInvoices();
    }, 500);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);
  
  // Clear success message after timeout
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);
  
  // Load invoice data from the API
  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Map the active tab to the status filter
      let statusFilter = null;
      if (activeTab === 'draft') statusFilter = 'Draft';
      if (activeTab === 'pending') statusFilter = 'Pending';
      if (activeTab === 'paid') statusFilter = 'Paid';
      if (activeTab === 'overdue') statusFilter = 'Overdue';
      
      // Build query params
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: getApiSortField(sortBy), // Use the mapping function
        sortOrder: sortOrder,
        status: statusFilter,
        client: filterOptions.client || null,
        search: searchQuery || null,
        dateFrom: filterOptions.dateFrom || null,
        dateTo: filterOptions.dateTo || null
      };
      
      const response = await fetchInvoices(params);
      
      setInvoices(response.invoices);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Error loading invoices:", error);
      setError("Failed to load invoices. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load statistics data from the API
  const loadStatistics = async () => {
    try {
      const stats = await getInvoiceStatistics({
        dateFrom: filterOptions.dateFrom,
        dateTo: filterOptions.dateTo
      });
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
      // Don't set error state for statistics, just log it
    }
  };
  
  // Load client data for filtering
  const loadClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  // Load available invoice templates
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/invoice/templates');
      if (response.ok) {
        const data = await response.json();
        setInvoiceTemplates(data.templates || []);
        
        // Set the default template
        const defaultTemplate = data.templates?.find(t => t.isDefault) || data.templates?.[0];
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate);
        }
      }
    } catch (error) {
      console.error("Error loading invoice templates:", error);
    }
  };
  
  // Load branding settings
  const loadBrandingSettings = async () => {
    try {
      const response = await fetch('/api/tenant/settings');
      if (response.ok) {
        const data = await response.json();
        setBrandingSettings(data);
      }
    } catch (error) {
      console.error("Error loading branding settings:", error);
    }
  };
  
  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination({
      ...pagination,
      page: newPage
    });
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };
  
  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilterOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Apply filters
  const applyFilters = () => {
    setFilterOpen(false);
    loadInvoices();
    loadStatistics();
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilterOptions({
      status: "all",
      dateFrom: "",
      dateTo: "",
      client: ""
    });
    setFilterOpen(false);
    loadInvoices();
    loadStatistics();
  };
  
  // Handle sort change
  const handleSortChange = (field) => {
    setSortOpen(false);
    if (sortBy === field) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to descending
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  // Map frontend field names to API field names
  const getApiSortField = (field) => {
    const fieldMapping = {
      'date': 'issueDate',
      'dueDate': 'dueDate',
      'clientName': 'clientName',
      'total': 'total',
      'status': 'status'
    };
    
    return fieldMapping[field] || field;
  };
  
  // Handle export
  const handleExport = async (format = 'csv') => {
    try {
      // Create filter object based on current filters
      const filters = {
        status: activeTab === 'all' ? null : activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
        client: filterOptions.client || null,
        search: searchQuery || null,
        dateFrom: filterOptions.dateFrom || null,
        dateTo: filterOptions.dateTo || null
      };
      
      const blob = await exportInvoices(filters, format);
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage("Export successful!");
    } catch (error) {
      console.error("Error exporting invoices:", error);
      alert("Failed to export invoices. Please try again.");
    }
  };
  
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
      console.error("Error downloading invoice:", error);
      alert("Failed to download invoice. Please try again.");
      setIsCapturingPdf(false);
    }
  };
  
  // Add handler functions for the capture component
  const handleCaptureSuccess = () => {
    console.log('🎯 handleCaptureSuccess called with type:', captureInvoiceType);
    
    if(captureInvoiceType==="save"){
      // Prevent duplicate sends
      if (isSendingInvoice) {
        console.log('❌ Invoice send already in progress, skipping...');
        return;
      }
      
      console.log('✅ Starting invoice send process...');
      setIsSendingInvoice(true);
      
      // For sending invoices, wait for the file and then send the email
      (async () => {
        try {
          const invoiceId = captureInvoiceData?.invoice?.id;
          console.log('📧 Invoice ID for sending:', invoiceId);
          
          if (invoiceId) {
            console.log('⏳ Waiting for file to be available...');
            await waitForFile(invoiceId, "invoice");
            console.log('✅ File is available, sending email...');
            
            // Send the invoice email
            const response = await fetch(`/api/invoices/${invoiceId}/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: customMessage || "", // Use customMessage from state
                templateId: selectedTemplate?.id
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to send invoice');
            }
            
            const result = await response.json();
            console.log('📧 Email sent successfully:', result);
            
            // Close modal
            setSendInvoiceModalOpen(false);
            
            // Show success message
            setSuccessMessage(`Invoice sent successfully to ${captureInvoiceData.invoice.client.email}`);
            
            // If status was updated (e.g., from Draft to Pending), refresh the invoice list
            if (result.statusUpdated) {
              loadInvoices();
            }
          } else {
            console.error('❌ No invoice ID found in capture data');
          }
        } catch (error) {
          console.error("Error in post-capture process:", error);
          alert("PDF generated but failed to send invoice. Please try again.");
        } finally {
          console.log('🧹 Cleaning up invoice send state...');
          setIsSendingInvoice(false);
        }
      })();
    } else {
      console.log('📥 Download mode, showing success message');
      setSuccessMessage("Invoice downloaded successfully!");
    }
    // Delayed cleanup to ensure component stays mounted during the entire process
    setTimeout(() => {
      console.log('🧹 Final cleanup - clearing capture data...');
      setCaptureInvoiceData(null);
      setIsCapturingPdf(false);
    }, 1000);
  };
  
  const handleCaptureError = (error) => {
    console.error("Error capturing invoice:", error);
    alert("Failed to generate invoice PDF. Please try again.");
    setCaptureInvoiceData(null);
    setIsCapturingPdf(false);
  };
  
  // Handle preview invoice
  const handlePreviewInvoice = async (invoice) => {
    try {
      // If we already have the full invoice details
      if (invoice.items) {
        setInvoiceForPreview(invoice);
        setPreviewModalOpen(true);
        return;
      }
      
      // Otherwise fetch the full invoice data
      const fullInvoice = await getInvoiceById(invoice.id);
      setInvoiceForPreview(fullInvoice);
      setPreviewModalOpen(true);
    } catch (error) {
      console.error("Error previewing invoice:", error);
      alert("Failed to preview invoice. Please try again.");
    }
  };
  

  
  // Handle delete invoice
  const handleDeleteInvoice = async (invoiceId) => {
    try {
      if (!confirm("Are you sure you want to delete this invoice?")) {
        return;
      }
      
      await deleteInvoice(invoiceId);
      
      // Remove from state
      setInvoices(invoices.filter(inv => inv.id !== invoiceId));
      
      // Show success message
      setSuccessMessage("Invoice deleted successfully!");
      
      // Refresh statistics
      loadStatistics();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Failed to delete invoice. Please try again.");
    }
  };
  
  // Open invoice modal for creation
  const openCreateInvoiceModal = () => {
    setSelectedInvoice(null);
    setInvoiceModalMode("create");
    setInvoiceModalOpen(true);
  };
  
  // Open invoice modal for editing
  const openEditInvoiceModal = (invoice) => {
    setSelectedInvoice(invoice);
    setInvoiceModalMode("edit");
    setInvoiceModalOpen(true);
  };
  
  // Handle invoice form submission
  const handleInvoiceSubmit = async (formData) => {
    try {
      // Add selected template to the form data
      const dataWithTemplate = {
        ...formData,
        templateId: selectedTemplate?.id
      };
      let result;
      if (invoiceModalMode === "create") {
        // Create new invoice
        result = await createInvoice(dataWithTemplate);
        // Add to invoices list if on the first page or matching current filter
        if (pagination.page === 1 || 
            (activeTab === "all" || 
             activeTab === result.invoice.status.toLowerCase())) {
          setInvoices([result.invoice, ...invoices]);
        }
        setSuccessMessage("Invoice created successfully!");
      } else {
        // Update existing invoice
        result = await updateInvoice(selectedInvoice.id, dataWithTemplate);
        // Update invoice in the list
        setInvoices(invoices.map(inv => 
          inv.id === result.invoice.id ? result.invoice : inv
        ));
        setSuccessMessage("Invoice updated successfully!");
      }
      setInvoiceModalOpen(false);
      loadStatistics();
      // Return the created/updated invoice object for the modal
      return result.invoice;
    } catch (error) {
      console.error("Error submitting invoice:", error);
      alert("Failed to save invoice. Please try again.");
      return undefined;
    }
  };
  
  // Status badge component
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "Paid":
        badgeClass = "bg-green-100 text-green-800";
        icon = <CheckCircle size={14} className="mr-1" />;
        break;
      case "Pending":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <Clock size={14} className="mr-1" />;
        break;
      case "Overdue":
        badgeClass = "bg-red-100 text-red-800";
        icon = <AlertCircle size={14} className="mr-1" />;
        break;
      case "Draft":
        badgeClass = "bg-gray-100 text-gray-800";
        icon = <Edit size={14} className="mr-1" />;
        break;
      case "void":
        badgeClass = "bg-red-100 text-red-800";
        icon = <Ban size={14} className="mr-1" />;
        break;
      case "refunded":
        badgeClass = "bg-gray-100 text-gray-800";
        icon = <RotateCcw size={14} className="mr-1" />;
        break;
      case "partially_refunded":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <RotateCcw size={14} className="mr-1" />;
        break;
      case "partial":
        badgeClass = "bg-blue-100 text-blue-800";
        icon = <CreditCard size={14} className="mr-1" />;
        break;
      default:
        badgeClass = "bg-gray-100 text-gray-800";
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center ${badgeClass}`}>
        {icon}
        {status}
      </span>
    );
  };

  return (
    <PermissionGuard permission="invoices.view">   
    <div className="p-4 sm:p-6">
      {/* Success notification */}
      {successMessage && (
        <div className="fixed top-6 right-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50 flex items-center animate-fadeIn max-w-md">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <div className="mr-2 flex-grow">
            <p className="font-medium">{successMessage}</p>
          </div>
          <button 
            className="text-green-700 hover:text-green-800 flex-shrink-0"
            onClick={() => setSuccessMessage(null)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Invoicing</h1>
        <div className="flex flex-wrap gap-2">
          {/* Template selector dropdown */}
          <div className="relative">
            <select
              className="px-3 py-2 border border-gray-200 rounded-md bg-white text-sm appearance-none pr-8"
              value={selectedTemplate?.id || ""}
              onChange={(e) => {
                const selected = invoiceTemplates.find(t => t.id === e.target.value);
                setSelectedTemplate(selected || null);
              }}
            >
              <option value="" disabled>Select Template</option>
              {invoiceTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <ChevronDown size={16} className="text-gray-500" />
            </div>
          </div>
          
          {pagePermissions.canCreateInvoices &&(  <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            onClick={openCreateInvoiceModal}
          >
            <PlusCircle size={16} className="mr-2" />
            New Invoice
          </button>)}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex p-2 sm:p-4 border-b border-gray-200 overflow-x-auto">
          <button 
            className={`px-3 py-2 rounded-md mr-2 text-sm ${activeTab === "all" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("all")}
          >
            All
          </button>
          <button 
            className={`px-3 py-2 rounded-md mr-2 text-sm ${activeTab === "draft" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("draft")}
          >
            Drafts
          </button>
          <button 
            className={`px-3 py-2 rounded-md mr-2 text-sm ${activeTab === "pending" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending
          </button>
          <button 
            className={`px-3 py-2 rounded-md mr-2 text-sm ${activeTab === "paid" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("paid")}
          >
            Paid
          </button>
          <button 
            className={`px-3 py-2 rounded-md mr-2 text-sm ${activeTab === "overdue" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("overdue")}
          >
            Overdue
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4">
          <div className="w-full md:w-1/3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search invoices..." 
                className="w-full p-2 pl-10 border border-gray-200 rounded-md"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <Search size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="relative" ref={filterRef}>
              <button 
                className="px-3 py-2 border border-gray-200 rounded-md bg-white flex items-center text-sm"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Filter size={16} className="mr-2 text-gray-500" />
                <span className="text-gray-700">Filter</span>
                <ChevronDown size={16} className="ml-2 text-gray-500" />
              </button>
              
              {filterOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-10 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">Filter Invoices</h3>
                    <button 
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setFilterOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select 
                      className="w-full p-2 border border-gray-200 rounded-md"
                      value={filterOptions.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                    <select 
                      className="w-full p-2 border border-gray-200 rounded-md"
                      value={filterOptions.client}
                      onChange={(e) => handleFilterChange('client', e.target.value)}
                    >
                      <option value="">All Clients</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                      <input 
                        type="date"
                        className="w-full p-2 border border-gray-200 rounded-md"
                        value={filterOptions.dateFrom}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                      <input 
                        type="date"
                        className="w-full p-2 border border-gray-200 rounded-md"
                        value={filterOptions.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <button 
                      className="px-3 py-2 text-gray-500 border border-gray-200 rounded-md text-sm"
                      onClick={resetFilters}
                    >
                      Reset
                    </button>
                    <button 
                      className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                      onClick={applyFilters}
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative" ref={sortRef}>
              <button 
                className="px-3 py-2 border border-gray-200 rounded-md bg-white flex items-center text-sm"
                onClick={() => setSortOpen(!sortOpen)}
              >
                <ArrowUpDown size={16} className="mr-2 text-gray-500" />
                <span className="text-gray-700">Sort</span>
                <ChevronDown size={16} className="ml-2 text-gray-500" />
              </button>
              
              {sortOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 p-2">
                  <button 
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 flex items-center justify-between ${sortBy === 'date' ? 'bg-blue-50 text-blue-600' : ''}`}
                    onClick={() => handleSortChange('date')}
                  >
                    <span>Date</span>
                    {sortBy === 'date' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                  <button 
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 flex items-center justify-between ${sortBy === 'dueDate' ? 'bg-blue-50 text-blue-600' : ''}`}
                    onClick={() => handleSortChange('dueDate')}
                  >
                    <span>Due Date</span>
                    {sortBy === 'dueDate' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                  <button 
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 flex items-center justify-between ${sortBy === 'total' ? 'bg-blue-50 text-blue-600' : ''}`}
                    onClick={() => handleSortChange('total')}
                  >
                    <span>Amount</span>
                    {sortBy === 'total' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                  <button 
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 flex items-center justify-between ${sortBy === 'clientName' ? 'bg-blue-50 text-blue-600' : ''}`}
                    onClick={() => handleSortChange('clientName')}
                  >
                    <span>Client</span>
                    {sortBy === 'clientName' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            <div>
            {pagePermissions.canExportInvoices && (<button 
                className="px-3 py-2 border border-gray-200 rounded-md bg-white flex items-center text-sm"
                onClick={() => handleExport('csv')}
              >
                <Download size={16} className="mr-2 text-gray-500" />
                <span className="text-gray-700">Export</span>
              </button>)}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-500">Loading invoices...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500">{error}</p>
            <button 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={loadInvoices}
            >
              Try Again
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No invoices found</h3>
            <p className="text-gray-500 mb-4">
              {activeTab !== "all" || searchQuery 
                ? "Try changing your filters or search query"
                : "Get started by creating your first invoice"}
            </p>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={openCreateInvoiceModal}
            >
              <PlusCircle className="w-4 h-4 mr-2 inline-block" />
              Create Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortChange('invoiceNumber')}
                  >
                    <div className="flex items-center">
                      Invoice #
                      {sortBy === 'invoiceNumber' && (
                        <ArrowUpDown size={12} className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden md:table-cell"
                    onClick={() => handleSortChange('date')}
                  >
                    <div className="flex items-center">
                      Date
                      {sortBy === 'date' && (
                        <ArrowUpDown size={12} className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden lg:table-cell"
                    onClick={() => handleSortChange('dueDate')}
                  >
                    <div className="flex items-center">
                      Due Date
                      {sortBy === 'dueDate' && (
                        <ArrowUpDown size={12} className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortChange('clientName')}
                  >
                    <div className="flex items-center">
                      Client
                      {sortBy === 'clientName' && (
                        <ArrowUpDown size={12} className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortChange('total')}
                  >
                    <div className="flex items-center justify-end">
                      Amount
                      {sortBy === 'total' && (
                        <ArrowUpDown size={12} className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Prepared By
                  </th>
                  <th 
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortChange('status')}
                  >
                    <div className="flex items-center justify-center">
                      Status
                      {sortBy === 'status' && (
                        <ArrowUpDown size={12} className="ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-blue-600">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 hidden md:table-cell">
                      {new Date(invoice.issueDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 hidden lg:table-cell">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs font-medium text-gray-900">{invoice.client.name}</div>
                      <div className="text-xs text-gray-500 md:hidden">{new Date(invoice.issueDate).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{invoice.client.email}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
                      <div className="font-medium">MWK {invoice.total.toLocaleString()}</div>
                      {invoice.totalPaid > 0 && (
                        <div className="text-green-600 text-xs">
                          Paid: MWK {invoice.totalPaid.toLocaleString()}
                        </div>
                      )}
                      {invoice.remainingBalance > 0 && (
                        <div className="text-red-600 text-xs">
                          Balance: MWK {invoice.remainingBalance.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 hidden lg:table-cell">
                      <div className="font-medium">{invoice.createdBy?.name || 'N/A'}</div>
                      <div className="text-xs">{new Date(invoice.createdAt || invoice.issueDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium">
                      <div className="flex justify-end space-x-1">
                        <button 
                          className="text-blue-500 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-md p-1"
                          title="Preview Invoice"
                          onClick={() => handlePreviewInvoice(invoice)}
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500 rounded-md p-1"
                          title="Download Invoice"
                          onClick={() => handleDownload(invoice.id)}
                        >
                          <Printer size={16} />
                        </button>
                        {invoice.status !== 'Paid' && pagePermissions.canSendInvoices &&(
                            <button 
                              className={`text-blue-500 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-md p-1 ${isCapturingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={isCapturingPdf ? "Sending invoice..." : "Send Invoice"}
                              onClick={() => handleSendInvoice(invoice)}
                              disabled={isCapturingPdf}
                            >
                              <Send size={16} />
                            </button>
                          )}
                        {invoice.status === 'Draft' && pagePermissions.canUpdateInvoices &&(
                          <button 
                            className="text-yellow-500 hover:text-yellow-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-500 rounded-md p-1"
                            title="Edit Invoice"
                            onClick={() => openEditInvoiceModal(invoice)}
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {(invoice.status === 'Draft' || invoice.status === 'Pending') && pagePermissions.canDeleteInvoices &&(
                          <button 
                            className="text-red-500 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 rounded-md p-1"
                            title="Delete Invoice"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        
                        {/* Void Invoice Button */}
                        {invoice.status !== 'void' && invoice.status !== 'refunded' && invoice.status !== 'partially_refunded' && 
                         !invoice.payments?.some(p => p.status === 'Completed') && pagePermissions.canUpdateInvoices && (
                          <button 
                            className="text-orange-500 hover:text-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500 rounded-md p-1"
                            title="Void Invoice"
                            onClick={() => openVoidModal(invoice)}
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        
                        {/* Refund Invoice Button */}
                        {invoice.status !== 'void' && invoice.status !== 'draft' && 
                         invoice.payments?.some(p => p.status === 'Completed') && pagePermissions.canUpdateInvoices && (
                          <button 
                            className="text-purple-500 hover:text-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-500 rounded-md p-1"
                            title="Process Refund"
                            onClick={() => openRefundModal(invoice)}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        
                        {/* Partial Payment Button - Only for pending and partial invoices */}
                        {isEligibleForPartialPayment(invoice) && pagePermissions.canUpdateInvoices && (
                          <button 
                            className="text-green-500 hover:text-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 rounded-md p-1"
                            title="Add Partial Payment"
                            onClick={() => handlePartialPayment(invoice)}
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                        
                        {/* Payment History Button */}
                        {invoice.payments && invoice.payments.length > 0 && (
                          <button 
                            className="text-blue-500 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-md p-1"
                            title="View Payment History"
                            onClick={() => togglePaymentHistory(invoice)}
                          >
                            <FileText size={16} />
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

        {!isLoading && !error && invoices.length > 0 && (
          <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 gap-4">
            <div className="text-sm text-gray-700 order-2 sm:order-1">
              Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> of <span className="font-medium">{pagination.totalCount}</span> invoices
            </div>
            <div className="flex space-x-2 order-1 sm:order-2">
              <button 
                className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </button>
              {pagination.totalPages <= 5 ? (
                // Show all pages if 5 or fewer
                [...Array(pagination.totalPages).keys()].map(page => (
                  <button 
                    key={page + 1}
                    className={`px-3 py-1 border border-gray-200 rounded-md bg-white text-sm ${
                      pagination.page === page + 1 ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    {page + 1}
                  </button>
                ))
              ) : (
                // Show limited pages if more than 5
                <>
                  <button 
                    className={`px-3 py-1 border border-gray-200 rounded-md bg-white text-sm ${
                      pagination.page === 1 ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => handlePageChange(1)}
                  >
                    1
                  </button>
                  
                  {pagination.page > 3 && (
                    <span className="px-2 py-1 text-gray-500">...</span>
                  )}
                  
                  {Array.from({ length: 3 }, (_, i) => {
                    let pageNum;
                    if (pagination.page <= 2) {
                      pageNum = i + 2;
                    } else if (pagination.page >= pagination.totalPages - 1) {
                      pageNum = pagination.totalPages - 3 + i;
                    } else {
                      pageNum = pagination.page - 1 + i;
                    }
                    
                    if (pageNum > 1 && pageNum < pagination.totalPages) {
                      return (
                        <button 
                          key={pageNum}
                          className={`px-3 py-1 border border-gray-200 rounded-md bg-white text-sm ${
                            pagination.page === pageNum ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    return null;
                  })}
                  
                  {pagination.page < pagination.totalPages - 2 && (
                    <span className="px-2 py-1 text-gray-500">...</span>
                  )}
                  
                  <button 
                    className={`px-3 py-1 border border-gray-200 rounded-md bg-white text-sm ${
                      pagination.page === pagination.totalPages ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => handlePageChange(pagination.totalPages)}
                  >
                    {pagination.totalPages}
                  </button>
                </>
              )}
              
              <button 
                className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={pagination.page === pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-green-100 p-3 mr-4">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div>
              <div className="text-lg font-bold">MWK {statistics.paid?.amount || '0'}</div>
              <div className="text-sm text-gray-500">Paid Invoices</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.paid?.count || '0'} invoices paid
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-yellow-100 p-3 mr-4">
              <Clock size={24} className="text-yellow-600" />
            </div>
            <div>
              <div className="text-lg font-bold">MWK {statistics.pending?.amount || '0'}</div>
              <div className="text-sm text-gray-500">Pending Invoices</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.pending?.count || '0'} invoices pending payment
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-red-100 p-3 mr-4">
              <AlertCircle size={24} className="text-red-600" />
            </div>
            <div>
              <div className="text-lg font-bold">MWK {statistics.overdue?.amount || '0'}</div>
              <div className="text-sm text-gray-500">Overdue Invoices</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.overdue?.count || '0'} invoices overdue
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-blue-100 p-3 mr-4">
              <CreditCard size={24} className="text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-bold">MWK {statistics.partial?.amount || '0'}</div>
              <div className="text-sm text-gray-500">Partial Invoices</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.partial?.count || '0'} invoices with partial payment
          </div>
        </div>
      </div>

      {/* Invoice Modal for create/edit */}
      {invoiceModalOpen && (
        <InvoiceModal
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          mode={invoiceModalMode}
          invoice={selectedInvoice}
          onSubmit={handleInvoiceSubmit}
          // Pass available templates and selected template
          templates={invoiceTemplates}
          selectedTemplate={selectedTemplate}
          onTemplateChange={setSelectedTemplate}
          onMessageSubmit={handleMessageSubmit}
        />
      )}

      {/* Invoice Preview Modal */}
      {previewModalOpen && invoiceForPreview && brandingSettings && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Invoice Preview</h2>
              <div className="flex items-center space-x-3">
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
                    <ChevronDown size={16} className="text-gray-500" />
                  </div>
                </div>
                <button
                  className="px-3 py-2 bg-blue-600 text-white rounded-md flex items-center text-sm"
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
      <SendInvoiceModal
        isOpen={sendInvoiceModalOpen}
        onClose={() => setSendInvoiceModalOpen(false)}
        invoice={selectedInvoiceForSending}
        isSending={isSendingEmail}
        companyName={brandingSettings?.companyName || 'InsightBooks'}
        onMessageSubmit={handleMessageSubmit}
      />

      {/* Void Invoice Modal */}
      <VoidInvoiceModal
        isOpen={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        invoice={selectedInvoiceForAction}
        onVoid={handleVoidInvoice}
        loading={isProcessingAction}
      />

      {/* Refund Invoice Modal */}
      <RefundInvoiceModal
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        invoice={selectedInvoiceForAction}
        onRefund={handleRefundInvoice}
        loading={isProcessingAction}
      />

      {/* Partial Payment Modal */}
      <PartialPaymentModal
        isOpen={partialPaymentModalOpen}
        onClose={() => setPartialPaymentModalOpen(false)}
        invoice={selectedInvoiceForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Payment History Modal */}
      {showPaymentHistory && selectedInvoiceForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Payment History - Invoice #{selectedInvoiceForPayment.invoiceNumber}
              </h2>
              <button
                onClick={() => setShowPaymentHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <PaymentHistory 
                invoiceId={selectedInvoiceForPayment.id}
                onPaymentAdded={handlePaymentSuccess}
              />
            </div>
          </div>
        </div>
      )}
      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

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
    </PermissionGuard>
  );
  
};

export default InvoicingPage;
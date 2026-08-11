"use client";

import { useState, useEffect, useRef } from "react"; 
import { useSearchParams } from "next/navigation";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Download, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ChevronDown,
  Send,
  Printer,
  Edit,
  Trash2,
  X,
  CreditCard,
  FileText,
  Eye,
  Ban,
  RotateCcw,
  RefreshCw
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
import { ReversalStatusBadge, ReversalInfoCard, ReversalChain, ReversalAuditTrail } from '@/components/TransactionReversal/ReversalStatusBadge';
import PageHeader from "@/components/shell/PageHeader";
import ClickableStatCard from '@/components/ui/ClickableStatCard';

import { 
  fetchInvoices, 
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStatistics,
  exportInvoices,
  getInvoiceById
} from "@/app/services/invoiceService";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import { formatDate } from "@/lib/dateUtils";
import { parseMoney, subtractMoney } from "@/lib/money";

const formatInvoiceMoney = (amount) =>
  parseMoney(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function invoiceRemainingDue(invoice) {
  const total = parseMoney(invoice.total);
  const paid = parseMoney(invoice.totalPaid);
  const fromApi = invoice.amountDue ?? invoice.remainingBalance;
  if (fromApi != null && fromApi !== '') {
    return parseMoney(fromApi);
  }
  return Math.max(0, subtractMoney(total, paid));
}

// Status badge component with improved styling
const StatusBadge = ({ status }) => {
  const statusConfig = {
    "Paid": { class: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle, iconClass: "text-emerald-500" },
    "Pending": { class: "bg-amber-50 text-amber-700 border border-amber-200", icon: Clock, iconClass: "text-amber-500" },
    "Overdue": { class: "bg-red-50 text-red-700 border border-red-200", icon: AlertCircle, iconClass: "text-red-500" },
    "Draft": { class: "bg-slate-50 text-slate-700 border border-slate-200", icon: Edit, iconClass: "text-slate-500" },
    "void": { class: "bg-red-50 text-red-700 border border-red-200", icon: Ban, iconClass: "text-red-500" },
    "refunded": { class: "bg-slate-50 text-slate-700 border border-slate-200", icon: RotateCcw, iconClass: "text-slate-500" },
    "partially_refunded": { class: "bg-amber-50 text-amber-700 border border-amber-200", icon: RotateCcw, iconClass: "text-amber-500" },
    "partial": { class: "bg-blue-50 text-blue-700 border border-blue-200", icon: CreditCard, iconClass: "text-blue-500" },
  };

  const config = statusConfig[status] || statusConfig["Pending"];
  const Icon = config.icon;

  return (
    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${config.class}`}>
      <Icon size={14} className={config.iconClass} />
      {status}
    </span>
  );
};

// Tab button component
const TabButton = ({ active, onClick, label, count }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active 
        ? "bg-blue-600 text-white shadow-sm" 
        : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
    }`}
  >
    {label}
    {count !== undefined && (
      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${active ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}>
        {count}
      </span>
    )}
  </button>
);

const InvoicingPage = () => {
  const searchParams = useSearchParams();
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
  const [sortBy, setSortBy] = useState("date");
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
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  
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
  const [sendAttachments, setSendAttachments] = useState([]);
  const sendOnceForInvoiceIdRef = useRef(null);
  const pendingSendMessageRef = useRef(null);
  const pendingSendAttachmentsRef = useRef([]);
  const pendingSendOtherEmailsRef = useRef([]);

  // Partial payment modal states
  const [partialPaymentModalOpen, setPartialPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  
  const [pagePermissions, setPagePermissions] = useState({ 
    canSendInvoices: false,
    canCreateInvoices: false,
    canDeleteInvoices: false, 
    canExportInvoices: false, 
    canMarkAsPaid: false, 
    canUpdateInvoices: false, 
  });      

  // Statistics cards configuration
  const statCards = [
    { key: 'paid', label: 'Paid Invoices', icon: CheckCircle, barClassName: 'from-emerald-400 via-green-500 to-teal-500', valueClassName: 'text-emerald-700', iconWrapClassName: 'bg-emerald-100 text-emerald-600' },
    { key: 'pending', label: 'Pending', icon: Clock, barClassName: 'from-amber-400 via-yellow-500 to-orange-500', valueClassName: 'text-amber-700', iconWrapClassName: 'bg-amber-100 text-amber-600' },
    { key: 'overdue', label: 'Overdue', icon: AlertCircle, barClassName: 'from-red-400 via-rose-500 to-red-600', valueClassName: 'text-red-700', iconWrapClassName: 'bg-red-100 text-red-600' },
    { key: 'partial', label: 'Partial', icon: CreditCard, barClassName: 'from-blue-400 via-indigo-500 to-blue-600', valueClassName: 'text-blue-700', iconWrapClassName: 'bg-blue-100 text-blue-600' },
  ];

  const handleStatCardClick = (key) => {
    setActiveTab((prev) => (prev === key ? 'all' : key));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Permission check
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

  // Apply date filters from dashboard / deep links
  useEffect(() => {
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    if (!dateFrom && !dateTo) return;
    setFilterOptions((prev) => ({
      ...prev,
      dateFrom: dateFrom || prev.dateFrom,
      dateTo: dateTo || prev.dateTo,
    }));
    setFilterOpen(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchParams]);

  // Handle send invoice - only open modal; capture starts when user clicks Send in modal
  const handleSendInvoice = (invoice) => {
    sendOnceForInvoiceIdRef.current = null;
    pendingSendMessageRef.current = null;
    pendingSendAttachmentsRef.current = [];
    pendingSendOtherEmailsRef.current = [];
    setSelectedInvoiceForSending(invoice);
    setCustomMessage("");
    setSendAttachments([]);
    setSendInvoiceModalOpen(true);
  };

  // When user clicks Send in modal: store message/attachments/otherEmails, close modal, then start PDF capture (email sends when capture completes)
  const handleMessageSubmit = (message, files = [], otherEmails = []) => {
    const invoice = selectedInvoiceForSending;
    if (!invoice) return;
    setCustomMessage(message);
    setSendAttachments(Array.isArray(files) ? files : []);
    pendingSendMessageRef.current = message;
    pendingSendAttachmentsRef.current = Array.isArray(files) ? files : [];
    pendingSendOtherEmailsRef.current = Array.isArray(otherEmails) ? otherEmails : [];
    setSendInvoiceModalOpen(false);
    (async () => {
      try {
        setIsCapturingPdf(true);
        const data = await downloadInvoiceAsImage(invoice.id, selectedTemplate?.id);
        setCaptureInvoiceData(data);
        setCaptureInvoiceType("save");
      } catch (error) {
        console.error("Error starting invoice send process:", error);
        alert("Failed to start invoice send process: " + error.message);
        setIsCapturingPdf(false);
      }
    })();
  };

  // Handle void invoice
  const handleVoidInvoice = async (invoiceId, reason) => {
    try {
      setIsProcessingAction(true);
      const response = await fetch('/api/invoices/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, reason }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to void invoice');

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, refundAmount, refundReason, refundMethod, notes }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to process refund');

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
  const handlePaymentSuccess = () => {
    loadInvoices();
    setSuccessMessage('Payment processed successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Toggle payment history
  const togglePaymentHistory = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setShowPaymentHistory(!showPaymentHistory);
  };

  // Check if invoice is eligible for partial payment
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

  // Wait for file function
  async function waitForFile(id, type, maxRetries = 10, interval = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch(`/api/invoices/upload?id=${id}&type=${type}`);
      const result = await res.json();
      if (result.exists) return true;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('File not available after waiting');
  }

  // Handle capture success
  const handleCaptureSuccess = () => {
    if (captureInvoiceType !== "save") {
      setSuccessMessage("Invoice downloaded successfully!");
      setTimeout(() => {
        setCaptureInvoiceData(null);
        setIsCapturingPdf(false);
      }, 1000);
      return;
    }
    const invoiceId = captureInvoiceData?.invoice?.id;
    if (!invoiceId) {
      setTimeout(() => { setCaptureInvoiceData(null); setIsCapturingPdf(false); }, 1000);
      return;
    }
    if (sendOnceForInvoiceIdRef.current === invoiceId) return;
    sendOnceForInvoiceIdRef.current = invoiceId;
    if (isSendingInvoice) return;
    setIsSendingInvoice(true);

    (async () => {
      try {
        await waitForFile(invoiceId, "invoice");
        const message = pendingSendMessageRef.current ?? customMessage ?? "";
        const attachments = pendingSendAttachmentsRef.current ?? sendAttachments ?? [];
        const otherEmails = pendingSendOtherEmailsRef.current ?? [];
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

        let response;
        if (hasAttachments) {
          const formData = new FormData();
          formData.append('message', message);
          formData.append('templateId', selectedTemplate?.id || "");
          formData.append('otherEmails', JSON.stringify(otherEmails));
          attachments.forEach((file) => formData.append('attachments', file));
          response = await fetch(`/api/invoices/${invoiceId}/send`, {
            method: 'POST',
            body: formData,
          });
        } else {
          response = await fetch(`/api/invoices/${invoiceId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, templateId: selectedTemplate?.id, otherEmails }),
          });
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error || 'Failed to send invoice');
        }
        setSendInvoiceModalOpen(false);
        setSendAttachments([]);
        pendingSendMessageRef.current = null;
        pendingSendAttachmentsRef.current = [];
        pendingSendOtherEmailsRef.current = [];
        const isPaid = captureInvoiceData.invoice.status === 'Paid';
        setSuccessMessage(`${isPaid ? 'Payment confirmation' : 'Invoice'} sent successfully`);
        if (result.statusUpdated) loadInvoices();
      } catch (error) {
        console.error("Error in post-capture process:", error);
        sendOnceForInvoiceIdRef.current = null;
        alert(error.message || "PDF generated but failed to send invoice. Please try again.");
      } finally {
        setIsSendingInvoice(false);
        setTimeout(() => {
          setCaptureInvoiceData(null);
          setIsCapturingPdf(false);
        }, 1000);
      }
    })();
  };

  const handleCaptureError = (error) => {
    console.error("Error capturing invoice:", error);
    alert("Failed to generate invoice PDF. Please try again.");
    setCaptureInvoiceData(null);
    setIsCapturingPdf(false);
  };

  // Handle preview invoice - always fetch full invoice so title, orderNumber, and all fields are available for preview
  const handlePreviewInvoice = async (invoice) => {
    try {
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
    if (!confirm("Delete this invoice? Posted invoices will be reversed first and kept in the audit trail.")) return;
    
    try {
      await deleteInvoice(invoiceId);
      setInvoices(invoices.filter(inv => inv.id !== invoiceId));
      setSuccessMessage("Invoice deleted successfully!");
      loadStatistics();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert(error.message || "Failed to delete invoice. Please try again.");
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
      const dataWithTemplate = { ...formData, templateId: selectedTemplate?.id };
      let result;
      if (invoiceModalMode === "create") {
        result = await createInvoice(dataWithTemplate);
        if (pagination.page === 1 || (activeTab === "all" || activeTab === result.invoice.status.toLowerCase())) {
          setInvoices([result.invoice, ...invoices]);
        }
        setSuccessMessage("Invoice created successfully!");
      } else {
        result = await updateInvoice(selectedInvoice.id, dataWithTemplate);
        setInvoices(invoices.map(inv => inv.id === result.invoice.id ? result.invoice : inv));
        setSuccessMessage("Invoice updated successfully!");
      }
      setInvoiceModalOpen(false);
      loadStatistics();
      return result.invoice;
    } catch (error) {
      console.error("Error submitting invoice:", error);
      const message = error?.message && error.message !== "Error creating invoice: Internal Server Error"
        ? error.message
        : "Failed to save invoice. Please try again.";
      alert(message);
      return undefined;
    }
  };

  // Load invoices, statistics, and templates on initial render
  useEffect(() => {
    loadInvoices();
    loadStatistics();
    loadClients();
    loadTemplates();
    loadBrandingSettings();
  }, [activeTab, pagination.page, sortBy, sortOrder, filterOptions.dateFrom, filterOptions.dateTo, filterOptions.client, filterOptions.status]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setFilterOpen(false);
      if (sortRef.current && !sortRef.current.contains(event.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle search query changes with debounce
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => loadInvoices(), 500);
    setSearchTimeout(timeout);
    return () => { if (searchTimeout) clearTimeout(searchTimeout); };
  }, [searchQuery]);

  // Clear success message after timeout
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);

  // Load invoice data from the API
  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let statusFilter = null;
      if (activeTab === 'draft') statusFilter = 'Draft';
      if (activeTab === 'pending') statusFilter = 'Pending';
      if (activeTab === 'paid') statusFilter = 'Paid';
      if (activeTab === 'overdue') statusFilter = 'Overdue';
      if (activeTab === 'partial') statusFilter = 'Partial';
      
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: getApiSortField(sortBy),
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
        const defaultTemplate = data.templates?.find(t => t.isDefault) || data.templates?.[0];
        if (defaultTemplate) setSelectedTemplate(defaultTemplate);
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
    setPagination({ ...pagination, page: newPage });
  };

  // Handle search input change
  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilterOptions(prev => ({ ...prev, [field]: value }));
  };

  // Apply filters
  const applyFilters = () => {
    setFilterOpen(false);
    loadInvoices();
    loadStatistics();
  };

  // Reset filters
  const resetFilters = () => {
    setFilterOptions({ status: "all", dateFrom: "", dateTo: "", client: "" });
    setFilterOpen(false);
    loadInvoices();
    loadStatistics();
  };

  // Handle sort change
  const handleSortChange = (field) => {
    setSortOpen(false);
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Map frontend field names to API field names
  const getApiSortField = (field) => {
    const fieldMapping = { 'date': 'issueDate', 'dueDate': 'dueDate', 'clientName': 'clientName', 'total': 'total', 'status': 'status' };
    return fieldMapping[field] || field;
  };

  // Handle export
  const handleExport = async (format = 'csv') => {
    try {
      const filters = {
        status: activeTab === 'all' ? null : activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
        client: filterOptions.client || null,
        search: searchQuery || null,
        dateFrom: filterOptions.dateFrom || null,
        dateTo: filterOptions.dateTo || null
      };
      
      const blob = await exportInvoices(filters, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
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
      const data = await downloadInvoiceAsImage(invoiceId, selectedTemplate?.id);
      setCaptureInvoiceData(data);
    } catch (error) {
      console.error("Error downloading invoice:", error);
      alert("Failed to download invoice. Please try again.");
      setIsCapturingPdf(false);
    }
  };

  // Format date helper
  const formatDateDisplay = (dateString) => {
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  return (
    <PermissionGuard permission="invoices.view">   
      <div className="p-4 sm:p-6 w-full">
        {/* Success notification */}
        {successMessage && (
          <div className="fixed top-6 right-6 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-4 rounded-lg shadow-lg z-50 flex items-center animate-fadeIn max-w-md">
            <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <p className="font-medium flex-grow">{successMessage}</p>
            <button className="text-emerald-600 hover:text-emerald-800 flex-shrink-0" onClick={() => setSuccessMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <PageHeader
          title="Invoices"
          description="Manage and track all your invoices"
          actions={
            <>
              <div className="relative">
                <select
                  className="cursor-pointer appearance-none rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-4 py-2.5 pr-10 text-sm transition-colors hover:border-[var(--border-strong)]"
                  value={selectedTemplate?.id || ""}
                  onChange={(e) => {
                    const selected = invoiceTemplates.find(t => t.id === e.target.value);
                    setSelectedTemplate(selected || null);
                  }}
                  aria-label="Invoice template"
                >
                  <option value="" disabled>Select Template</option>
                  {invoiceTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <ChevronDown size={16} className="text-[var(--text-muted)]" aria-hidden="true" />
                </div>
              </div>
              {pagePermissions.canCreateInvoices && (
                <button
                  type="button"
                  className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--action-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--action-primary-hover)]"
                  onClick={openCreateInvoiceModal}
                >
                  <PlusCircle size={18} className="mr-2" aria-hidden="true" />
                  New Invoice
                </button>
              )}
            </>
          }
        />


        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <ClickableStatCard
              key={stat.key}
              label={stat.label}
              value={`MWK ${formatInvoiceMoney(statistics[stat.key]?.amount || '0')}`}
              count={statistics[stat.key]?.count || 0}
              countLabel={`invoice${statistics[stat.key]?.count !== 1 ? 's' : ''}`}
              icon={stat.icon}
              active={activeTab === stat.key}
              onClick={() => handleStatCardClick(stat.key)}
              valueClassName={stat.valueClassName}
              iconWrapClassName={stat.iconWrapClassName}
              barClassName={stat.barClassName}
            />
          ))}
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-gray-100 bg-gray-50/50">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label="All" count={invoices.length} />
            <TabButton active={activeTab === "draft"} onClick={() => setActiveTab("draft")} label="Drafts" />
            <TabButton active={activeTab === "pending"} onClick={() => setActiveTab("pending")} label="Pending" />
            <TabButton active={activeTab === "paid"} onClick={() => setActiveTab("paid")} label="Paid" />
            <TabButton active={activeTab === "overdue"} onClick={() => setActiveTab("overdue")} label="Overdue" />
          </div>

          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="w-full md:w-96 relative">
              <input 
                type="text" 
                placeholder="Search by invoice number or client..." 
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Filter dropdown */}
              <div className="relative" ref={filterRef}>
                <button 
                  className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <Filter size={16} className="mr-2 text-gray-500" />
                  Filter
                  <ChevronDown size={16} className="ml-2 text-gray-500" />
                </button>
                
                {filterOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-10 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-gray-900">Filter Invoices</h3>
                      <button className="text-gray-400 hover:text-gray-600" onClick={() => setFilterOpen(false)}>
                        <X size={18} />
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                        <select 
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Client</label>
                        <select 
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={filterOptions.client}
                          onChange={(e) => handleFilterChange('client', e.target.value)}
                        >
                          <option value="">All Clients</option>
                          {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">From Date</label>
                          <input 
                            type="date"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={filterOptions.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">To Date</label>
                          <input 
                            type="date"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={filterOptions.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                      <button 
                        className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={resetFilters}
                      >
                        Reset
                      </button>
                      <button 
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={applyFilters}
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Sort dropdown */}
              <div className="relative" ref={sortRef}>
                <button 
                  className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setSortOpen(!sortOpen)}
                >
                  <ArrowUpDown size={16} className="mr-2 text-gray-500" />
                  Sort
                  <ChevronDown size={16} className="ml-2 text-gray-500" />
                </button>
                
                {sortOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-10 p-2">
                    {[
                      { field: 'date', label: 'Date' },
                      { field: 'dueDate', label: 'Due Date' },
                      { field: 'total', label: 'Amount' },
                      { field: 'clientName', label: 'Client' }
                    ].map((option) => (
                      <button 
                        key={option.field}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-gray-50 flex items-center justify-between ${sortBy === option.field ? 'bg-blue-50 text-blue-600' : ''}`}
                        onClick={() => handleSortChange(option.field)}
                      >
                        <span>{option.label}</span>
                        {sortBy === option.field && (
                          <span className="text-xs font-medium">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Export button */}
              {pagePermissions.canExportInvoices && (
                <button 
                  className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => handleExport('csv')}
                >
                  <Download size={16} className="mr-2 text-gray-500" />
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Invoice Table */}
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-gray-500">Loading invoices...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={loadInvoices}
              >
                Try Again
              </button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-500 mb-6">
                {activeTab !== "all" || searchQuery 
                  ? "Try adjusting your filters or search query"
                  : "Get started by creating your first invoice"}
              </p>
              {pagePermissions.canCreateInvoices && (
                <button 
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium inline-flex items-center hover:bg-blue-700 transition-colors"
                  onClick={openCreateInvoiceModal}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Invoice
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Due Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-blue-600">{invoice.invoiceNumber}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{formatDateDisplay(invoice.issueDate)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden lg:table-cell">{formatDateDisplay(invoice.dueDate)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{invoice.client.name}</div>
                          <div className="text-xs text-gray-500">{invoice.client.email}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          {(() => {
                            const total = parseMoney(invoice.total);
                            const paid = parseMoney(invoice.totalPaid);
                            const remaining = invoiceRemainingDue(invoice);
                            const unpaidStatuses = ['Pending', 'Partial', 'Overdue'];
                            const showRemainingPrimary =
                              unpaidStatuses.includes(invoice.status) || (remaining > 0 && remaining < total - 0.005);

                            if (showRemainingPrimary) {
                              return (
                                <>
                                  <div className="text-sm font-bold text-gray-900">
                                    MWK {formatInvoiceMoney(remaining)}
                                  </div>
                                  <div className="text-xs text-amber-700">Remaining</div>
                                  {(paid > 0 || Math.abs(remaining - total) > 0.005) && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      Total: MWK {formatInvoiceMoney(total)}
                                    </div>
                                  )}
                                  {paid > 0 && (
                                    <div className="text-xs text-emerald-600">
                                      Paid: MWK {formatInvoiceMoney(paid)}
                                    </div>
                                  )}
                                </>
                              );
                            }

                            return (
                              <>
                                <div className="text-sm font-bold text-gray-900">
                                  MWK {formatInvoiceMoney(total)}
                                </div>
                                {paid > 0 && (
                                  <div className="text-xs text-emerald-600">
                                    Paid: MWK {formatInvoiceMoney(paid)}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center hidden sm:table-cell">
                          <ReversalStatusBadge status={invoice.status} isReversed={invoice.isReversed} reversedAt={invoice.reversedAt} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Preview"
                              onClick={() => handlePreviewInvoice(invoice)}
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                              title="Download"
                              onClick={() => handleDownload(invoice.id)}
                            >
                              <Printer size={16} />
                            </button>
                            {pagePermissions.canSendInvoices && (
                              <button
                                className={`p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all ${isCapturingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={isCapturingPdf ? "Sending..." : invoice.status === 'Paid' ? "Send Payment Confirmation" : "Send Invoice"}
                                onClick={() => handleSendInvoice(invoice)}
                                disabled={isCapturingPdf}
                              >
                                <Send size={16} />
                              </button>
                            )}
                            {invoice.status === 'Draft' && pagePermissions.canUpdateInvoices && (
                              <button 
                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                title="Edit"
                                onClick={() => openEditInvoiceModal(invoice)}
                              >
                                <Edit size={16} />
                              </button>
                            )}
                            {(invoice.status === 'Draft' || invoice.status === 'Pending') && pagePermissions.canDeleteInvoices && (
                              <button 
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete"
                                onClick={() => handleDeleteInvoice(invoice.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            {invoice.status !== 'void' && invoice.status !== 'refunded' && invoice.status !== 'partially_refunded' && 
                             !invoice.payments?.some(p => p.status === 'Completed') && pagePermissions.canUpdateInvoices && (
                              <button 
                                className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                title="Void Invoice"
                                onClick={() => openVoidModal(invoice)}
                              >
                                <Ban size={16} />
                              </button>
                            )}
                            {invoice.status !== 'void' && invoice.status !== 'draft' && 
                             invoice.payments?.some(p => p.status === 'Completed') && pagePermissions.canUpdateInvoices && (
                              <button 
                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                title="Process Refund"
                                onClick={() => openRefundModal(invoice)}
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                            {isEligibleForPartialPayment(invoice) && pagePermissions.canUpdateInvoices && (
                              <button 
                                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Record Payment"
                                onClick={() => handlePartialPayment(invoice)}
                              >
                                <CreditCard size={16} />
                              </button>
                            )}
                            {invoice.payments && invoice.payments.length > 0 && (
                              <button 
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Payment History"
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

              {/* Pagination */}
              {!isLoading && !error && invoices.length > 0 && (
                <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
                  <div className="text-sm text-gray-600 order-2 sm:order-1">
                    Showing <span className="font-semibold">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-semibold">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> of <span className="font-semibold">{pagination.totalCount}</span> invoices
                  </div>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button 
                      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      disabled={pagination.page === 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      Previous
                    </button>
                    
                    {[...Array(Math.min(pagination.totalPages, 5))].map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button 
                          key={pageNum}
                          className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                            pagination.page === pageNum 
                              ? "bg-blue-600 text-white border-blue-600" 
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    {pagination.totalPages > 5 && (
                      <span className="px-2 text-gray-500">...</span>
                    )}
                    
                    <button 
                      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Invoice Modal for create/edit */}
        {invoiceModalOpen && (
          <InvoiceModal
            isOpen={invoiceModalOpen}
            onClose={() => setInvoiceModalOpen(false)}
            mode={invoiceModalMode}
            invoice={selectedInvoice}
            onSubmit={handleInvoiceSubmit}
            templates={invoiceTemplates}
            selectedTemplate={selectedTemplate}
            onTemplateChange={setSelectedTemplate}
            onMessageSubmit={handleMessageSubmit}
          />
        )}

        {/* Invoice Preview Modal */}
        {previewModalOpen && invoiceForPreview && brandingSettings && selectedTemplate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-5 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select
                      className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm appearance-none pr-10"
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium inline-flex items-center hover:bg-blue-700 transition-colors"
                    onClick={() => handleDownload(invoiceForPreview.id)}
                  >
                    <Download size={16} className="mr-2" />
                    Download
                  </button>
                  <button
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setPreviewModalOpen(false)}
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
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

        {/* Send Invoice Modal */}
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">
                  Payment History - Invoice #{selectedInvoiceForPayment.invoiceNumber}
                </h2>
                <button
                  onClick={() => setShowPaymentHistory(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={22} />
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

        {/* Invoice Template Capture */}
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

        {/* Capturing PDF loader */}
        {isCapturingPdf && !captureInvoiceData && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
                <div>
                  <p className="font-medium text-gray-900">Preparing invoice...</p>
                  <p className="text-sm text-gray-500">This may take a few seconds</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSS for animations */}
        <style jsx global>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>
      </div>
    </PermissionGuard>
  );
};

export default InvoicingPage;

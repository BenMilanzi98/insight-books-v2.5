"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect, useRef } from "react";
import { Eye } from "lucide-react";
import QuotationTemplatePreview from "@/components/QuotationTemplatePreview";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  Send,
  Printer,
  Edit,
  Trash2,
  Share2,
  FileText,
  CornerDownRight,
  Copy,
  AlertCircle,
  X,
  CheckSquare,
  Calendar,
  DollarSign,
  RefreshCw,
  Ban,
  FileCheck
} from "lucide-react";
import QuotationModal from "@/components/QuotationModal";
import SendQuotationModal from "@/components/SendQuotationModal";
import PortalPopover from "@/components/ui/PortalPopover";
import { DashboardMenuItem } from "@/components/ui/DashboardMenuPanel";
import { 
  fetchQuotations, 
  createQuotation, 
  updateQuotation, 
  deleteQuotation, 
  convertToInvoice,
  sendQuotation,
  downloadQuotation,
  duplicateQuotation,
  getQuotationStatistics,
  exportQuotations
} from "../services/quotationService";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import QuotationTemplateCapture from "@/components/QuotationTemplateCapture";
import { formatDate } from "@/lib/dateUtils";
import ClickableStatCard from '@/components/ui/ClickableStatCard';

const formatQuotationMoney = (amount) =>
  parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Status badge component with improved styling
const StatusBadge = ({ status }) => {
  const statusConfig = {
    "Approved": { class: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle, iconClass: "text-emerald-500" },
    "Pending": { class: "bg-amber-50 text-amber-700 border border-amber-200", icon: Clock, iconClass: "text-amber-500" },
    "Expired": { class: "bg-slate-50 text-slate-700 border border-slate-200", icon: AlertCircle, iconClass: "text-slate-500" },
    "Rejected": { class: "bg-red-50 text-red-700 border border-red-200", icon: Ban, iconClass: "text-red-500" },
    "Converted": { class: "bg-blue-50 text-blue-700 border border-blue-200", icon: CornerDownRight, iconClass: "text-blue-500" },
    "Draft": { class: "bg-slate-50 text-slate-700 border border-slate-200", icon: FileText, iconClass: "text-slate-500" },
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

const QuotationsPage = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [filteredQuotations, setFilteredQuotations] = useState([]);
  const [statistics, setStatistics] = useState({
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    converted: { count: 0, total: 0 }
  });
  
  // Enhanced: Preview modal states from Project B
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [quotationForPreview, setQuotationForPreview] = useState(null);
  const [brandingSettings, setBrandingSettings] = useState(null);
  const [previewQuotationData, setPreviewQuotationData] = useState(null);
  
  // Modal states
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  
  // Conversion modal states
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [captureInvoiceData, setCaptureInvoiceData] = useState(null);
  const [captureInvoiceType, setCaptureInvoiceType] = useState("capture");
  const [isCapturingPdf, setIsCapturingPdf] = useState(false);
  const [isSendingQuotation, setIsSendingQuotation] = useState(false);
  const [sendQuotationModalOpen, setSendQuotationModalOpen] = useState(false);
  const [selectedQuotationForSending, setSelectedQuotationForSending] = useState(null);
  const [customQuotationMessage, setCustomQuotationMessage] = useState("");
  const [sendQuotationAttachments, setSendQuotationAttachments] = useState([]);
  const sendOnceForQuotationIdRef = useRef(null);
  const pendingSendMessageRef = useRef(null);
  const pendingSendAttachmentsRef = useRef([]);
  const pendingSendOtherEmailsRef = useRef([]);

  // Notification state
  const [notification, setNotification] = useState(null);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: "date", direction: "desc" }); // We'll keep 'date' here for consistency with UI
  const [filterConfig, setFilterConfig] = useState({
    dateFrom: null,
    dateTo: null,
    clientId: null
  });
  // Ref so "Apply Filters" always uses the latest values (avoids stale state when clicking Apply quickly)
  const filterConfigRef = useRef(filterConfig);
  const [pagePermissions, setPagePermissions] = useState({  
    canApproveQuotations:false,
    canCreateQuotations:false,
    canDeleteQuotations:false, 
    canExportQuotations:false, 
    canConvertQuotations:false, 
    canUpdateQuotations:false, 
  });
  
  // Function to fetch quotation data for preview
  const fetchQuotationForPreview = async (quotation) => {
    try {
      setQuotationForPreview(quotation);
      setPreviewModalOpen(true);
      
      // Fetch properly formatted quotation data
      const data = await downloadQuotation(quotation.id);
      setPreviewQuotationData(data);
    } catch (error) {
      console.error("Error fetching quotation for preview:", error);
      showNotification("error", "Failed to load quotation preview. Please try again.");
    }
  };
  
  useEffect(() => {
    const fetchPermissions = async () => { 
      const canApproveQuotations = await getPermission("quotations.approve");
      const canCreateQuotations  = await getPermission("quotations.create");
      const canDeleteQuotations  = await getPermission("quotations.delete");
      const canExportQuotations  = await getPermission("quotations.export"); 
      const canConvertQuotations  = await getPermission("quotations.convert");
      const canUpdateQuotations  = await getPermission("quotations.update"); 
  
      setPagePermissions({ 
        canApproveQuotations,
        canCreateQuotations,
        canDeleteQuotations, 
        canExportQuotations, 
        canConvertQuotations, 
        canUpdateQuotations,   
        });
    };
  
    fetchPermissions();
  }, []);
  
  // Enhanced: Load branding settings from Project B
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
  
  // Load quotations and statistics on component mount
  useEffect(() => {
    loadQuotations();
    loadStatistics();
    loadBrandingSettings(); // Enhanced: Load branding settings
  }, []);
  
  // Reload quotations when filters, sort, page, search, or status tab change
  useEffect(() => {
    loadQuotations();
  }, [currentPage, sortConfig, filterConfig, searchQuery, activeTab]);
  
  // Filter quotations based on active tab
  useEffect(() => {
    if (quotations.length > 0) {
      filterQuotations();
    }
  }, [activeTab, quotations]);
  
  // Close notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  // Fetch quotations from API (filterOverrides: use when Apply is clicked so we use latest filter values)
  const loadQuotations = async (filterOverrides = null) => {
    const filters = filterOverrides !== null ? filterOverrides : filterConfig;
    setIsLoading(true);
    try {
      const response = await fetchQuotations({
        page: currentPage,
        limit: 10,
        sortBy: sortConfig.field,
        sortOrder: sortConfig.direction,
        status: activeTab !== "all" ? activeTab : undefined,
        search: searchQuery || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        clientId: filters.clientId || undefined
      });
      
      setQuotations(response.quotations || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error loading quotations:", error);
      showNotification("error", "Failed to load quotations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch statistics from API
  const loadStatistics = async () => {
    try {
      const stats = await getQuotationStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  };
  
  // Filter quotations based on active tab
  const filterQuotations = () => {
    let filtered = [...quotations];
    
    if (activeTab !== "all") {
      if (activeTab === "expired") {
        filtered = filtered.filter(q => q.status === "Expired" || q.status === "Rejected");
      } else {
        filtered = filtered.filter(q => q.status.toLowerCase() === activeTab);
      }
    }
    
    setFilteredQuotations(filtered);
  };
  
  // Show notification
  const showNotification = (type, message, invoiceId = null) => {
    setNotification({
      type,
      message,
      invoiceId
    });
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };
  
  // Open create quotation modal
  const handleCreateQuotation = () => {
    setModalMode("create");
    setSelectedQuotation(null);
    setShowQuotationModal(true);
  };
  
  // Open edit quotation modal
  const handleEditQuotation = (quotation) => {
    setModalMode("edit");
    setSelectedQuotation(quotation);
    setShowQuotationModal(true);
  };
  
  // Submit quotation form (create or update)
  const handleSubmitQuotation = async (formData) => {
    try {
      if (modalMode === "create") {
        const response = await createQuotation(formData);
        setQuotations([response.quotation, ...quotations]);
        showNotification("success", "Quotation created successfully");
      } else {
        const response = await updateQuotation(selectedQuotation.id, formData);
        setQuotations(quotations.map(q => q.id === selectedQuotation.id ? response.quotation : q));
        showNotification("success", "Quotation updated successfully");
      }
      
      loadStatistics(); // Refresh statistics
      return true;
    } catch (error) {
      console.error("Error submitting quotation:", error);
      showNotification("error", `Failed to ${modalMode} quotation. Please try again.`);
      return false;
    }
  };
  
  // Delete a quotation
  const handleDeleteQuotation = async (id) => {
    if (window.confirm("Are you sure you want to delete this quotation?")) {
      try {
        await deleteQuotation(id);
        setQuotations(quotations.filter(q => q.id !== id));
        showNotification("success", "Quotation deleted successfully");
        loadStatistics(); // Refresh statistics
      } catch (error) {
        console.error("Error deleting quotation:", error);
        showNotification("error", "Failed to delete quotation. Please try again.");
      }
    }
  };
  async function waitForFile(id,type, maxRetries = 10, interval = 1000) {
    console.log(`🔍 Starting waitForFile for ${type} ${id}`);
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      console.log(`🔍 Attempt ${attempt + 1}/${maxRetries} - checking for file...`);
      const res = await fetch(`/api/quotations/upload?id=${id}&type=${type}`);
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
  // Send quotation to client - only open modal; capture starts when user clicks Send in modal
  const handleSendQuotation = (quotation) => {
    sendOnceForQuotationIdRef.current = null;
    pendingSendMessageRef.current = null;
    pendingSendAttachmentsRef.current = [];
    pendingSendOtherEmailsRef.current = [];
    setSelectedQuotationForSending(quotation);
    setCustomQuotationMessage("");
    setSendQuotationAttachments([]);
    setSendQuotationModalOpen(true);
  };

  // When user clicks Send in modal: store message/attachments/otherEmails, close modal, then start PDF capture (email sends when capture completes)
  const handleSendQuotationMessageSubmit = (message, files = [], otherEmails = []) => {
    const quotation = selectedQuotationForSending;
    if (!quotation) return;
    setCustomQuotationMessage(message);
    setSendQuotationAttachments(Array.isArray(files) ? files : []);
    pendingSendMessageRef.current = message;
    pendingSendAttachmentsRef.current = Array.isArray(files) ? files : [];
    pendingSendOtherEmailsRef.current = Array.isArray(otherEmails) ? otherEmails : [];
    setSendQuotationModalOpen(false);
    (async () => {
      try {
        setIsCapturingPdf(true);
        const data = await downloadQuotation(quotation.id);
        setCaptureInvoiceData(data);
        setCaptureInvoiceType("save");
      } catch (error) {
        console.error("Error starting quotation send process:", error);
        showNotification("error", "Failed to start quotation send process. Please try again.");
        setIsCapturingPdf(false);
      }
    })();
  };
  
  // Start conversion process
  const handleConvertToInvoice = (quotation) => {
    setSelectedQuotation(quotation);
    setShowConversionModal(true);
  };
  
  // Complete conversion process
  const confirmConversion = async () => {
    if (!selectedQuotation) return;
    
    setConversionLoading(true);
    
    try {
      const response = await convertToInvoice(selectedQuotation.id);
      
      // Update quotation status
      setQuotations(quotations.map(q => 
        q.id === selectedQuotation.id 
          ? {...q, status: "Converted", notes: `Converted to ${response.invoiceNumber}`} 
          : q
      ));
      
      // Close modal and show success
      setShowConversionModal(false);
      showNotification(
        "success", 
        "Quotation successfully converted to invoice!", 
        response.invoiceId
      );
      
      loadStatistics(); // Refresh statistics
    } catch (error) {
      console.error("Error converting quotation:", error);
      showNotification("error", "Failed to convert quotation to invoice. Please try again.");
    } finally {
      setConversionLoading(false);
    }
  };
  
  // Cancel conversion
  const cancelConversion = () => {
    setShowConversionModal(false);
    setSelectedQuotation(null);
  };
  
  // Duplicate a quotation
  const handleDuplicateQuotation = async (id) => {
    try {
      const response = await duplicateQuotation(id);
      setQuotations([response.quotation, ...quotations]);
      showNotification("success", "Quotation duplicated successfully");
    } catch (error) {
      console.error("Error duplicating quotation:", error);
      showNotification("error", "Failed to duplicate quotation. Please try again.");
    }
  };
  
  // Download quotation as PDF
  const handleDownloadQuotation = async (id) => {
    try {
      setIsCapturingPdf(true);
      setCaptureInvoiceType("capture")
      const data = await downloadQuotation(id);
      setCaptureInvoiceData(data);
      // No notification needed as the file download itself is a clear indication
    } catch (error) {
      console.error("Error downloading quotation:", error);
      showNotification("error", "Failed to download quotation. Please try again.");
      setIsCapturingPdf(false);
    }
  };
  const handleCaptureSuccess = async () => {
    if (captureInvoiceType !== "save") {
      showNotification("success", "Quotation downloaded successfully");
      setTimeout(() => {
        setCaptureInvoiceData(null);
        setIsCapturingPdf(false);
      }, 1000);
      return;
    }
    const quotationId = captureInvoiceData?.quotation?.id;
    if (!quotationId) {
      setTimeout(() => { setCaptureInvoiceData(null); setIsCapturingPdf(false); }, 1000);
      return;
    }
    if (sendOnceForQuotationIdRef.current === quotationId) return;
    sendOnceForQuotationIdRef.current = quotationId;
    if (isSendingQuotation) return;
    setIsSendingQuotation(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await waitForFile(quotationId, "quotation");
      const message = pendingSendMessageRef.current ?? customQuotationMessage ?? "";
      const attachments = pendingSendAttachmentsRef.current ?? sendQuotationAttachments ?? [];
      const otherEmails = pendingSendOtherEmailsRef.current ?? [];
      const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
      await sendQuotation(quotationId, { message, attachments: hasAttachments ? attachments : undefined, otherEmails });
      setSendQuotationAttachments([]);
      pendingSendMessageRef.current = null;
      pendingSendAttachmentsRef.current = [];
      pendingSendOtherEmailsRef.current = [];
      showNotification("success", "Quotation sent to client successfully");
    } catch (error) {
      console.error("Error in post-capture process:", error);
      sendOnceForQuotationIdRef.current = null;
      showNotification("error", "PDF generated but failed to send quotation. Please try again.");
    } finally {
      setIsSendingQuotation(false);
      setTimeout(() => {
        setCaptureInvoiceData(null);
        setIsCapturingPdf(false);
      }, 1000);
    }
  };
  
  const handleCaptureError = (error) => {
    showNotification("error", "Failed to generate quotation PDF. Please try again.");
    console.error("Error capturing quotation:", error);
    setCaptureInvoiceData(null);
    setIsCapturingPdf(false);
  };
  
  // Export quotations
  const handleExportQuotations = async () => {
    try {
      await exportQuotations({
        status: activeTab !== "all" ? activeTab : undefined,
        ...filterConfig
      });
      // No notification needed as the file download itself is a clear indication
    } catch (error) {
      console.error("Error exporting quotations:", error);
      showNotification("error", "Failed to export quotations. Please try again.");
    }
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    if (typeof amount === 'string') {
      return `MK ${amount}`;
    }
    return `MK ${parseFloat(amount).toLocaleString()}`;
  };

  // Statistics cards configuration
  const statCards = [
    { key: 'pending', label: 'Pending', icon: Clock, barClassName: 'from-amber-400 via-yellow-500 to-orange-500', valueClassName: 'text-amber-700', iconWrapClassName: 'bg-amber-100 text-amber-600' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, barClassName: 'from-emerald-400 via-green-500 to-teal-500', valueClassName: 'text-emerald-700', iconWrapClassName: 'bg-emerald-100 text-emerald-600' },
    { key: 'converted', label: 'Converted', icon: CornerDownRight, barClassName: 'from-blue-500 via-sky-500 to-indigo-500', valueClassName: 'text-blue-700', iconWrapClassName: 'bg-blue-100 text-blue-600' },
    { key: 'expired', label: 'Expired', icon: AlertCircle, barClassName: 'from-slate-400 via-gray-500 to-slate-600', valueClassName: 'text-slate-700', iconWrapClassName: 'bg-slate-100 text-slate-600' },
  ];

  const handleStatCardClick = (key) => {
    setActiveTab((prev) => (prev === key ? 'all' : key));
    setCurrentPage(1);
  };

  // Filter/sort trigger refs (panels render in a portal above glass cards)
  const filterRef = useRef(null);
  const sortRef = useRef(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);

  // Clear success message after timeout
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);

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

  // Load clients on component mount
  useEffect(() => {
    loadClients();
  }, []);

  // Handle filter change (keep ref in sync so Apply always has latest)
  const handleFilterChange = (field, value) => {
    setFilterConfig(prev => {
      const next = { ...prev, [field]: value || null };
      filterConfigRef.current = next;
      return next;
    });
  };

  // Apply filters (use ref so we never send stale filter state)
  const applyFilters = () => {
    setFilterOpen(false);
    loadQuotations(filterConfigRef.current);
  };

  // Reset filters
  const resetFilters = () => {
    const cleared = { dateFrom: null, dateTo: null, clientId: null };
    setFilterConfig(cleared);
    filterConfigRef.current = cleared;
    setFilterOpen(false);
    loadQuotations(cleared);
  };

  // Handle sort change
  const handleSortChange = (field) => {
    setSortOpen(false);
    if (sortConfig.field === field) {
      setSortConfig({ field, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortConfig({ field, direction: 'desc' });
    }
  };

  // Map frontend field names to API field names
  const getApiSortField = (field) => {
    const fieldMapping = { 'date': 'date', 'validUntil': 'validUntil', 'amount': 'amount', 'clientName': 'clientName' };
    return fieldMapping[field] || field;
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  // Show success notification
  const showSuccessNotification = (message) => {
    setSuccessMessage(message);
  };

  return (
    <PermissionGuard permission="quotations.view">   
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

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tt('Quotations')}</h1>
            <p className="text-gray-500 mt-1">{tt('Manage and track all your quotations')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {pagePermissions.canCreateQuotations && (
              <button 
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium flex items-center hover:bg-blue-700 transition-colors shadow-sm"
                onClick={handleCreateQuotation}
              >
                <PlusCircle size={18} className="mr-2" />
                {tt('New Quotation')}
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <ClickableStatCard
              key={stat.key}
              label={stat.label}
              value={`MWK ${formatQuotationMoney(statistics[stat.key]?.total || '0')}`}
              count={statistics[stat.key]?.count || 0}
              countLabel={`quotation${statistics[stat.key]?.count !== 1 ? 's' : ''}`}
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
            <TabButton active={activeTab === "all"} onClick={() => { setActiveTab("all"); setCurrentPage(1); }} label="All" count={quotations.length} />
            <TabButton active={activeTab === "pending"} onClick={() => { setActiveTab("pending"); setCurrentPage(1); }} label="Pending" />
            <TabButton active={activeTab === "approved"} onClick={() => { setActiveTab("approved"); setCurrentPage(1); }} label="Approved" />
            <TabButton active={activeTab === "draft"} onClick={() => { setActiveTab("draft"); setCurrentPage(1); }} label="Drafts" />
            <TabButton active={activeTab === "converted"} onClick={() => { setActiveTab("converted"); setCurrentPage(1); }} label="Converted" />
            <TabButton active={activeTab === "expired"} onClick={() => { setActiveTab("expired"); setCurrentPage(1); }} label="Expired" />
          </div>

          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="w-full md:w-96 relative">
              <input 
                type="text" 
                placeholder={tt('Search by quotation number or client...')} 
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Filter dropdown */}
              <div className="relative">
                <button 
                  ref={filterRef}
                  type="button"
                  className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false); }}
                >
                  <Filter size={16} className="mr-2 text-gray-500" />
                  {tt('Filter')}
                  <ChevronDown size={16} className="ml-2 text-gray-500" />
                </button>
                
                <PortalPopover
                  open={filterOpen}
                  onClose={() => setFilterOpen(false)}
                  anchorRef={filterRef}
                  align="end"
                  variant="dashboard"
                  estimatedWidth={320}
                  estimatedHeight={320}
                  className="w-80"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">{tt('Filter Quotations')}</h3>
                    <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => setFilterOpen(false)}>
                      <X size={18} />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{tt('Client')}</label>
                      <select 
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={filterConfig.clientId || ""}
                        onChange={(e) => handleFilterChange('clientId', e.target.value || null)}
                      >
                        <option value="">{tt('All Clients')}</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{tt('From Date')}</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={filterConfig.dateFrom || ""}
                          onChange={(e) => handleFilterChange('dateFrom', e.target.value || null)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{tt('To Date')}</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={filterConfig.dateTo || ""}
                          onChange={(e) => handleFilterChange('dateTo', e.target.value || null)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                    <button 
                      type="button"
                      className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={resetFilters}
                    >
                      {tt('Reset')}
                    </button>
                    <button 
                      type="button"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      onClick={applyFilters}
                    >
                      {tt('Apply Filters')}
                    </button>
                  </div>
                </PortalPopover>
              </div>
              
              {/* Sort dropdown */}
              <div className="relative">
                <button 
                  ref={sortRef}
                  type="button"
                  className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { setSortOpen(!sortOpen); setFilterOpen(false); }}
                >
                  <ArrowUpDown size={16} className="mr-2 text-gray-500" />
                  {tt('Sort')}
                  <ChevronDown size={16} className="ml-2 text-gray-500" />
                </button>
                
                <PortalPopover
                  open={sortOpen}
                  onClose={() => setSortOpen(false)}
                  anchorRef={sortRef}
                  align="end"
                  variant="dashboard"
                  estimatedWidth={192}
                  estimatedHeight={200}
                  className="w-48"
                  bodyClassName="p-2"
                >
                  {[
                    { field: 'date', label: 'Date' },
                    { field: 'validUntil', label: 'Valid Until' },
                    { field: 'amount', label: 'Amount' },
                    { field: 'clientName', label: 'Client' }
                  ].map((option) => (
                    <DashboardMenuItem 
                      key={option.field}
                      active={sortConfig.field === option.field}
                      onClick={() => handleSortChange(option.field)}
                    >
                      <span>{tt(option.label)}</span>
                      {sortConfig.field === option.field && (
                        <span className="text-xs font-medium">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </DashboardMenuItem>
                  ))}
                </PortalPopover>
              </div>
              
              {/* Export button */}
              {pagePermissions.canExportQuotations && (
                <button 
                  className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={handleExportQuotations}
                >
                  <Download size={16} className="mr-2 text-gray-500" />
                  {tt('Export')}
                </button>
              )}
            </div>
          </div>

          {/* Quotations Table */}
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-gray-500">{tt('Loading quotations...')}</p>
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{tt('No quotations found')}</h3>
              <p className="text-gray-500 mb-6">
                {activeTab !== "all" || searchQuery 
                  ? "Try adjusting your filters or search query"
                  : "Get started by creating your first quotation"}
              </p>
              {pagePermissions.canCreateQuotations && (
                <button 
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium inline-flex items-center hover:bg-blue-700 transition-colors"
                  onClick={handleCreateQuotation}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  {tt('Create Quotation')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{tt('Quotation #')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">{tt('Date')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{tt('Valid Until')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{tt('Client')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">{tt('Amount')}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">{tt('Status')}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{tt('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {quotations.map((quotation) => (
                      <tr key={quotation.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-blue-600">{quotation.quotationNumber}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{quotation.date}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden lg:table-cell">{quotation.validUntil}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{quotation.client}</div>
                          <div className="text-xs text-gray-500">{quotation.createdBy?.name || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900 hidden md:table-cell">
                          {formatCurrency(quotation.amount)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center hidden sm:table-cell">
                          <StatusBadge status={quotation.status} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Preview"
                              onClick={() => fetchQuotationForPreview(quotation)}
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                              title="Download"
                              onClick={() => handleDownloadQuotation(quotation.id)}
                            >
                              <Printer size={16} />
                            </button>
                            <button
                              className={`p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all ${isCapturingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={isCapturingPdf ? "Sending..." : "Send Quotation"}
                              onClick={() => handleSendQuotation(quotation)}
                              disabled={isCapturingPdf}
                            >
                              <Send size={16} />
                            </button>
                            {quotation.status === "Approved" && pagePermissions.canConvertQuotations && (
                              <button 
                                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Convert to Invoice"
                                onClick={() => handleConvertToInvoice(quotation)}
                              >
                                <CornerDownRight size={16} />
                              </button>
                            )}
                            {quotation.status !== "Converted" && pagePermissions.canUpdateQuotations && (
                              <>
                                <button 
                                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                  title="Edit"
                                  onClick={() => handleEditQuotation(quotation)}
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Duplicate"
                                  onClick={() => handleDuplicateQuotation(quotation.id)}
                                >
                                  <Copy size={16} />
                                </button>
                              </>
                            )}
                            {quotation.status === "Draft" && pagePermissions.canDeleteQuotations && (
                              <button 
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete"
                                onClick={() => handleDeleteQuotation(quotation.id)}
                              >
                                <Trash2 size={16} />
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
              {!isLoading && quotations.length > 0 && (
                <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
                  <div className="text-sm text-gray-600 order-2 sm:order-1">
                    {tt('Showing')} <span className="font-semibold">{(currentPage - 1) * 10 + 1}</span> {tt('to')} <span className="font-semibold">{Math.min(currentPage * 10, quotations.length)}</span> {tt('of')} <span className="font-semibold">{quotations.length}</span> {tt('quotations')}
                  </div>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button 
                      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      {tt('Previous')}
                    </button>
                    
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button 
                          key={pageNum}
                          className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                            currentPage === pageNum 
                              ? "bg-blue-600 text-white border-blue-600" 
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    {totalPages > 5 && (
                      <span className="px-2 text-gray-500">...</span>
                    )}
                    
                    <button 
                      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      {tt('Next')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quotation Modal */}
        {showQuotationModal && (
          <QuotationModal
            isOpen={showQuotationModal}
            onClose={() => setShowQuotationModal(false)}
            mode={modalMode}
            quotation={selectedQuotation}
            onSubmit={handleSubmitQuotation}
          />
        )}

        {/* Conversion Confirmation Modal */}
        {showConversionModal && selectedQuotation && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100">
                    <CornerDownRight size={20} className="text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{tt('Convert to Invoice')}</h3>
                </div>
              </div>
              
              <div className="p-6">
                <p className="text-gray-600 mb-4">
                  {tt('You are about to convert quotation')} <span className="font-medium text-gray-900">{selectedQuotation.quotationNumber}</span> {tt('to an invoice.')}
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-500">{tt('Client:')}</div>
                    <div className="font-medium text-gray-900">{selectedQuotation.client}</div>
                    
                    <div className="text-gray-500">{tt('Description:')}</div>
                    <div className="font-medium text-gray-900">{selectedQuotation.title}</div>
                    
                    <div className="text-gray-500">{tt('Amount:')}</div>
                    <div className="font-medium text-gray-900">{formatCurrency(selectedQuotation.amount)}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-sm bg-amber-50 text-amber-800 p-4 rounded-lg">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{tt('This action cannot be undone. The invoice will need to be deleted separately if created in error.')}</span>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  className="px-4 py-2.5 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  onClick={cancelConversion}
                >
                  {tt('Cancel')}
                </button>
                <button 
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                  onClick={confirmConversion}
                  disabled={conversionLoading}
                >
                  {conversionLoading ? (
                    <>
                      <RefreshCw size={16} className="mr-2 animate-spin" />
                      {tt('Converting...')}
                    </>
                  ) : (
                    <>
                      <CornerDownRight size={16} className="mr-2" />
                      {tt('Convert to Invoice')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send Quotation Modal */}
        <SendQuotationModal
          isOpen={sendQuotationModalOpen}
          onClose={() => setSendQuotationModalOpen(false)}
          quotation={selectedQuotationForSending}
          isSending={isSendingQuotation}
          companyName={brandingSettings?.companyName || 'Company'}
          onMessageSubmit={handleSendQuotationMessageSubmit}
        />

        {/* Quotation Template Capture */}
        {captureInvoiceData && (
          <QuotationTemplateCapture
            quotation={captureInvoiceData.quotation}
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
                  <p className="font-medium text-gray-900">{tt('Preparing quotation...')}</p>
                  <p className="text-sm text-gray-500">{tt('This may take a few seconds')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quotation Preview Modal */}
        {previewModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-5 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{tt('Quotation Preview')}</h2>
                <div className="flex items-center gap-3">
                  {previewQuotationData && (
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium inline-flex items-center hover:bg-blue-700 transition-colors"
                      onClick={() => handleDownloadQuotation(quotationForPreview.id)}
                    >
                      <Download size={16} className="mr-2" />
                      {tt('Download')}
                    </button>
                  )}
                  <button
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => {
                      setPreviewModalOpen(false);
                      setPreviewQuotationData(null);
                    }}
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {previewQuotationData ? (
                  <QuotationTemplatePreview
                    quotation={previewQuotationData.quotation}
                    branding={previewQuotationData.branding}
                    currency="MWK"
                    isPrint={false}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                    <p>{tt('Loading quotation preview...')}</p>
                  </div>
                )}
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

export default QuotationsPage;
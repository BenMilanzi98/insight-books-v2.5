"use client";

import { useState, useEffect } from "react";
import { Eye } from "lucide-react"; // Added Eye icon for preview
import QuotationTemplatePreview from "@/components/QuotationTemplatePreview"; // Enhanced preview from Project B
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
  DollarSign
} from "lucide-react";
import QuotationModal from "@/components/QuotationModal";
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
  const [isSendingQuotation, setIsSendingQuotation] = useState(false); // Add flag to prevent duplicate sends
  
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
  
  // Reload quotations when filters change
  useEffect(() => {
    loadQuotations();
  }, [currentPage, sortConfig, filterConfig, searchQuery]);
  
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
  
  // Fetch quotations from API
  const loadQuotations = async () => {
    setIsLoading(true);
    try {
      const response = await fetchQuotations({
        page: currentPage,
        limit: 10,
        sortBy: sortConfig.field,
        sortOrder: sortConfig.direction,
        status: activeTab !== "all" ? activeTab : undefined,
        search: searchQuery,
        ...filterConfig
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
  // Send quotation to client
  const handleSendQuotation = async (id) => {
    console.log(`🚀 handleSendQuotation called for quotation ${id}`);
    
    // Prevent duplicate sends
    if (isCapturingPdf) {
      console.log('⏳ Already capturing PDF, skipping...');
      return;
    }
    
    try {
      setIsCapturingPdf(true);
      const data = await downloadQuotation(id);
      setCaptureInvoiceData(data);
      setCaptureInvoiceType("save");
      
      console.log('✅ Capture data set, QuotationTemplateCapture will render');
      
      // Don't wait for file here - wait for the capture to complete first
      // The file will be available after QuotationTemplateCapture finishes
      
      // Note: We'll wait for the file in the handleCaptureSuccess callback
      // after the PDF is actually generated and saved
      
    } catch (error) {
      console.error("Error sending quotation:", error);
      showNotification("error", "Failed to send quotation. Please try again.");
      setIsCapturingPdf(false);
    }
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
  // Add handler functions for the capture component
  const handleCaptureSuccess = async () => {
    if(captureInvoiceType==="save"){
      // Prevent duplicate sends
      if (isSendingQuotation) {
        console.log('Quotation send already in progress, skipping...');
        return;
      }
      
      setIsSendingQuotation(true);
      
      // For save type, wait for file and then send email
      try {
        // Get the quotation ID from the capture data
        const quotationId = captureInvoiceData?.quotation?.id;
        if (quotationId) {
          // Add a small delay to ensure the upload is complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Wait for the file to be available
          await waitForFile(quotationId, "quotation");
          
          // Send the quotation email
          await sendQuotation(quotationId);
          
          showNotification("success", "Quotation sent to client successfully");
        }
      } catch (error) {
        console.error("Error in post-capture process:", error);
        showNotification("error", "PDF generated but failed to send quotation. Please try again.");
      } finally {
        setIsSendingQuotation(false);
      }
    }else{
      showNotification("success", "Quotation downloaded successfully");
    }
    
    // Only clear the capture data after everything is complete
    // This ensures the component stays mounted during the entire process
    setTimeout(() => {
      setCaptureInvoiceData(null);
      setIsCapturingPdf(false);
    }, 1000);
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
      // If it's already a string with formatting, return as is
      return `MK ${amount}`;
    }
    return `MK ${parseFloat(amount).toLocaleString()}`;
  };
  
  // Status badge component
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "Approved":
        badgeClass = "bg-green-100 text-green-800";
        icon = <CheckCircle size={14} className="mr-1" />;
        break;
      case "Pending":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <Clock size={14} className="mr-1" />;
        break;
      case "Expired":
        badgeClass = "bg-gray-100 text-gray-800";
        icon = <Clock size={14} className="mr-1" />;
        break;
      case "Rejected":
        badgeClass = "bg-red-100 text-red-800";
        icon = <XCircle size={14} className="mr-1" />;
        break;
      case "Converted":
        badgeClass = "bg-blue-100 text-blue-800";
        icon = <CornerDownRight size={14} className="mr-1" />;
        break;
      case "Draft":
        badgeClass = "bg-purple-100 text-purple-800";
        icon = <FileText size={14} className="mr-1" />;
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
    <PermissionGuard permission="quotations.view">   
    <div>
      {/* Success notification */}
      {notification && (
        <div className={`fixed top-6 right-6 ${
          notification.type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 
          'bg-red-100 border-red-500 text-red-700'
        } border-l-4 p-4 rounded shadow-lg z-50 animate-slideIn`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <CheckCircle size={20} className="mr-2" />
            ) : (
              <AlertCircle size={20} className="mr-2" />
            )}
            <div>
              <p className="font-medium">{notification.message}</p>
              {notification.invoiceId && (
                <p className="text-sm">
                  <a 
                    href={`/invoices/${notification.invoiceId}`}
                    className="underline hover:text-blue-600"
                  >
                    View invoice
                  </a>
                </p>
              )}
            </div>
            <button 
              className={`ml-6 ${notification.type === 'success' ? 'text-green-500 hover:text-green-700' : 'text-red-500 hover:text-red-700'}`}
              onClick={() => setNotification(null)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quotations</h1>
        <div className="flex space-x-2">
        {pagePermissions.canCreateQuotations &&(  <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            onClick={handleCreateQuotation}
          >
            <PlusCircle size={16} className="mr-2" />
            New Quotation
          </button>)}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex p-4 border-b border-gray-200 overflow-x-auto">
          <button 
            className={`px-4 py-2 rounded-md mr-2 ${activeTab === "all" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("all")}
          >
            All
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="w-1/3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search quotations..." 
                className="w-full p-2 pl-10 border border-gray-200 rounded-md"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <div className="absolute left-3 top-2.5">
                <Search size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button className="px-4 py-2 border border-gray-200 rounded-md bg-white flex items-center">
                <Filter size={16} className="mr-2 text-gray-500" />
                <span className="text-sm text-gray-700">Filter</span>
                <ChevronDown size={16} className="ml-2 text-gray-500" />
              </button>
              {/* Filter dropdown would go here */}
            </div>
            <div className="relative">
              <button className="px-4 py-2 border border-gray-200 rounded-md bg-white flex items-center">
                <ArrowUpDown size={16} className="mr-2 text-gray-500" />
                <span className="text-sm text-gray-700">Sort</span>
                <ChevronDown size={16} className="ml-2 text-gray-500" />
              </button>
              {/* Sort dropdown would go here */}
            </div>
            <div>
            {pagePermissions.canExportQuotations &&(   <button 
                className="px-4 py-2 border border-gray-200 rounded-md bg-white flex items-center"
                onClick={handleExportQuotations}
              >
                <Download size={16} className="mr-2 text-gray-500" />
                <span className="text-sm text-gray-700">Export</span>
              </button>)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotation #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valid Until
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prepared By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                    No quotations found
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {quotation.quotationNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {quotation.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {quotation.validUntil}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {quotation.client}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {quotation.createdBy?.name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(quotation.createdAt || quotation.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">{quotation.title}</div>
                      {quotation.notes && (
                        <div className="text-xs text-gray-500 mt-1 truncate">{quotation.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(quotation.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={quotation.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button 
                          className="text-green-500 hover:text-green-700"
                          title="Preview Quotation"
                          onClick={() => {
                            setQuotationForPreview(quotation);
                            fetchQuotationForPreview(quotation);
                          }}
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          className="text-gray-500 hover:text-gray-700"
                          title="Print Quotation"
                          onClick={() => handleDownloadQuotation(quotation.id)}
                        >
                          <Printer size={18} />
                        </button>
                        {pagePermissions.canCreateQuotations &&(   <button 
                          className={`text-blue-500 hover:text-blue-700 ${isCapturingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={isCapturingPdf ? "Sending quotation..." : "Send Quotation"}
                          onClick={() => handleSendQuotation(quotation.id)}
                          disabled={isCapturingPdf}
                        >
                          <Send size={18} />
                        </button>)}
                        {quotation.status === "Approved" && pagePermissions.canConvertQuotations &&(
                          <button 
                            className="text-green-500 hover:text-green-700"
                            title="Convert to Invoice"
                            onClick={() => handleConvertToInvoice(quotation)}
                          >
                            <CornerDownRight size={18} />
                          </button>
                        )}
                        {quotation.status !== "Converted" && pagePermissions.canUpdateQuotations &&(
                          <>
                            <button 
                              className="text-yellow-500 hover:text-yellow-700"
                              title="Edit Quotation"
                              onClick={() => handleEditQuotation(quotation)}
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              className="text-purple-500 hover:text-purple-700"
                              title="Duplicate Quotation"
                              onClick={() => handleDuplicateQuotation(quotation.id)}
                            >
                              <Copy size={18} />
                            </button>
                          </>
                        )}
                        {quotation.status === "Draft" && pagePermissions.canDeleteQuotations &&(
                          <button 
                            className="text-red-500 hover:text-red-700"
                            title="Delete Quotation"
                            onClick={() => handleDeleteQuotation(quotation.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{filteredQuotations.length > 0 ? ((currentPage - 1) * 10) + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * 10, filteredQuotations.length)}</span> of <span className="font-medium">{filteredQuotations.length}</span> quotations
          </div>
          <div className="flex space-x-2">
            <button 
              className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                className={`px-3 py-1 border border-gray-200 rounded-md text-sm ${currentPage === page ? 'bg-blue-50' : 'bg-white'}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button 
              className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-gray-100 p-3 mr-4">
              <FileText size={24} className="text-gray-600" />
            </div>
            <div>
              <div className="text-lg font-bold">{formatCurrency(statistics.summary?.totalValue || 0)}</div>
              <div className="text-sm text-gray-500">All Quotations</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.summary?.totalQuotations || 0} quotation{(statistics.summary?.totalQuotations || 0) !== 1 ? 's' : ''} in total
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-blue-100 p-3 mr-4">
              <CornerDownRight size={24} className="text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-bold">{formatCurrency(statistics.converted?.total || 0)}</div>
              <div className="text-sm text-gray-500">Converted to Invoice</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.converted?.count || 0} quotation{statistics.converted?.count !== 1 ? 's' : ''} converted to invoice
          </div>
        </div>
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <div className="rounded-full bg-blue-100 p-2 mr-3">
                <CornerDownRight size={20} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">Convert to Invoice</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                You are about to convert quotation <span className="font-medium">{selectedQuotation.quotationNumber}</span> to an invoice. 
                This will create a new invoice and mark the quotation as converted.
              </p>
              
              <div className="bg-gray-50 p-4 rounded-md mb-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">Client:</div>
                  <div className="font-medium">{selectedQuotation.client}</div>
                  
                  <div className="text-gray-500">Description:</div>
                  <div className="font-medium">{selectedQuotation.title}</div>
                  
                  <div className="text-gray-500">Amount:</div>
                  <div className="font-medium">{formatCurrency(selectedQuotation.amount)}</div>
                </div>
              </div>
              
              <div className="flex items-center text-sm bg-yellow-50 text-yellow-800 p-3 rounded">
                <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                <span>This action cannot be undone. The invoice will need to be deleted separately if created in error.</span>
              </div>
            </div>
            
            <div className="flex justify-between space-x-4">
              <div className="flex-1">
                <button 
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={cancelConversion}
                >
                  Cancel
                </button>
              </div>
              <div className="flex-1">
                <button 
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
                  onClick={confirmConversion}
                  disabled={conversionLoading}
                >
                  {conversionLoading ? (
                    <>
                      <span className="animate-spin mr-2">⌛</span>
                      Converting...
                    </>
                  ) : (
                    <>
                      <CornerDownRight size={16} className="mr-2" />
                      Convert to Invoice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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


      {/* Enhanced: Quotation Preview Modal from Project B */}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Quotation Preview</h2>
              <div className="flex items-center space-x-3">
                {previewQuotationData && (
                  <button
                    className="px-3 py-2 bg-blue-600 text-white rounded-md flex items-center text-sm"
                    onClick={() => handleDownloadQuotation(quotationForPreview.id)}
                  >
                    <Download size={16} className="mr-2" />
                    Download
                  </button>
                )}
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setPreviewModalOpen(false);
                    setPreviewQuotationData(null);
                  }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
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
                  <p>Loading quotation preview...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCapturingPdf && !captureInvoiceData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <p>Preparing quotation for download...</p>
            </div>
          </div>
        </div>
      )}
      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: translateX(100%); 
          }
          to { 
            opacity: 1; 
            transform: translateX(0); 
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
    </PermissionGuard>
  );
};

export default QuotationsPage;
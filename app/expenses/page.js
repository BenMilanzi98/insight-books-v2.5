"use client";
import { scanReceipt } from "@/lib/receipt-scanner";
import { useState, useRef, useEffect } from "react";
import ExpensePartialPaymentModal from "@/components/ExpensePartialPaymentModal";
import ExpensePaymentHistory from "@/components/ExpensePaymentHistory";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  FileText,
  Edit,
  Trash2,
  ArrowUpDown,
  FilePlus,
  Camera,
  Upload,
  MoreHorizontal,
  CheckCircle,
  Clock,
  XCircle,
  BarChart,
  X,
  CreditCard,
  Image as ImageIcon,
  File,
  Paperclip,
  Eye,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  History,
  Package,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { 
  fetchExpenses, 
  createExpense, 
  updateExpense, 
  deleteExpense,
  uploadAttachment,
  deleteAttachment,
  getExpenseStatistics,
  createExpenseWithAttachments,
  exportExpenses,
  batchDeleteExpenses,
  fetchDeletedExpenses,
  restoreExpense
} from "@/app/services/expenseService";
import ExpenseModal from "@/components/Expenses/ExpenseModal";
import RecurringExpenseModal from "@/components/Expenses/RecurringExpenseModal";
import HistoricalExpenseUpload from "@/components/Expenses/HistoricalExpenseUpload";
import HistoricalExpenseModal from "@/components/Expenses/HistoricalExpenseModal";
import { createRecurringExpense } from "@/app/services/recurringExpenseService";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import COGSManagement from "@/app/cogs/page";
import COGSSettlementModal from "@/components/COGSSettlementModal";
import COGSSummaryChart from "@/components/COGSSummaryChart";
import COGSExpensesTable from "@/components/COGSExpensesTable";

const ExpensesPage = () => {
  // State management
  const [mainTab, setMainTab] = useState("expenses"); // Main tab: "expenses" or "cogs"
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expenses, setExpenses] = useState([]);
  const [recurringExpenseModalOpen, setRecurringExpenseModalOpen] = useState(false);
  const [isSubmittingRecurring, setIsSubmittingRecurring] = useState(false);
  const [historicalExpenseModalOpen, setHistoricalExpenseModalOpen] = useState(false);
  const [isSubmittingHistorical, setIsSubmittingHistorical] = useState(false);
  
  // Payment modal states
  const [partialPaymentModalOpen, setPartialPaymentModalOpen] = useState(false);
  const [selectedExpenseForPayment, setSelectedExpenseForPayment] = useState(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  
  const [statistics, setStatistics] = useState({
    total: { count: 0, amount: '0' },
    approved: { count: 0, amount: '0' },
    pending: { count: 0, amount: '0' },
    rejected: { count: 0, amount: '0' },
    byCategory: []
  });
  const [categoryPagination, setCategoryPagination] = useState({
    currentPage: 1,
    itemsPerPage: 6
  });
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1
  });
  const [scannedReceipt, setScannedReceipt] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [receiptVerifyModalOpen, setReceiptVerifyModalOpen] = useState(false);
  // File upload related states
  const fileInputRef = useRef(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewReceiptModalOpen, setViewReceiptModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [selectedPreviewOpen, setSelectedPreviewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  // Batch operations state
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDeletedExpenses, setShowDeletedExpenses] = useState(false);
  const [deletedExpenses, setDeletedExpenses] = useState([]);
  
  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteType, setDeleteType] = useState('single'); // 'single' or 'batch'
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  
  // Restore modal states
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreType, setRestoreType] = useState('single'); // 'single' or 'batch'
  const [expenseToRestore, setExpenseToRestore] = useState(null);
  
  // Expense modal states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState("view"); // view, create, edit
  const [selectedExpenseForModal, setSelectedExpenseForModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pagePermissions, setPagePermissions] = useState({ 
    canApproveExpenses: false,
    canCreateExpenses: false,
    canDeleteExpenses:false, 
    canExportExpenses:false,  
    canUpdateExpenses:false, 
  });       
  const [categories, setCategories] = useState([]); // NEW: Categories state
  
  // COGS Management State
  const [cogsSummary, setCogsSummary] = useState(null);
  const [cogsExpenses, setCogsExpenses] = useState([]);
  const [cogsSettlementModalOpen, setCogsSettlementModalOpen] = useState(false);
  const [isSettlingCogs, setIsSettlingCogs] = useState(false);
  const [cogsSettlementSuccess, setCogsSettlementSuccess] = useState(false);
  const [cogsActiveTab, setCogsActiveTab] = useState("summary"); // summary, expenses, settlement
  const [recordedCogsAmount, setRecordedCogsAmount] = useState(0);
  const [lastRecordedCogsTotal, setLastRecordedCogsTotal] = useState(0);
  const [isRecordingCogs, setIsRecordingCogs] = useState(false);
  const [cogsRecordingSuccess, setCogsRecordingSuccess] = useState(false);
  
  useEffect(() => {
    const fetchPermissions = async () => { 
      const canApproveExpenses = await getPermission("expenses.approve");
      const canCreateExpenses = await getPermission("expenses.create");
      const canDeleteExpenses = await getPermission("expenses.delete");
      const canExportExpenses = await getPermission("expenses.export");  
      const canUpdateExpenses = await getPermission("expenses.update"); 
  
      setPagePermissions({ 
        canApproveExpenses,
        canCreateExpenses,
        canDeleteExpenses, 
        canExportExpenses,  
        canUpdateExpenses, 
        });
    };
  
    fetchPermissions();

    // Load recorded COGS amount from localStorage
    const savedRecordedAmount = localStorage.getItem('recordedCogsAmount');
    const savedLastRecordedTotal = localStorage.getItem('lastRecordedCogsTotal');
    if (savedRecordedAmount) {
      setRecordedCogsAmount(parseFloat(savedRecordedAmount));
    }
    if (savedLastRecordedTotal) {
      setLastRecordedCogsTotal(parseFloat(savedLastRecordedTotal));
    }
  }, []);
  // Sample expense categories
  const expenseCategories = [
    "Office Supplies",
    "Travel",
    "Meals & Entertainment",
    "Utilities",
    "Software Subscription",
    "Advertising",
    "Rent",
    "Equipment",
    "Professional Services",
    "Pension"
    ,"Gratuity"
  ];
  useEffect(() => {
    if (isScanning) {
      console.log("Setting up test progress updates");
      
      // If nothing happens after 5 seconds, show test progress
      const testTimer = setTimeout(() => {
        console.log("Starting test progress updates");
        let testProgress = 0;
        
        const testInterval = setInterval(() => {
          testProgress += 10;
          console.log(`Test progress: ${testProgress}%`);
          
          setScanningProgress(testProgress);
          
          if (testProgress >= 100) {
            clearInterval(testInterval);
          }
        }, 1000);
        
        // Clean up the interval after 15 seconds
        setTimeout(() => {
          clearInterval(testInterval);
        }, 15000);
      }, 5000);
      
      return () => {
        clearTimeout(testTimer);
      };
    }
  }, [isScanning]);
  // Load expenses and statistics on initial render and when filters change
  useEffect(() => {
    loadExpenses();
    loadStatistics();
  }, [activeTab, selectedCategory, pagination.page, showDeletedExpenses]);
  
  // Handle search query changes with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      loadExpenses();
    }, 500);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);
  
  // Close modals when escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedPreviewOpen) setSelectedPreviewOpen(false);
        else if (viewReceiptModalOpen) setViewReceiptModalOpen(false);
        else if (uploadModalOpen) setUploadModalOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uploadModalOpen, viewReceiptModalOpen, selectedPreviewOpen]);
  
  // Disable body scroll when modal is open
  useEffect(() => {
    if (uploadModalOpen || viewReceiptModalOpen || selectedPreviewOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [uploadModalOpen, viewReceiptModalOpen, selectedPreviewOpen]);
  
  // Load expense data from the API
  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (showDeletedExpenses) {
        // Load deleted expenses
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          search: searchQuery || null
        };
        
        const response = await fetchDeletedExpenses(params);
        setDeletedExpenses(response.expenses);
        setPagination({
          page: response.pagination.page,
          limit: response.pagination.limit,
          totalCount: response.pagination.total,
          totalPages: response.pagination.pages
        });
      } else {
        // Load regular expenses (exclude deleted ones)
        let statusFilter = null;
        if (activeTab === 'pending') statusFilter = 'Pending';
        if (activeTab === 'approved') statusFilter = 'Approved';
        if (activeTab === 'rejected') statusFilter = 'Rejected';
        
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          sortBy: 'date',
          sortOrder: 'desc',
          status: statusFilter,
          category: selectedCategory === 'all' ? null : selectedCategory,
          search: searchQuery || null,
          includeDeleted: false // Explicitly exclude deleted expenses
        };
        
        const response = await fetchExpenses(params);
        setExpenses(response.expenses);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error("Error loading expenses:", error);
      setError("Failed to load expenses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle batch delete with confirmation
  const handleBatchDelete = async () => {
    if (selectedExpenses.length === 0) return;

    setExpenseToDelete(selectedExpenses);
    setDeleteType('batch');
    setDeleteReason('');
    setDeleteModalOpen(true);
  };

  // Handle confirmed deletion from modal
  const handleConfirmDelete = async () => {
    if (!deleteReason.trim()) return;

    try {
      if (deleteType === 'single') {
        await deleteExpense(expenseToDelete, deleteReason.trim());
        setSuccessMessage('Expense deleted successfully');
      } else {
        await batchDeleteExpenses(expenseToDelete, deleteReason.trim());
        setSuccessMessage(`${expenseToDelete.length} expenses deleted successfully`);
      }
      
      await loadExpenses();
      setSelectedExpenses([]);
      setDeleteModalOpen(false);
      setDeleteReason('');
      setExpenseToDelete(null);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error deleting expense(s):', error);
      alert('Failed to delete expense(s). Please try again.');
    }
  };

  // Handle batch restore with confirmation
  const handleBatchRestore = async () => {
    if (selectedExpenses.length === 0) return;

    setExpenseToRestore(selectedExpenses);
    setRestoreType('batch');
    setRestoreReason('');
    setRestoreModalOpen(true);
  };

  // Handle restore expense with confirmation
  const handleRestoreExpense = async (expenseId) => {
    setExpenseToRestore(expenseId);
    setRestoreType('single');
    setRestoreReason('');
    setRestoreModalOpen(true);
  };

  // Handle confirmed restoration from modal
  const handleConfirmRestore = async () => {
    if (!restoreReason.trim()) return;

    try {
      if (restoreType === 'single') {
        await restoreExpense(expenseToRestore, restoreReason.trim());
        setSuccessMessage('Expense restored successfully');
      } else {
        // Restore each expense in batch
        for (const expenseId of expenseToRestore) {
          await restoreExpense(expenseId, restoreReason.trim());
        }
        setSuccessMessage(`${expenseToRestore.length} expenses restored successfully`);
      }
      
      await loadExpenses();
      setSelectedExpenses([]);
      setRestoreModalOpen(false);
      setRestoreReason('');
      setExpenseToRestore(null);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error restoring expense(s):', error);
      alert('Failed to restore expense(s). Please try again.');
    }
  };

  // Handle individual delete with confirmation
  const handleDeleteExpenseWithConfirmation = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense? This action can be undone later by restoring from the deleted expenses view.')) {
      return;
    }
    
    const reason = prompt('Please provide a reason for deleting this expense:') || 'Manual deletion';
    
    try {
      await deleteExpense(expenseId, reason);
      
      // Remove from expenses list
      setExpenses(expenses.filter(expense => expense.id !== expenseId));
      
      // Refresh statistics
      loadStatistics();
      
      alert('Expense deleted successfully');
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense: ' + error.message);
    }
  };

  // Handle expense selection
  const handleExpenseSelect = (expenseId) => {
    if (selectedExpenses.includes(expenseId)) {
      setSelectedExpenses(selectedExpenses.filter(id => id !== expenseId));
    } else {
      setSelectedExpenses([...selectedExpenses, expenseId]);
    }
  };

  // Handle select all expenses
  const handleSelectAll = () => {
    if (selectedExpenses.length === expenses.length) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(expenses.map(expense => expense.id));
    }
  };
  
  // Load statistics data from the API
  const loadStatistics = async (forceRefresh = false) => {
    try {
      setIsLoadingStatistics(true);
      // Add cache-busting parameter when force refreshing
      const params = forceRefresh ? { _t: Date.now() } : {};
      const stats = await getExpenseStatistics(params);
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
      // Don't set error state for statistics, just log it
    } finally {
      setIsLoadingStatistics(false);
    }
  };
  
  // Handle receipt upload
// Update your handleFileUpload function to ensure progress updates affect the UI
const handleFileUpload = async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  // Process the files normally first
  processFiles(files);
  
  // If it's an image, try to scan it for receipt data
  const file = files[0]; // Use the first file for scanning
  if (file.type.startsWith('image/')) {
    try {
      // // Set scanning status
      // setIsScanning(true);
      // setScanningProgress(0);
      
      // // Show a scanning notification
      // setUploadModalOpen(true);
      
      // // Define a clear lastProgress variable in closure scope to track changes
      // let lastProgress = 0;
      
      // // Define the progress callback
      // const updateProgress = (progress) => {
      //   // Only log and update if progress has increased
      //   if (progress > lastProgress) {
      //     console.log(`Updating progress: ${lastProgress}% -> ${progress}%`);
      //     lastProgress = progress;
          
      //     // Important: Use this form to force React to update
      //     setScanningProgress((prevProgress) => {
      //       // If new progress is smaller than what we have, keep the higher value
      //       return Math.max(prevProgress, progress);
      //     });
          
      //     // As a backup, directly update the DOM
      //     requestAnimationFrame(() => {
      //       const progressBar = document.getElementById('scan-progress-bar');
      //       if (progressBar) {
      //         progressBar.style.width = `${progress}%`;
      //       }
            
      //       const progressText = document.getElementById('scan-progress-text');
      //       if (progressText) {
      //         progressText.innerText = `${progress}% complete`;
      //       }
      //     });
      //   }
      // };
      
      // // Scan the receipt with our progress callback
      // const receiptData = await scanReceipt(file, updateProgress);
      
      // // Set the scanned data
      // setScannedReceipt({
      //   ...receiptData,
      //   file: file,
      //   previewUrl: URL.createObjectURL(file)
      // });
      
      // // Open the verification modal
      // setReceiptVerifyModalOpen(true);
      
      // // Close the upload modal
      // setUploadModalOpen(false);
    } catch (error) {
      console.error("Error scanning receipt:", error);
      alert("Failed to scan receipt. You can still upload it normally.");
    } finally {
      setIsScanning(false);
    }
  }
};
  const handleReceiptVerify = async (verifiedData) => {
    try {
      setIsSubmitting(true);
      
      // Create a FormData object
      const formData = new FormData();
      
      // Add the verified expense data
      formData.append('data', JSON.stringify(verifiedData));
      
      // Add the receipt image
      if (scannedReceipt.file) {
        formData.append('file-0', scannedReceipt.file);
      }
      
      // Call the API to create the expense with attachment
      const response = await fetch('/api/expenses/with-attachments', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error creating expense: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Add the new expense to the list
      setExpenses([result.expense, ...expenses]);
      
      // Refresh statistics
      loadStatistics();
      
      // Show success message
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      
      // Close the verification modal
      setReceiptVerifyModalOpen(false);
      
      // Clear the scanned receipt
      setScannedReceipt(null);
    } catch (error) {
      console.error("Error creating expense:", error);
      alert("Failed to create expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleRecurringExpenseSubmit = async (formData) => {
    setIsSubmittingRecurring(true);
    
    try {
      const result = await createRecurringExpense(formData);
      
      // Show success message
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      
      // Close the modal
      setRecurringExpenseModalOpen(false);
      
      // You might want to redirect to a recurring expenses page or show a confirmation
      console.log("Recurring expense created:", result);
      
      // Optional: Show a toast message or redirect
      alert("Recurring expense created successfully! It will automatically generate expenses according to your schedule.");
      
    } catch (error) {
      console.error("Error creating recurring expense:", error);
      alert("Failed to create recurring expense. Please try again.");
    } finally {
      setIsSubmittingRecurring(false);
    }
  };
  const handleRecurringExpense = () => {
    setRecurringExpenseModalOpen(true);
  };

  // Handle historical expense submission
  const handleHistoricalExpenseSubmit = async (formData) => {
    setIsSubmittingHistorical(true);
    
    try {
      const result = await createExpense(formData);
      
      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh expenses and statistics
      await loadExpenses();
      await loadStatistics(true); // Force refresh statistics
      
      // Show success message
      setSuccessMessage('Historical expense created successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Close modal
      setHistoricalExpenseModalOpen(false);
    } catch (error) {
      console.error("Error creating historical expense:", error);
      alert("Failed to create historical expense. Please try again.");
    } finally {
      setIsSubmittingHistorical(false);
    }
  };
  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  // Handle drag leave
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    processFiles(files);
  };
  
  // Process uploaded files
  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    
    // Simulate uploading state for better UX
    setIsUploading(true);
    
    setTimeout(() => {
      const newFiles = Array.from(files).map((file, index) => {
        // Generate a preview URL for images
        const previewUrl = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : null;
        
        // Format file size
        const size = formatFileSize(file.size);
        
        return {
          id: `upload-${Date.now()}-${index}`,
          file,
          name: file.name,
          type: file.type,
          size,
          previewUrl
        };
      });
      
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      setIsUploading(false);
    }, 500); // Small delay for UX
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  };
  
  // Remove file from upload list
  const removeFile = (fileId) => {
    const updatedFiles = uploadedFiles.filter(file => file.id !== fileId);
    setUploadedFiles(updatedFiles);
  };
  
  // Remove attachment from expense
  const handleDeleteAttachment = async (expenseId, attachmentId) => {
    try {
      await deleteAttachment(expenseId, attachmentId);
      
      // Update local state
      const updatedExpenses = expenses.map(exp => {
        if (exp.id === expenseId) {
          return {
            ...exp,
            attachments: exp.attachments.filter(att => att.id !== attachmentId)
          };
        }
        return exp;
      });
      
      setExpenses(updatedExpenses);
      
      // If we're in the view mode and there are no more attachments, close the modal
      if (viewReceiptModalOpen) {
        const expense = updatedExpenses.find(e => e.id === expenseId);
        if (expense.attachments.length === 0) {
          setViewReceiptModalOpen(false);
        }
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert("Failed to delete attachment. Please try again.");
    }
  };
  
  // Get file icon based on mime type
  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };
  
  // Open file upload dialog
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Open upload modal for a specific expense
  const openUploadModal = (expense) => {
    setSelectedExpense(expense);
    setUploadedFiles([]);
    setUploadModalOpen(true);
  };

  // Open receipt viewer for a specific expense
  const viewReceipts = (expense) => {
    setSelectedExpense(expense);
    setViewReceiptModalOpen(true);
  };
  
  // Open individual attachment preview
  const openAttachmentPreview = (attachment) => {
    setSelectedAttachment(attachment);
    setSelectedPreviewOpen(true);
  };
  
  // Handle individual expense deletion
  const handleDeleteExpense = async (expenseId) => {
    setExpenseToDelete(expenseId);
    setDeleteType('single');
    setDeleteReason('');
    setDeleteModalOpen(true);
  };
  
  // Handle viewing expense details
  const handleViewExpense = (expense) => {
    setSelectedExpenseForModal(expense);
    setExpenseModalMode("view");
    setExpenseModalOpen(true);
  };
  
  // Handle creating new expense
  const handleCreateExpense = () => {
    setSelectedExpenseForModal(null);
    setExpenseModalMode("create");
    setExpenseModalOpen(true);
  };
  
  // Handle editing expense
  const handleEditExpense = (expense) => {
    setSelectedExpenseForModal(expense);
    setExpenseModalMode("edit");
    setExpenseModalOpen(true);
  };
  
  // Handle expense form submission
  const handleExpenseSubmit = async (formData) => {
    setIsSubmitting(true);
    
    try {
      if (expenseModalMode === "create") {
        // Create new expense
        const result = await createExpense(formData);
        
        // Add to expenses list
        setExpenses([result.expense, ...expenses]);
        
        // Show success message
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } else if (expenseModalMode === "edit") {
        // Update existing expense
        const result = await updateExpense(selectedExpenseForModal.id, formData);
        
        // Update expenses list
        setExpenses(expenses.map(exp => 
          exp.id === result.expense.id ? result.expense : exp
        ));
      }
      
      // Close modal
      setExpenseModalOpen(false);
      
      // Refresh statistics
      loadStatistics();
    } catch (error) {
      console.error("Error submitting expense:", error);
      alert("Failed to save expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Complete the upload process and attach to expense
  const completeUpload = async () => {
    if (uploadedFiles.length === 0) return;
    
    // Start uploading
    setIsUploading(true);
    
    try {
      if (selectedExpense) {
        // Upload attachments to existing expense
        const formData = new FormData();
        uploadedFiles.forEach((file, index) => {
          // formData.append(`file-${index}`, file.file);
          formData.append('file', file.file);
        });
        
        // Upload the files
        const result = await uploadAttachment(selectedExpense.id, formData);
        
        // Update the expense with new attachments
        const updatedExpenses = expenses.map(exp => {
          if (exp.id === selectedExpense.id) {
            return {
              ...exp,
              attachments: [...exp.attachments, ...result.attachments]
            };
          }
          return exp;
        });
        
        setExpenses(updatedExpenses);
      } else {
        // Create new expense with attachments
        // Collect uploaded files
        const files = uploadedFiles.map(file => file.file);
        
        // Create a basic expense object with all REQUIRED fields
        const newExpense = {
          description: "New expense from receipt", 
          amount: 0, 
          date: new Date().toISOString().split('T')[0], // Today's date - CRITICAL field
          category: expenseCategories.length > 0 ? expenseCategories[0] : "", // Default to first category or empty
          status: "Pending" // Default status
        };
        
        // Create expense with attachments by sending proper JSON for expense data
        const formData = new FormData();
        
        // Add expense data as a properly formatted JSON string
        formData.append('data', JSON.stringify(newExpense));
        
        // Add attachments
        files.forEach((file, index) => {
          formData.append(`file-${index}`, file);
        });
        
        // Use fetch directly since createExpenseWithAttachments may have issues
        const response = await fetch('/api/expenses/with-attachments', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error creating expense with attachments: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Add the new expense to the list
        setExpenses([result.expense, ...expenses]);
        
        // Refresh statistics
        loadStatistics();
      }
      
      // Show success message
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);
      
      // Close the modal
      setUploadModalOpen(false);
    } catch (error) {
      console.error("Error uploading attachments:", error);
      alert("Failed to upload attachments. Please try again. Error: " + error.message);
    } finally {
      setIsUploading(false);
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

  // Handle partial payment
  const handlePartialPayment = (expense) => {
    setSelectedExpenseForPayment(expense);
    setPartialPaymentModalOpen(true);
  };

  // Handle payment success
  const handlePaymentSuccess = (data) => {
    // Refresh expenses list to show updated payment status
    loadExpenses();
    setSuccessMessage('Payment processed successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Toggle payment history
  const togglePaymentHistory = (expense) => {
    setSelectedExpenseForPayment(expense);
    setShowPaymentHistory(!showPaymentHistory);
  };

  // Helper function to check if expense is eligible for partial payment
  const isEligibleForPartialPayment = (expense) => {
    return expense.paymentStatus === 'Pending' || expense.paymentStatus === 'Partially';
  };
  
  // Handle export
  const handleExport = async (format = 'csv') => {
    try {
      // Create filter object based on current filters
      const filters = {
        status: activeTab === 'all' ? null : activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
        category: selectedCategory === 'all' ? null : selectedCategory,
        search: searchQuery || null
      };
      
      const blob = await exportExpenses(filters, format);
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `expenses-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting expenses:", error);
      alert("Failed to export expenses. Please try again.");
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "Approved":
        badgeClass = "bg-green-100 text-green-800";
        icon = <CheckCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      case "Pending":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <Clock className="w-3.5 h-3.5 mr-1" />;
        break;
      case "Rejected":
        badgeClass = "bg-red-100 text-red-800";
        icon = <XCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      default:
        badgeClass = "bg-gray-100 text-gray-800";
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center whitespace-nowrap ${badgeClass}`}>
        {icon}
        {status}
      </span>
    );
  };

  // Payment status badge component
  const PaymentStatusBadge = ({ paymentStatus, paidAmount, totalAmount }) => {
    const getPaymentStatusColor = (status) => {
      switch (status) {
        case 'Fully paid':
          return 'bg-green-100 text-green-800';
        case 'Partially':
          return 'bg-yellow-100 text-yellow-800';
        case 'Pending':
          return 'bg-red-100 text-red-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    const formatAmount = (amount) => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    };

    return (
      <div className="flex flex-col items-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(paymentStatus)}`}>
          {paymentStatus || 'Fully paid'}
        </span>
        {paymentStatus === 'Partially' && paidAmount && totalAmount && (
          <span className="text-xs text-gray-500 mt-1">
            MK {formatAmount(paidAmount)} / MK {formatAmount(totalAmount)}
          </span>
        )}
      </div>
    );
  };

  // NEW: Load categories from API
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?type=expense');
      if (response.ok) {
        const data = await response.json();
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Category pagination functions
  const getTotalPages = () => {
    return Math.ceil(statistics.byCategory.length / categoryPagination.itemsPerPage);
  };

  const getCurrentPageCategories = () => {
    const startIndex = (categoryPagination.currentPage - 1) * categoryPagination.itemsPerPage;
    const endIndex = startIndex + categoryPagination.itemsPerPage;
    return statistics.byCategory.slice(startIndex, endIndex);
  };

  const handleNextPage = () => {
    const totalPages = getTotalPages();
    if (totalPages === 0) return;
    
    setCategoryPagination(prev => ({
      ...prev,
      currentPage: prev.currentPage >= totalPages ? 1 : prev.currentPage + 1
    }));
  };

  const handlePreviousPage = () => {
    const totalPages = getTotalPages();
    if (totalPages === 0) return;
    
    setCategoryPagination(prev => ({
      ...prev,
      currentPage: prev.currentPage <= 1 ? totalPages : prev.currentPage - 1
    }));
  };

  // Load COGS data
  const loadCogsData = async () => {
    try {
      const [summaryResponse, expensesResponse] = await Promise.all([
        fetch('/api/expenses/cogs-summary'),
        fetch('/api/expenses/cogs-settlement')
      ]);
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setCogsSummary(summaryData);
      }
      
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json();
        setCogsExpenses(expensesData.expenses || []);
      }
    } catch (error) {
      console.error('Error loading COGS data:', error);
    }
  };

  // Handle COGS settlement
  const handleCogsSettlement = async (settlementData) => {
    try {
      setIsSettlingCogs(true);
      
      // If no amount is provided, use the total COGS amount
      const finalSettlementData = {
        ...settlementData,
        amount: settlementData.amount || cogsSummary?.summary?.totalCOGS || 0,
        description: settlementData.description || `Total COGS Settlement - MK ${(cogsSummary?.summary?.totalCOGS || 0).toLocaleString()}`
      };
      
      const response = await fetch('/api/expenses/cogs-settlement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalSettlementData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create COGS settlement');
      }

      setCogsSettlementSuccess(true);
      setCogsSettlementModalOpen(false);
      
      // Refresh COGS data
      await loadCogsData();
      
      // Show success message
      setTimeout(() => {
        setCogsSettlementSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('Error settling COGS:', error);
      alert(`Failed to settle COGS: ${error.message}`);
    } finally {
      setIsSettlingCogs(false);
    }
  };

  // Handle recording COGS as expense (new functionality)
  const handleRecordCogsAsExpense = async () => {
    try {
      setIsRecordingCogs(true);
      
      const totalCogsAmount = cogsSummary?.summary?.totalCOGS || 0;
      const newCogsAmount = totalCogsAmount - lastRecordedCogsTotal;
      
      if (newCogsAmount <= 0) {
        alert('No new COGS amount to record as expense');
        return;
      }

      // Create COGS settlement entry (this creates both the expense and COGS settlement)
      const cogsSettlementResponse = await fetch('/api/expenses/cogs-settlement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: newCogsAmount,
          description: `COGS Batch Settlement - MK ${newCogsAmount.toLocaleString()}`,
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'cash',
          notes: `COGS batch recording for new transactions. Amount: MK ${newCogsAmount.toLocaleString()}`
        })
      });

      const cogsSettlementData = await cogsSettlementResponse.json();
      
      if (cogsSettlementResponse.ok) {
        // Update recorded amount by adding the new amount
        const newRecordedAmount = recordedCogsAmount + newCogsAmount;
        setRecordedCogsAmount(newRecordedAmount);
        setLastRecordedCogsTotal(totalCogsAmount);
        
        // Save to localStorage
        localStorage.setItem('recordedCogsAmount', newRecordedAmount.toString());
        localStorage.setItem('lastRecordedCogsTotal', totalCogsAmount.toString());
        
        // Show success message
        setCogsRecordingSuccess(true);
        setTimeout(() => {
          setCogsRecordingSuccess(false);
        }, 3000);

        // Refresh both expenses and COGS data
        await Promise.all([
          loadExpenses(),
          loadCogsData()
        ]);
        
        alert(`Successfully recorded MK ${newCogsAmount.toLocaleString()} as COGS batch in both regular expenses and COGS tab!`);
      } else {
        const errorMsg = cogsSettlementData.error || 'Failed to record COGS batch';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error recording COGS as expense:', error);
      alert(`Failed to record COGS expense: ${error.message}`);
    } finally {
      setIsRecordingCogs(false);
    }
  };

  // Function to reset recorded amount when new COGS transactions occur
  const resetRecordedCogsAmount = () => {
    if (window.confirm('Are you sure you want to reset the recorded COGS amount? This will allow you to re-record the same amount.')) {
      setRecordedCogsAmount(0);
      setLastRecordedCogsTotal(0);
      localStorage.removeItem('recordedCogsAmount');
      localStorage.removeItem('lastRecordedCogsTotal');
      alert('Recorded COGS amount has been reset. You can now record the current amount again.');
    }
  };

  // Function to clear all COGS data (for debugging/admin use)
  const clearAllCogsData = () => {
    if (window.confirm('Are you sure you want to clear ALL COGS data? This will reset everything and cannot be undone.')) {
      setRecordedCogsAmount(0);
      setLastRecordedCogsTotal(0);
      localStorage.removeItem('recordedCogsAmount');
      localStorage.removeItem('lastRecordedCogsTotal');
      setCogsRecordingSuccess(false);
      alert('All COGS data has been cleared. The system will start fresh.');
    }
  };


  // Load data on component mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadExpenses(),
        loadStatistics(),
        loadCategories() // NEW: Load categories
      ]);
    };
    
    initializeData();
  }, []);

  // Load COGS data when switching to COGS tab
  useEffect(() => {
    if (mainTab === "cogs") {
      loadCogsData();
    }
  }, [mainTab]);

  return (
    <PermissionGuard permission="expenses.view">    
    <div className="p-4 sm:p-6">
      {/* Success notification */}
      {uploadSuccess && (
        <div className="fixed top-6 right-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50 flex items-center animate-fadeIn max-w-md">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <div className="mr-2 flex-grow">
            <p className="font-medium">Receipts successfully attached!</p>
            <p className="text-sm">{selectedExpense ? `Expense ID: ${selectedExpense.id}` : 'New expense created'}</p>
          </div>
          <button 
            className="text-green-700 hover:text-green-800 flex-shrink-0"
            onClick={() => setUploadSuccess(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">
          {mainTab === "expenses" ? "Expense Tracking" : "Cost of Goods Sold (COGS) Management"}
        </h1>
        <div className="flex flex-wrap gap-2">
        {pagePermissions.canCreateExpenses && mainTab === "expenses" && (  <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
              onClick={handleCreateExpense}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              <span className="whitespace-nowrap">Add Expense</span>
            </button>)}
            {pagePermissions.canExportExpenses && mainTab === "expenses" && (<button 
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center"
            onClick={() => handleExport('csv')}
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="whitespace-nowrap">Export CSV</span>
          </button>)}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setMainTab("expenses")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                mainTab === "expenses"
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Expenses
            </button>
            <button
              onClick={() => setMainTab("cogs")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                mainTab === "cogs"
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="h-4 w-4 mr-2" />
              Cost of Goods
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {mainTab === "expenses" && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-blue-100 p-3 mr-4 flex-shrink-0">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-bold">MK {statistics.total.amount}</div>
              <div className="text-sm text-gray-500">Total Expenses</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.total.count} expenses recorded this month
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-green-100 p-3 mr-4 flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-lg font-bold">MK {statistics.approved.amount}</div>
              <div className="text-sm text-gray-500">Approved Expenses</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.approved.count} approved expenses
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="flex p-2 sm:p-4 border-b border-gray-200 overflow-x-auto">
          <button 
            className={`px-3 py-2 rounded-md mr-2 text-sm ${activeTab === "all" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("all")}
          >
            All Expenses
          </button>
          <button 
            className={`px-3 py-2 rounded-md mr-2 text-sm ${activeTab === "historical" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => setActiveTab("historical")}
          >
            Historical Import
          </button>
        </div>

        {activeTab !== "historical" && (
        <div className="p-4 border-b border-gray-200">
          {/* Batch Operations Bar */}
          {selectedExpenses.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-800">
                  {selectedExpenses.length} expense{selectedExpenses.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedExpenses([])}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                {!showDeletedExpenses && pagePermissions.canDeleteExpenses && (
                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected ({selectedExpenses.length})
                  </button>
                )}
                {showDeletedExpenses && (
                  <button
                    onClick={handleBatchRestore}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Restore Selected ({selectedExpenses.length})
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <div className="w-full md:w-1/3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search expenses..." 
                  className="w-full p-2 pl-10 border border-gray-200 rounded-md"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="relative">
                <select 
                  className="appearance-none bg-white border border-gray-200 rounded-md px-3 py-2 pr-8 text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {expenseCategories.map((category, index) => (
                    <option key={index} value={category}>{category}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  className="px-3 py-2 border border-gray-200 rounded-md bg-white text-sm flex items-center hover:bg-gray-50"
                  onClick={() => setShowDeletedExpenses(!showDeletedExpenses)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {showDeletedExpenses ? 'Show Active' : 'Show Deleted'}
                </button>
                {pagePermissions.canExportExpenses && (
                  <button 
                    className="px-3 py-2 border border-gray-200 rounded-md bg-white flex items-center text-sm"
                    onClick={() => handleExport('csv')}
                  >
                    <Download className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="text-gray-700">Export</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {activeTab === "historical" ? (
          <div className="p-6">
            <HistoricalExpenseUpload 
              onUploadComplete={async (result) => {
                // Delay to ensure database transaction is fully committed
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Refresh expenses after successful upload
                await loadExpenses();
                await loadStatistics(true); // Force refresh statistics
                
                // Show success message
                setSuccessMessage(`Successfully imported ${result.totalProcessed} historical expenses`);
                setTimeout(() => setSuccessMessage(''), 5000);
              }}
              onSingleExpenseClick={() => setHistoricalExpenseModalOpen(true)}
            />
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-500">Loading expenses...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500">{error}</p>
            <button 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={loadExpenses}
            >
              Try Again
            </button>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No expenses found</h3>
            <p className="text-gray-500 mb-4">
              {activeTab !== "all" || selectedCategory !== "all" || searchQuery 
                ? "Try changing your filters or search query"
                : "Get started by adding your first expense"}
            </p>
            {pagePermissions.canCreateExpenses &&(   <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={handleCreateExpense}
            >
              <PlusCircle className="w-4 h-4 mr-2 inline-block" />
              Add Expense
            </button>)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merchant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Status
                  </th>
                  {!showDeletedExpenses && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  )}
                  {showDeletedExpenses && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deleted At
                    </th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipts
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showDeletedExpenses ? deletedExpenses : expenses).map((expense) => (
                  <tr 
                    key={expense.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedExpenses.includes(expense.id) 
                        ? 'bg-blue-50 border-l-4 border-blue-500' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleExpenseSelect(expense.id)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      <div className="flex items-center">
                        {expense.id}
                        {expense.isHistorical && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <History className="w-3 h-3 mr-1" />
                            Historical
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span className={expense.isHistorical ? 'font-medium text-amber-700' : ''}>
                          {expense.date}
                        </span>
                        {expense.isHistorical && expense.historicalDate && expense.historicalDate !== expense.date && (
                          <span className="text-xs text-gray-400">
                            Created: {(() => {
                              const date = new Date(expense.createdAt);
                              const day = String(date.getDate()).padStart(2, '0');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const year = date.getFullYear();
                              return `${day}-${month}-${year}`;
                            })()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.category}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.merchant || "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {expense.description}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      MK {expense.amount}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <PaymentStatusBadge 
                        paymentStatus={expense.paymentStatus} 
                        paidAmount={expense.paidAmount}
                        totalAmount={expense.amount}
                      />
                    </td>
                    {!showDeletedExpenses && (
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <StatusBadge status={expense.status} />
                      </td>
                    )}
                    {showDeletedExpenses && (
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        {(() => {
                          const date = new Date(expense.deletedAt);
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}-${month}-${year}`;
                        })()}
                      </td>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center items-center space-x-2">
                        {expense.attachments && expense.attachments.length > 0 ? (
                          <>
                            <button 
                              className="text-blue-600 hover:text-blue-800 flex items-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-md p-1"
                              onClick={() => viewReceipts(expense)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              <span>View ({expense.attachments.length})</span>
                            </button>
                            {!showDeletedExpenses && pagePermissions.canUpdateExpenses && (
                              <button 
                                className="text-green-600 hover:text-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 rounded-md p-1"
                                onClick={() => openUploadModal(expense)}
                                title="Add more receipts"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          !showDeletedExpenses && pagePermissions.canUpdateExpenses && (
                            <button 
                              className="text-blue-600 hover:text-blue-800 flex items-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-md p-1"
                              onClick={() => openUploadModal(expense)}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              <span>Add Receipt</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end space-x-2">
                        {!showDeletedExpenses ? (
                          <>
                            {/* Partial Payment Button - Only for pending and partial expenses */}
                            {isEligibleForPartialPayment(expense) && pagePermissions.canUpdateExpenses && (
                              <button 
                                className="text-green-500 hover:text-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 rounded-md p-1"
                                title="Add Partial Payment"
                                onClick={() => handlePartialPayment(expense)}
                              >
                                <CreditCard size={16} />
                              </button>
                            )}
                            
                            {/* Payment History Button - Available for all expenses */}
                              <button 
                                className="text-blue-500 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-md p-1"
                              title="View Payment History"
                              onClick={() => togglePaymentHistory(expense)}
                            >
                              <FileText size={16} />
                            </button>
                            
                            {pagePermissions.canUpdateExpenses && (
                              <button 
                                className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500 rounded-md p-1"
                                title="View Expense Details"
                                onClick={() => handleViewExpense(expense)}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {pagePermissions.canUpdateExpenses && (
                              <button 
                                className="text-yellow-500 hover:text-yellow-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-500 rounded-md p-1"
                                title="Edit Expense"
                                onClick={() => handleEditExpense(expense)}
                              >
                                <Edit className="w-4.5 h-4.5" />
                              </button>
                            )}
                            {pagePermissions.canDeleteExpenses && (
                              <button 
                                className="text-red-500 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 rounded-md p-1"
                                title="Delete Expense"
                                onClick={() => handleDeleteExpense(expense.id)}
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button 
                            className="text-green-500 hover:text-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 rounded-md p-1"
                            title="Restore Expense"
                            onClick={() => handleRestoreExpense(expense.id)}
                          >
                            <RefreshCw className="w-4.5 h-4.5" />
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

        {!isLoading && !error && expenses.length > 0 && (
          <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 gap-4">
            <div className="text-sm text-gray-700 order-2 sm:order-1">
              Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> of <span className="font-medium">{pagination.totalCount}</span> expenses
            </div>
            <div className="flex space-x-2 order-1 sm:order-2">
              <button 
                className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </button>
              {[...Array(pagination.totalPages).keys()].map(page => (
                <button 
                  key={page + 1}
                  className={`px-3 py-1 border border-gray-200 rounded-md bg-white text-sm ${
                    pagination.page === page + 1 ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => handlePageChange(page + 1)}
                >
                  {page + 1}
                </button>
              ))}
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

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <BarChart className="w-5 h-5 mr-2 text-blue-600" />
              Expense by Category
            </h2>
            {statistics.byCategory.length > categoryPagination.itemsPerPage && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePreviousPage}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm text-gray-600">
                  {categoryPagination.currentPage} of {getTotalPages()}
                </span>
                <button
                  onClick={handleNextPage}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {getCurrentPageCategories().map(category => (
              <div key={category.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{category.category}</span>
                  <span>MK {category.amount} ({category.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${category.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
            
            {statistics.byCategory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BarChart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No expense data available</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pagePermissions.canUpdateExpenses && (
              <div 
                className="group border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
              >
                <div className="flex items-center mb-3">
                  <div className="rounded-full bg-blue-100 p-3 mr-3 group-hover:bg-blue-200 transition-colors">
                    <Camera className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Scan Receipt</h3>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-gray-700">Automatically extract details from receipts</p>
              </div>
            )}
            
            {pagePermissions.canUpdateExpenses && (
              <div 
                className="group border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:bg-purple-50 hover:shadow-md cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                onClick={() => {
                  setSelectedExpense(null);
                  setUploadedFiles([]);
                  setUploadModalOpen(true);
                }}
              >
                <div className="flex items-center mb-3">
                  <div className="rounded-full bg-purple-100 p-3 mr-3 group-hover:bg-purple-200 transition-colors">
                    <Upload className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Upload Receipt</h3>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-gray-700">Upload receipt images or PDFs</p>
              </div>
            )}
            
            {pagePermissions.canCreateExpenses && (
              <div 
                className="group border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:bg-green-50 hover:shadow-md cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                onClick={handleRecurringExpense}
              >
                <div className="flex items-center mb-3">
                  <div className="rounded-full bg-green-100 p-3 mr-3 group-hover:bg-green-200 transition-colors">
                    <RefreshCw className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Recurring Expense</h3>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-gray-700">Set up regular, scheduled expenses</p>
              </div>
            )}
            
            {pagePermissions.canExportExpenses && (
              <div 
                className="group border border-gray-200 rounded-xl p-5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                onClick={() => handleExport('csv')}
              >
                <div className="flex items-center mb-3">
                  <div className="rounded-full bg-orange-100 p-3 mr-3 group-hover:bg-orange-200 transition-colors">
                    <BarChart className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Expense Report</h3>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-gray-700">Generate detailed expense reports</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*,.pdf"
        capture="environment" // Enable camera on mobile
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Upload Receipt Modal */}
     {uploadModalOpen && (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 ">
    <div 
      className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fadeInUp"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-5 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold flex items-center">
            <Paperclip className="w-5 h-5 mr-2 text-blue-600" />
            {isScanning ? "Scanning Receipt..." : "Upload Receipts"}
            {selectedExpense && !isScanning && (
              <span className="ml-2 text-sm text-gray-500">for {selectedExpense.id}</span>
            )}
          </h3>
          <button 
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
            onClick={() => setUploadModalOpen(false)}
            disabled={isScanning}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <div className="p-5">
        {isScanning ? (
          <ReceiptScanningStatus progress={scanningProgress} />
        ) : (
          <>
            {/* Drag & Drop Area */}
            <div 
              className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer transition-all ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-lg font-medium mb-1">Drag & drop files here</p>
              <p className="text-sm text-gray-500 mb-3">or click to browse files</p>
              <p className="text-xs text-gray-400">Supports: JPG, PNG, PDF (Max 10MB per file)</p>
            </div>
              
              {/* File Previews */}
              {uploadedFiles.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Uploaded Files ({uploadedFiles.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto p-1 rounded-md">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex-shrink-0 mr-3 text-gray-500">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.size}</p>
                        </div>
                        {file.previewUrl && (
                          <div className="flex-shrink-0 w-12 h-12 rounded border bg-white p-1 mr-2 overflow-hidden">
                            <img 
                              src={file.previewUrl} 
                              alt="Preview" 
                              className="w-full h-full object-cover rounded"
                            />
                          </div>
                        )}
                        <button 
                          className="flex-shrink-0 ml-2 text-red-500 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* If no expense selected, show create new expense option */}
              {!selectedExpense && (
                <div className="mb-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0 mr-3" />
                    <div>
                      <h4 className="font-medium mb-1">No expense selected</h4>
                      <p className="text-sm text-gray-600 mb-2">You can:</p>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="expenseOption" 
                            className="mr-2 h-4 w-4 text-blue-600" 
                            defaultChecked 
                          />
                          <span>Create new expense from these receipts</span>
                        </label>
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="expenseOption" 
                            className="mr-2 h-4 w-4 text-blue-600" 
                          />
                          <span>Attach to an existing expense</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              </>
        )}
      </div>
      
      <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
        <button 
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
          onClick={() => setUploadModalOpen(false)}
          disabled={isScanning}
        >
          Cancel
        </button>
        {!isScanning && (
          <button 
            className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center ${
              (uploadedFiles.length === 0 || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={uploadedFiles.length === 0 || isUploading}
            onClick={completeUpload}
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {selectedExpense ? "Attach to Expense" : "Create Expense with Receipts"}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  </div>
)}

      {/* Receipt Viewer Modal */}
      {viewReceiptModalOpen && selectedExpense && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold flex items-center">
                  <Receipt className="w-5 h-5 mr-2 text-blue-600" />
                  Receipts for {selectedExpense.id}
                  <span className="ml-2 text-sm text-gray-500">
                    ({selectedExpense.attachments.length} {selectedExpense.attachments.length === 1 ? 'receipt' : 'receipts'})
                  </span>
                </h3>
                <div className="flex items-center space-x-2">
                  <button 
                    className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md flex items-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    onClick={() => openUploadModal(selectedExpense)}
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    Add More
                  </button>
                  <button 
                    className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
                    onClick={() => setViewReceiptModalOpen(false)}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedExpense.attachments.map((attachment) => (
                  <div key={attachment.id} className="border rounded-lg overflow-hidden bg-gray-50 shadow-sm hover:shadow transition-shadow">
                    <div className="p-3 border-b bg-white flex justify-between items-center">
                      <div className="truncate mr-2 flex items-center">
                        {getFileIcon(attachment.type)}
                        <span className="font-medium ml-2 text-sm">{attachment.name}</span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {/* <button 
                          className="text-blue-600 hover:text-blue-800 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full" 
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button> */}
                        <a
                            href={attachment.url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
                            title="Download"
                          >
                          <Download className="w-4 h-4" />
                        </a>
                        <button 
                          className="text-red-600 hover:text-red-800 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full" 
                          title="Delete"
                          onClick={() => handleDeleteAttachment(selectedExpense.id, attachment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div 
                      className="h-40 p-4 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => openAttachmentPreview(attachment)}
                    >
                      {attachment.type && attachment.type.startsWith('image/') ? (
                        attachment.url ? (
                          <div className="relative group">
                            <img 
                              src={attachment.url} 
                              alt={attachment.name} 
                              className="max-h-full max-w-full object-contain rounded"
                            />
                            <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black group-hover:bg-opacity-30 transition-all opacity-0 group-hover:opacity-100 rounded">
                              <ExternalLink className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center group">
                            <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            <p className="text-sm text-gray-500">Image preview</p>
                          </div>
                        )
                      ) : attachment.type && attachment.type.includes('pdf') ? (
                        <div className="text-center group">
                          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          <p className="text-sm text-gray-500">PDF document</p>
                        </div>
                      ) : (
                        <div className="text-center group">
                          <File className="w-12 h-12 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          <p className="text-sm text-gray-500">Document</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="px-3 py-2 bg-white text-xs text-gray-500 flex justify-between">
                      <span>{attachment.size}</span>
                      <span>Uploaded: {attachment.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                onClick={() => setViewReceiptModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Receipt Preview */}
      {selectedPreviewOpen && selectedAttachment && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 cursor-zoom-out " 
          style={{zIndex: 9999}}
          onClick={() => setSelectedPreviewOpen(false)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white rounded-full z-10"
            onClick={() => setSelectedPreviewOpen(false)}
          >
            <X className="w-8 h-8" />
          </button>
          
          <div 
            className="w-full max-w-4xl max-h-[90vh] flex items-center justify-center animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedAttachment.type && selectedAttachment.type.startsWith('image/') && selectedAttachment.url ? (
              <img 
                src={selectedAttachment.url} 
                alt={selectedAttachment.name} 
                className="max-h-full max-w-full object-contain rounded shadow-xl"
              />
            ) : selectedAttachment.type && selectedAttachment.type.includes('pdf') ? (
              <div className="bg-white p-12 rounded-lg shadow-xl text-center">
                <FileText className="w-24 h-24 mx-auto mb-4 text-blue-500" />
                <h3 className="text-xl font-bold mb-2">{selectedAttachment.name}</h3>
                <p className="text-gray-600 mb-6">PDF documents cannot be previewed here</p>
                <a 
                  href={selectedAttachment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center mx-auto inline-flex"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF
                </a>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-lg shadow-xl text-center">
                <File className="w-24 h-24 mx-auto mb-4 text-blue-500" />
                <h3 className="text-xl font-bold mb-2">{selectedAttachment.name}</h3>
                <p className="text-gray-600 mb-6">This file type cannot be previewed</p>
                <a 
                  href={selectedAttachment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center mx-auto inline-flex"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download File
                </a>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white px-4 py-2 rounded-full text-sm bg-black bg-opacity-50">
            {selectedAttachment.name} ({selectedAttachment.size})
          </div>
        </div>
      )}

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        expense={selectedExpenseForModal}
        mode={expenseModalMode}
        title={expenseModalMode === "create" ? "Create New Expense" : 
              expenseModalMode === "edit" ? "Edit Expense" : 
              `Expense Details: ${selectedExpenseForModal?.id || ""}`}
        onSubmit={handleExpenseSubmit}
        onDelete={handleDeleteExpense}
        isLoading={isSubmitting}
        categories={categories}
      />
      <RecurringExpenseModal
        isOpen={recurringExpenseModalOpen}
        onClose={() => setRecurringExpenseModalOpen(false)}
        onSubmit={handleRecurringExpenseSubmit}
        categories={categories}
        isLoading={isSubmittingRecurring}
      />
      <ReceiptVerificationModal
        isOpen={receiptVerifyModalOpen}
        onClose={() => {
          setReceiptVerifyModalOpen(false);
          setScannedReceipt(null);
        }}
        receiptData={scannedReceipt}
        onSubmit={handleReceiptVerify}
        isLoading={isSubmitting}
      />
      {/* Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {deleteType === 'single' ? 'Delete Expense' : `Delete ${expenseToDelete?.length} Expenses`}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {deleteType === 'single' 
                    ? 'This action will soft delete the expense. You can restore it later from the deleted expenses view.'
                    : `This action will soft delete ${expenseToDelete?.length} expenses. You can restore them later from the deleted expenses view.`
                  }
                </p>
                
                <div className="mb-4">
                  <label htmlFor="deleteReason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for deletion *
                  </label>
                  <textarea
                    id="deleteReason"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Please provide a reason for deletion..."
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteReason('');
                  setExpenseToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                  deleteReason.trim() 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                onClick={handleConfirmDelete}
                disabled={!deleteReason.trim()}
              >
                {deleteType === 'single' ? 'Delete Expense' : `Delete ${expenseToDelete?.length} Expenses`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restoration Confirmation Modal */}
      {restoreModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <RefreshCw className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {restoreType === 'single' ? 'Restore Expense' : `Restore ${expenseToRestore?.length} Expenses`}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {restoreType === 'single' 
                    ? 'This action will restore the expense and make it active again.'
                    : `This action will restore ${expenseToRestore?.length} expenses and make them active again.`
                  }
                </p>
                
                <div className="mb-4">
                  <label htmlFor="restoreReason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for restoration *
                  </label>
                  <textarea
                    id="restoreReason"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Please provide a reason for restoration..."
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                onClick={() => {
                  setRestoreModalOpen(false);
                  setRestoreReason('');
                  setExpenseToRestore(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                  restoreReason.trim() 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                onClick={handleConfirmRestore}
                disabled={!restoreReason.trim()}
              >
                {restoreType === 'single' ? 'Restore Expense' : `Restore ${expenseToRestore?.length} Expenses`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      {/* Historical Expense Modal */}
      <HistoricalExpenseModal
        isOpen={historicalExpenseModalOpen}
        onClose={() => setHistoricalExpenseModalOpen(false)}
        onSubmit={handleHistoricalExpenseSubmit}
        isSubmitting={isSubmittingHistorical}
      />

      {/* COGS Settlement Modal */}
      <COGSSettlementModal
        isOpen={cogsSettlementModalOpen}
        onClose={() => setCogsSettlementModalOpen(false)}
        onSettle={handleCogsSettlement}
        isLoading={isSettlingCogs}
        totalCOGS={cogsSummary?.summary?.totalCOGS || 0}
      />


      {/* Partial Payment Modal */}
      <ExpensePartialPaymentModal
        isOpen={partialPaymentModalOpen}
        onClose={() => setPartialPaymentModalOpen(false)}
        expense={selectedExpenseForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Payment History Modal */}
      {showPaymentHistory && selectedExpenseForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Payment History - Expense: {selectedExpenseForPayment.description}
              </h2>
              <button
                onClick={() => setShowPaymentHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <ExpensePaymentHistory 
                expenseId={selectedExpenseForPayment.id}
                onPaymentAdded={handlePaymentSuccess}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate3d(0, 20px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.3s ease-out;
        }
      `}</style>
        </>
      )}

      {/* COGS Tab Content */}
      {mainTab === "cogs" && (
        <div className="space-y-6">
          {/* COGS Success Notification */}
          {cogsSettlementSuccess && (
            <div className="fixed top-6 right-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50 flex items-center animate-fadeIn max-w-md">
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="mr-2 flex-grow">
                <p className="font-medium">COGS Settlement Created!</p>
                <p className="text-sm">The settlement has been recorded as an expense.</p>
              </div>
              <button 
                className="text-green-700 hover:text-green-800 flex-shrink-0"
                onClick={() => setCogsSettlementSuccess(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* COGS Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCogsActiveTab("summary")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  cogsActiveTab === "summary"
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart className="h-4 w-4 mr-2" />
                Summary
              </button>
              <button
                onClick={() => setCogsActiveTab("expenses")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  cogsActiveTab === "expenses"
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Receipt className="h-4 w-4 mr-2" />
                COGS Expenses
              </button>
              <button
                onClick={() => setCogsActiveTab("settlement")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  cogsActiveTab === "settlement"
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                COGS Total
              </button>
              <button
                onClick={() => setCogsActiveTab("tracking")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  cogsActiveTab === "tracking"
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="h-4 w-4 mr-2" />
                Product Tracking
              </button>
            </nav>
          </div>

          {/* COGS Summary Tab */}
          {cogsActiveTab === "summary" && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-4">
                    <div className="rounded-full bg-blue-100 p-3 mr-4 flex-shrink-0">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        MK {cogsSummary?.summary?.totalCOGS?.toLocaleString() || '0.00'}
                      </div>
                      <div className="text-sm text-gray-500">Total COGS</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {cogsSummary?.summary?.expenseCount || 0} expenses recorded
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-4">
                    <div className="rounded-full bg-green-100 p-3 mr-4 flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        MK {cogsSummary?.summary?.totalCOGSExpenses?.toLocaleString() || '0.00'}
                      </div>
                      <div className="text-sm text-gray-500">COGS Expenses</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Settlement expenses
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-4">
                    <div className="rounded-full bg-purple-100 p-3 mr-4 flex-shrink-0">
                      <BarChart className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {cogsSummary?.summary?.transactionCount || 0}
                      </div>
                      <div className="text-sm text-gray-500">COGS Transactions</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    From sales integration
                  </div>
                </div>
              </div>

              {/* COGS Trends Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">COGS Trends (Last 6 Months)</h3>
                <COGSSummaryChart data={cogsSummary?.trends || []} />
              </div>

              {/* COGS by Category */}
              {cogsSummary?.cogsByCategory && cogsSummary.cogsByCategory.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">COGS by Category</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cogsSummary.cogsByCategory.map((category, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-900">{category.category}</span>
                          <span className="text-sm text-gray-500">{category.count} items</span>
                        </div>
                        <div className="text-lg font-bold text-blue-600">
                          MK {category.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* COGS Expenses Tab */}
          {cogsActiveTab === "expenses" && (
            <div className="space-y-6">

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 shadow-sm border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Total COGS Batches</p>
                      <p className="text-3xl font-bold text-blue-900 mt-2">
                        {cogsExpenses ? cogsExpenses.length : 0}
                      </p>
                    </div>
                    <div className="bg-blue-500 p-3 rounded-full">
                      <Receipt className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-blue-700 text-sm mt-2">Number of settlement batches</p>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 shadow-sm border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">Total Amount Recorded</p>
                      <p className="text-3xl font-bold text-green-900 mt-2">
                        MK {cogsExpenses && cogsExpenses.length > 0 
                          ? cogsExpenses.reduce((sum, expense) => {
                              // Parse formatted amount string (e.g., "1,000.00" -> 1000)
                              const amountStr = String(expense.amount || 0).replace(/,/g, '');
                              return sum + (parseFloat(amountStr) || 0);
                            }, 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })
                          : '0.00'}
                      </p>
                    </div>
                    <div className="bg-green-500 p-3 rounded-full">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-green-700 text-sm mt-2">Total COGS expenses recorded</p>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 shadow-sm border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-medium">Average Batch</p>
                      <p className="text-3xl font-bold text-purple-900 mt-2">
                        MK {cogsExpenses && cogsExpenses.length > 0 
                          ? (cogsExpenses.reduce((sum, expense) => {
                              // Parse formatted amount string (e.g., "1,000.00" -> 1000)
                              const amountStr = String(expense.amount || 0).replace(/,/g, '');
                              return sum + (parseFloat(amountStr) || 0);
                            }, 0) / cogsExpenses.length).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })
                          : '0.00'}
                      </p>
                    </div>
                    <div className="bg-purple-500 p-3 rounded-full">
                      <BarChart className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-purple-700 text-sm mt-2">Average per batch</p>
                </div>
              </div>

              {/* COGS Expenses Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">COGS Settlement History</h3>
                  <p className="text-gray-600 text-sm mt-1">View and manage your COGS settlement transactions</p>
              </div>
              <div className="p-6">
                <COGSExpensesTable 
                  expenses={cogsExpenses} 
                />
                </div>
              </div>
            </div>
          )}

          {/* COGS Total Tab */}
          {cogsActiveTab === "settlement" && (
            <div className="space-y-6">
              {/* COGS Total Card */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-6">
                    <div className="bg-blue-100 p-4 rounded-full mr-4">
                      <TrendingUp className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Accumulative COGS Total</h3>
                      <p className="text-gray-600">Total Cost of Goods Sold from all products</p>
                    </div>
                  </div>
                  
                  {/* New COGS Amount */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 mb-6">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      MK {((cogsSummary?.summary?.totalCOGS || 0) - lastRecordedCogsTotal).toLocaleString()}
                    </div>
                    <div className="text-lg text-gray-600 mb-4">New COGS Transactions</div>
                    <div className="text-sm text-gray-500">
                      {cogsSummary?.summary?.transactionCount || 0} total COGS transactions
                    </div>
                    {lastRecordedCogsTotal > 0 && (
                      <div className="text-sm text-gray-500 mt-2">
                        Last recorded total: MK {lastRecordedCogsTotal.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Record as Expense Button */}
                  <button
                    onClick={handleRecordCogsAsExpense}
                    disabled={isRecordingCogs || ((cogsSummary?.summary?.totalCOGS || 0) - lastRecordedCogsTotal) <= 0}
                    className={`px-8 py-4 text-white text-lg font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center justify-center mx-auto ${
                      isRecordingCogs || ((cogsSummary?.summary?.totalCOGS || 0) - lastRecordedCogsTotal) <= 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isRecordingCogs ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Recording...
                      </>
                    ) : cogsRecordingSuccess ? (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2 inline" />
                        Recorded Successfully!
                      </>
                    ) : ((cogsSummary?.summary?.totalCOGS || 0) - lastRecordedCogsTotal) <= 0 ? (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2 inline" />
                        No New Transactions
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2 inline" />
                        Record COGS Batch
                      </>
                    )}
                  </button>
                  
                  <p className="text-sm text-gray-500 mt-4">
                    {((cogsSummary?.summary?.totalCOGS || 0) - lastRecordedCogsTotal) > 0
                      ? `Click to record MK ${((cogsSummary?.summary?.totalCOGS || 0) - lastRecordedCogsTotal).toLocaleString()} as a COGS batch in both expenses and COGS tab`
                      : 'No new COGS transactions to record'
                    }
                  </p>
                  
                  {/* Success Message */}
                  {cogsRecordingSuccess && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        <div>
                          <span className="text-green-800 font-medium">
                            COGS batch recorded successfully!
                          </span>
                          <p className="text-green-700 text-sm mt-1">
                            Recorded in both regular expenses and COGS Expenses tab
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reset Button (for administrators) */}
                  {recordedCogsAmount > 0 && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                          <span className="text-yellow-800 text-sm">
                            Recorded amount: MK {recordedCogsAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                <button
                            onClick={resetRecordedCogsAmount}
                            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                          >
                            Reset
                          </button>
                          <button
                            onClick={clearAllCogsData}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                          >
                            Clear All
                </button>
              </div>
                      </div>
                      <p className="text-yellow-700 text-xs mt-1">
                        Reset: Re-record same amount | Clear All: Start fresh
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional COGS Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-green-100 p-2 rounded-lg mr-3">
                      <Package className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Products Tracked</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {cogsSummary?.summary?.productCount || 0}
                  </div>
                  <div className="text-sm text-gray-500">Products with COGS data</div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Total COGS</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    MK {cogsSummary?.summary?.totalCOGS?.toLocaleString() || '0.00'}
                  </div>
                  <div className="text-sm text-gray-500">Accumulated from all products</div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-purple-100 p-2 rounded-lg mr-3">
                      <BarChart className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Recorded Amount</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    MK {recordedCogsAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {recordedCogsAmount > 0 ? 'Already recorded as expense' : 'Not yet recorded'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Product Tracking Tab */}
          {cogsActiveTab === "tracking" && (
            <COGSManagement />
          )}
        </div>
      )}
    </div>
    </PermissionGuard>
  );
};
const ReceiptVerificationModal = ({ isOpen, onClose, receiptData, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    date: "",
    category: "",
    notes: ""
  });
  const expenseCategories = [
    "Office Supplies",
    "Travel",
    "Meals & Entertainment",
    "Utilities",
    "Software Subscription",
    "Advertising",
    "Rent",
    "Equipment",
    "Professional Services",
    "Pension"
    ,"Gratuity"
  ];
  // Initialize form data when receipt data changes
  useEffect(() => {
    if (receiptData) {
      setFormData({
        description: receiptData.description || "",
        amount: receiptData.amount?.toString() || "",
        date: receiptData.date || new Date().toISOString().split('T')[0],
        category: receiptData.category || "",
        notes: `Scanned from receipt image`
      });
    }
  }, [receiptData]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };
  
  if (!isOpen || !receiptData) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 ">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              Verify Receipt Details
            </h3>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <div className="flex flex-col h-full">
              <p className="text-sm text-gray-500 mb-2">Receipt Image:</p>
              <div className="border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center mb-2 h-64">
                {receiptData.previewUrl ? (
                  <img 
                    src={receiptData.previewUrl} 
                    alt="Receipt" 
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No preview available</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 italic">
                We've scanned your receipt and extracted the details. Please verify and correct if needed.
              </p>
            </div>
          </div>
          
          <div className="md:col-span-1">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Merchant/Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="text"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select a category</option>
                  {expenseCategories.map((category, index) => (
                    <option key={index} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="2"
                  className="w-full p-2 border border-gray-300 rounded-md"
                ></textarea>
              </div>
            </form>
          </div>
        </div>
        
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button 
            type="button"
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>Create Expense</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
const ReceiptScanningStatus = ({ progress }) => {
  // Use useRef to keep track of the previous progress
  const progressRef = useRef(progress);
  // Local state for the displayed progress
  const [displayProgress, setDisplayProgress] = useState(progress < 5 ? 5 : progress);
  
  // Update progress smoothly with useEffect
  useEffect(() => {
    // Only update if progress has increased
    if (progress > progressRef.current) {
      progressRef.current = progress;
      setDisplayProgress(progress);
      
      // Also update the DOM directly as a fallback
      const progressBar = document.getElementById('scan-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      
      const progressText = document.getElementById('scan-progress-text');
      if (progressText) {
        progressText.innerText = `Progress: ${progress}%`;
      }
    }
  }, [progress]);
  
  // Get step text based on progress percentage
  const getStepText = (p) => {
    if (p < 20) return "Initializing OCR engine...";
    if (p < 40) return "Analyzing image...";
    if (p < 60) return "Recognizing text...";
    if (p < 80) return "Extracting receipt data...";
    return "Finalizing results...";
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-24 h-24 mb-4">
        <svg className="animate-spin w-24 h-24 text-blue-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Receipt className="w-10 h-10 text-blue-500" />
        </div>
      </div>
      
      <h3 className="text-lg font-medium text-gray-900 mb-2">Scanning Receipt</h3>
      <p className="text-gray-500 mb-4 text-center">
        We're analyzing your receipt to extract merchant, date, and amount information.
        <br />This may take a few moments...
      </p>
      
      <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5 mb-2">
        <div 
          id="scan-progress-bar"
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${displayProgress}%` }}
        ></div>
      </div>
      
      <p className="text-xs text-gray-500">
        <span id="scan-progress-text">Progress: {displayProgress}%</span> - {getStepText(displayProgress)}
      </p>
    </div>
  );
};
export default ExpensesPage;
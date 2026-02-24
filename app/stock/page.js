"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Package,
  BarChart2,
  ShoppingCart,
  Truck,
  RefreshCw,
  X,
  Save,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Camera,
  Upload,
  Paperclip,
  AlertCircle,
  RotateCcw,
  Archive,
  CheckSquare,
  ChevronDown,
  File,
  PlusCircle,
  FileSpreadsheet,
  Calendar,
  Settings,
} from "lucide-react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import BulkInventoryOperations from "@/components/BulkInventoryOperations";
import ExpiryAlertSystem from "@/components/ExpiryAlertSystem";
import DynamicCategorySelect from "@/components/DynamicCategorySelect";
import ProductDeletionWarningModal from "@/components/ProductDeletionWarningModal";
import SkuConflictModal from "@/components/Stock/SkuConflictModal";
import UnitManagement from "@/components/UnitManagement/UnitManagement";
import BulkTaxApplicationModal from "@/components/BulkTaxApplicationModal";
import {
  StockTransferModal,
  StockTransfersList,
  StockPerBranch,
} from "@/components/StockTransfer";

// Main Stock Management Component
const InventoryManagement = () => {
  // State management
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [view, setView] = useState("list"); // list or grid
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [productTransactions, setProductTransactions] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [statistics, setStatistics] = useState({
    totalItems: 0,
    totalValue: "0.00",
    lowStock: 0,
    outOfStock: 0
  });
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  
  // NEW: Deletion warning modal state
  const [deletionWarningModal, setDeletionWarningModal] = useState({
    isOpen: false,
    product: null,
    usageDetails: {}
  });

  // NEW: Deletion status tracking
  const [deletionStatus, setDeletionStatus] = useState({});

  // NEW: Batch operations state
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [deletedProducts, setDeletedProducts] = useState([]);
  const [batchDeleteModal, setBatchDeleteModal] = useState({ isOpen: false, products: [] });
  const [restoreModal, setRestoreModal] = useState({ isOpen: false, products: [] });
  const [skuConflictModal, setSkuConflictModal] = useState({ isOpen: false, conflictData: null, pendingFormData: null });
  
  // Purchase Order Modal state
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [purchaseOrderProduct, setPurchaseOrderProduct] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [transactionType, setTransactionType] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  // Stock transfer states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [stockByBranch, setStockByBranch] = useState([]);
  const [branches, setBranches] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [pagePermissions, setPagePermissions] = useState({  
    canCreateInventory: false,
    canDeleteInventory:false, 
    canExportInventory:false, 
    canAdjustInventory:false, 
    canUpdateInventory:false, 
  });
  
  // NEW: Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1
  });

  // NEW: Location filter
  const [locationFilter, setLocationFilter] = useState("All");
  const [locations, setLocations] = useState(["All"]);

  // Load locations from API
  const loadLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (response.ok) {
        const data = await response.json();
        // Add "All" option and combine with API locations
        const allLocations = ["All", ...data.locations];
        setLocations(allLocations);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  // Load categories from API
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?type=inventory');
      if (response.ok) {
        const data = await response.json();
        // Combine API categories with default ones
        const allCategories = [...new Set([...categoryOptions, ...data.categories])];
        setCategoryOptions(allCategories.sort());
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };
  
  // NEW: Low Stock Alerts pagination state
  const [lowStockPage, setLowStockPage] = useState(1);
  const lowStockPageSize = 5;
  
  // NEW: Enhanced features state
  const [isBulkOperationsOpen, setIsBulkOperationsOpen] = useState(false);
  const [isExpiryAlertsOpen, setIsExpiryAlertsOpen] = useState(false);
  const [isBulkTaxModalOpen, setIsBulkTaxModalOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  
  // Category options state
  const [categoryOptions, setCategoryOptions] = useState([
    "Electronics", 
    "Furniture", 
    "Office Supplies", 
    "Clothing", 
    "Books", 
    "Food & Beverages", 
    "Health & Beauty", 
    "Sports & Recreation", 
    "Automotive"
  ]);
  useEffect(() => {
    const fetchPermissions = async () => {  
      const canCreateInventory = await getPermission("inventory.create");
      const canDeleteInventory = await getPermission("inventory.delete");
      const canExportInventory = await getPermission("inventory.export"); 
      const canAdjustInventory = await getPermission("inventory.adjust");
      const canUpdateInventory = await getPermission("inventory.update"); 
  
      setPagePermissions({ 
        canCreateInventory,
        canDeleteInventory, 
        canExportInventory, 
        canAdjustInventory, 
        canUpdateInventory,   
        });
    };
  
    fetchPermissions();
  }, []);
  // Toast notification states
  const [toast, setToast] = useState({
    show: false,
    type: "success",
    message: "",
    detail: "",
    duration: 3000
  });
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });
  
  // Image upload ref
  const fileInputRef = useRef(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Get unique categories from inventory
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(inventory.map(item => item.category ? item.category : "Uncategorized"))];
    return ["All", ...uniqueCategories.filter(Boolean)];
  }, [inventory]);
  
  // Show toast function
  const showToast = (type, message, detail = null, duration = 3000) => {
    setToast({
      show: true,
      type,
      message,
      detail,
      duration
    });
    
    if (duration !== Infinity) {
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, duration);
    }
  };
  
  // Close toast function
  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };
  
  // Initial data loading
  useEffect(() => {
    loadInventory();
    loadStatistics();
    loadLocations();
    loadCategories();
    loadRecentTransactions();
    // Preload transfers/branch stock for transfers view
    fetchTransfers();
    fetchStockByBranch();
    fetchBranches();
  }, []);
  
  // Handle search and filter changes
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    
    const timeout = setTimeout(() => {
      loadInventory();
    }, 500);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, categoryFilter, statusFilter, locationFilter, sortField, sortDirection]);
  
  // Handle pagination changes (when user clicks next/previous page)
  useEffect(() => {
    // Skip initial mount - filters useEffect will handle initial load
    const isInitialMount = pagination.totalItems === 0;
    if (!isInitialMount) {
      loadInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.pageSize]);
  
  // Disable body scroll when modal is open
  useEffect(() => {
    const modalsOpen = isFormOpen || isDetailOpen || isTransactionFormOpen || confirmDialog.isOpen || isUploadModalOpen;
    
    if (modalsOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFormOpen, isDetailOpen, isTransactionFormOpen, confirmDialog.isOpen, isUploadModalOpen]);
  
  // Reload product transactions when selectedItem changes and detail modal is open
  useEffect(() => {
    if (isDetailOpen && selectedItem?.id) {
      console.log('useEffect: Loading product transactions for:', selectedItem.id);
      loadProductTransactions(selectedItem.id);
    } else if (!isDetailOpen) {
      // Clear transactions when modal closes
      setProductTransactions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.id, isDetailOpen]);
  
  // Close modals when escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isFormOpen) setIsFormOpen(false);
        else if (isDetailOpen) setIsDetailOpen(false);
        else if (isTransactionFormOpen) setIsTransactionFormOpen(false);
        else if (confirmDialog.isOpen) setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        else if (isUploadModalOpen) setIsUploadModalOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, isDetailOpen, isTransactionFormOpen, confirmDialog.isOpen, isUploadModalOpen]);
  
  // Inventory API service
  const inventoryService = {
    // Fetch products with filtering and sorting
    fetchProducts: async (params = {}) => {
      try {
        const { search, category, status, location, sort, order, page, limit } = params;
        
        // Build query string
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (category && category !== 'All') queryParams.append('category', category);
        if (status && status !== 'All') queryParams.append('status', status);
        if (location && location !== 'All') queryParams.append('location', location);
        if (sort) queryParams.append('sort', sort);
        if (order) queryParams.append('order', order);
        if (page) queryParams.append('page', page);
        if (limit) queryParams.append('limit', limit);
        
        const queryString = queryParams.toString();
        const url = `/api/stock${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Error fetching products: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    
    // Get a single product by ID
    fetchProductById: async (productId) => {
      try {
        const response = await fetch(`/api/stock/${productId}`);
        
        if (!response.ok) {
          throw new Error(`Error fetching product: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`Error fetching product ${productId}:`, error);
        throw error;
      }
    },
    
    // Create a new product
    createProduct: async (productData, suppressExpectedErrors = false) => {
      try {
        const response = await fetch('/api/stock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productData),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          // Preserve full error data for conflict handling
          const error = new Error(errorData.error || `Error creating product: ${response.statusText}`);
          error.status = response.status;
          error.errorData = errorData;
          // Only log unexpected errors (not 409 conflicts that we handle)
          if (!suppressExpectedErrors || response.status !== 409) {
            console.error('Error creating product:', error);
            console.error('Error details:', errorData);
            console.error('Response status:', response.status);
          }
          throw error;
        }
        
        return await response.json();
      } catch (error) {
        // Only log if not suppressed or not a handled 409
        if (!suppressExpectedErrors || error.status !== 409) {
          console.error('Error creating product:', error);
        }
        throw error;
      }
    },
    
    // Update an existing product
    updateProduct: async (productId, productData, originalProduct = null) => {
      try {
        // Clean the data before sending - remove any extra fields that might cause issues
        const cleanedData = {
          ...productData,
          selectedUnits: productData.selectedUnits?.map(unit => ({
            id: unit.id,
            name: unit.name,
            symbol: unit.symbol,
            conversionToBase: unit.conversionToBase,
            isBaseUnit: unit.isBaseUnit,
            baseUnitId: unit.baseUnitId
          })) || []
        };
        
        console.log("=== FRONTEND UPDATE REQUEST ===");
        console.log("Sending update request for product:", productId);
        console.log("Quantity being sent:", cleanedData.quantityInStock);
        console.log("Unit management enabled:", cleanedData.unitManagementEnabled);
        console.log("Original product data:", {
          originalStockLevel: originalProduct?.originalStockLevel,
          stockLevel: originalProduct?.stockLevel,
          quantityInStock: originalProduct?.quantityInStock
        });
        console.log("Update data:", JSON.stringify(cleanedData, null, 2));
        console.log("=================================");
        
        const response = await fetch(`/api/stock/${productId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cleanedData),
        });
        
        console.log("Response status:", response.status, response.statusText);
        
        if (!response.ok) {
          let errorMessage = `Error updating product: ${response.statusText}`;
          try {
          const errorData = await response.json();
            console.log("Error response data:", errorData);
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
            // Use the default error message if JSON parsing fails
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log("Update successful, response:", result);
        return result;
      } catch (error) {
        console.error(`Error updating product ${productId}:`, error);
        throw error;
      }
    },
    
    // Delete a product
    deleteProduct: async (productId) => {
      try {
        const response = await fetch(`/api/stock/${productId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error deleting product: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`Error deleting product ${productId}:`, error);
        throw error;
      }
    },
    
    // Get inventory statistics
    getInventoryStatistics: async () => {
      try {
        const response = await fetch('/api/stock/statistics');
        
        if (!response.ok) {
          throw new Error(`Error fetching inventory statistics: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching inventory statistics:', error);
        throw error;
      }
    },
    
    // Get inventory transactions
    getTransactions: async (params = {}) => {
      try {
        const { limit, productId } = params;
        
        const queryParams = new URLSearchParams();
        if (limit) queryParams.append('limit', limit);
        if (productId) queryParams.append('productId', productId);
        
        const queryString = queryParams.toString();
        const url = `/api/stock/transactions${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Error fetching transactions: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching transactions:', error);
        throw error;
      }
    },
    
    // Record a transaction (stock in, stock out, adjustment)
    recordTransaction: async (transactionData) => {
      try {
        const response = await fetch('/api/stock/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error recording transaction: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error recording transaction:', error);
        throw error;
      }
    },
    
    // Export inventory data to CSV
    exportInventory: async (format = 'csv') => {
      try {
        const response = await fetch(`/api/stock/export?format=${format}`);
        
        if (!response.ok) {
          throw new Error(`Error exporting inventory: ${response.statusText}`);
        }
        
        return await response.blob();
      } catch (error) {
        console.error('Error exporting inventory:', error);
        throw error;
      }
    },
    
    // NEW: Get product usage details
    getProductUsage: async (productId) => {
      try {
        const response = await fetch(`/api/stock/${productId}/usage`);
        
        if (!response.ok) {
          throw new Error(`Error getting product usage: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`Error getting product usage ${productId}:`, error);
        throw error;
      }
    },

    // Check if a product can be deleted
    checkCanDelete: async (productId) => {
      try {
        const response = await fetch(`/api/stock/${productId}/can-delete`);
        
        if (!response.ok) {
          throw new Error(`Error checking deletion status: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`Error checking deletion status for product ${productId}:`, error);
        throw error;
      }
    }
  };
  
  // Load inventory data
  const loadInventory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = {
        search: searchTerm,
        category: categoryFilter,
        status: statusFilter,
        location: locationFilter,
        sort: sortField,
        order: sortDirection,
        // Use server-side pagination with 20 items per page
        page: pagination.currentPage,
        limit: pagination.pageSize
      };
      
      const data = await inventoryService.fetchProducts(params).catch(() => {
        // Show warning toast for fallback
        showToast("warning", "Using demo data", "API connection failed");
        
        // Fallback to dummy data
        const filteredInventory = initialInventory.filter(item => {
          const matchesSearch = !searchTerm || 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesCategory = categoryFilter === "All" || 
            (categoryFilter === "Uncategorized" && !item.category) || 
            item.category === categoryFilter;
          const matchesStatus = statusFilter === "All" || item.status === statusFilter;
          const matchesLocation = locationFilter === "All" || item.location === locationFilter;
          
          return matchesSearch && matchesCategory && matchesStatus && matchesLocation;
        });
        
        // Sort the inventory
        const sortedInventory = [...filteredInventory].sort((a, b) => {
          let valueA = a[sortField];
          let valueB = b[sortField];
          
          // Make sure we're comparing the right data types
          if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
          }
          
          if (sortDirection === 'asc') {
            return valueA > valueB ? 1 : -1;
          } else {
            return valueA < valueB ? 1 : -1;
          }
        });
        
        // Apply pagination for fallback data
        const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedInventory = sortedInventory.slice(startIndex, endIndex);
        
        return { 
          products: paginatedInventory,
          pagination: {
            totalItems: sortedInventory.length,
            totalPages: Math.ceil(sortedInventory.length / pagination.pageSize),
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize
          }
        };
      });
      
      setInventory(data.products || []);
      
      // Update pagination state
      if (data.pagination) {
        setPagination(prev => ({
          ...prev,
          totalItems: data.pagination.totalItems,
          totalPages: data.pagination.totalPages
        }));
      }
      
      // NEW: Check deletion status for all products
      if (data.products && data.products.length > 0) {
        checkProductsDeletionStatus(data.products);
      }
      
      // Show search result toast if applicable
      if (searchTerm) {
        if (data.products && data.products.length > 0) {
          showToast("info", `Found ${data.products.length} products`, `Matching "${searchTerm}"`);
        } else {
          showToast("info", "No products found", `No matches for "${searchTerm}"`);
        }
      }
    } catch (error) {
      console.error("Error loading inventory:", error);
      setError("Failed to load inventory. Please try again.");
      showToast("error", "Failed to load inventory", error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // NEW: Handle pagination
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handlePageSizeChange = (newPageSize) => {
    setPagination(prev => ({ 
      ...prev, 
      pageSize: newPageSize,
      currentPage: 1 // Reset to first page when changing page size
    }));
  };

  // NEW: Handle location filter change
  const handleLocationFilterChange = (newLocation) => {
    setLocationFilter(newLocation);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };
  
  // NEW: Handle bulk operations
  const handleBulkUpload = async (products) => {
    try {
      setIsSubmitting(true);
      
      let created = 0;
      let restored = 0;
      let errors = [];
      
      // Process each product
      for (const product of products) {
        try {
          // Suppress expected 409 errors in console (we handle them below)
          await inventoryService.createProduct(product, true);
          created++;
        } catch (error) {
          // Check if it's a 409 conflict with a deleted product
          if (error.status === 409 && error.errorData?.conflictType === 'deleted_product' && error.errorData?.deletedProduct) {
            try {
              const deletedProduct = error.errorData.deletedProduct;
              
              // Restore the deleted product
              const restoreResponse = await fetch('/api/stock/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds: [deletedProduct.id] })
              });
              
              if (restoreResponse.ok) {
                // Wait a bit for the database transaction to complete
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Format the product data for the update API - only include valid fields
                // Remove any fields that might cause issues (empty strings, undefined, etc.)
                // Do NOT include selectedUnits or unitManagementEnabled to avoid unit management processing
                const updateData = {
                  name: (product.name || '').trim(),
                  sku: (product.sku || '').trim(),
                  description: (product.description || '').trim(),
                  category: (product.category || 'Uncategorized').trim(),
                  stockLevel: parseInt(String(product.stockLevel || product.quantityInStock || 0), 10),
                  reorderPoint: parseInt(String(product.reorderPoint || 10), 10),
                  location: (product.location || 'Default Location').trim(),
                  price: parseFloat(String(product.price || product.unitPrice || 0)),
                  cost: parseFloat(String(product.cost || product.costPrice || 0)),
                  isService: Boolean(product.isService),
                  // Explicitly set unitManagementEnabled to false to avoid unit processing
                  unitManagementEnabled: false,
                };
                
                // Only include image if it's a valid URL (not empty string or blob)
                if (product.image && typeof product.image === 'string' && product.image.trim() && !product.image.startsWith('blob:')) {
                  updateData.image = product.image.trim();
                }
                
                // Retry logic: try updating up to 3 times with increasing delays
                let updateSuccess = false;
                for (let retry = 0; retry < 3; retry++) {
                  try {
                    await inventoryService.updateProduct(deletedProduct.id, updateData);
                    updateSuccess = true;
                    break;
                  } catch (updateError) {
                    if (retry < 2) {
                      // Wait longer before retrying
                      await new Promise(resolve => setTimeout(resolve, 300 * (retry + 1)));
                    } else {
                      throw updateError;
                    }
                  }
                }
                
                if (updateSuccess) {
                  restored++;
                  continue;
                }
              } else {
                const restoreError = await restoreResponse.json().catch(() => ({ error: 'Failed to restore deleted product' }));
                errors.push({ sku: product.sku, name: product.name, error: restoreError.error || 'Failed to restore deleted product' });
              }
            } catch (restoreError) {
              console.error(`Error restoring product with SKU ${product.sku}:`, restoreError);
              errors.push({ sku: product.sku, name: product.name, error: restoreError.message || 'Failed to restore' });
            }
          } else {
            // Other errors
            errors.push({ sku: product.sku, name: product.name, error: error.message });
          }
        }
      }
      
      // Reload inventory
      await loadInventory();
      
      // Show summary
      const summary = [];
      if (created > 0) summary.push(`${created} created`);
      if (restored > 0) summary.push(`${restored} restored`);
      if (errors.length > 0) summary.push(`${errors.length} failed`);
      
      if (errors.length === 0) {
        showToast("success", "Bulk upload completed", summary.join(", "));
      } else {
        showToast("warning", "Bulk upload completed with errors", `${summary.join(", ")}. Check console for details.`);
        console.error("Bulk upload errors:", errors);
      }
    } catch (error) {
      console.error("Error during bulk upload:", error);
      showToast("error", "Bulk upload failed", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleBulkExport = async (format = 'csv') => {
    try {
      const blob = await inventoryService.exportInventory(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error during export:", error);
      showToast("error", "Export failed", error.message);
    }
  };
  
  // NEW: Handle custom category creation
  const handleAddCustomCategory = async (categoryName) => {
    if (categoryName.trim() && !categoryOptions.includes(categoryName.trim())) {
      try {
        // Call the API to create the category
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: categoryName.trim(),
            type: 'inventory'
          })
        });

        if (response.ok) {
          setCategoryOptions(prev => [...prev, categoryName.trim()].sort());
          showToast("success", "Category added", `"${categoryName}" added to categories`);
        } else {
          const error = await response.json();
          showToast("error", "Failed to add category", error.error);
        }
      } catch (error) {
        console.error('Error adding category:', error);
        showToast("error", "Failed to add category", "Network error occurred");
      }
    }
  };
  
  // NEW: Handle custom location creation
  const handleAddCustomLocation = (locationName) => {
    if (locationName.trim() && !customLocations.includes(locationName.trim())) {
      setCustomLocations(prev => [...prev, locationName.trim()]);
      setLocations(prev => [...prev.filter(loc => loc !== "All"), locationName.trim(), "All"]);
      showToast("success", "Location added", `"${locationName}" added to locations`);
    }
  };
  
  // NEW: Handle product view for expiry alerts
  const handleViewProduct = (product) => {
    setSelectedItem(product);
    setIsDetailOpen(true);
  };
  
  // Load inventory statistics
  const loadStatistics = async () => {
    setStatisticsLoading(true);
    try {
      // Try to get from API, fall back to calculated stats from inventory
      const stats = await inventoryService.getInventoryStatistics().catch((error) => {
        console.log('Statistics API failed, using fallback calculation:', error.message);
        // Calculate from inventory data as fallback
        const activeInventory = inventory.filter(item => !item.isDeleted);
        return {
          totalItems: activeInventory.length,
          totalValue: activeInventory.reduce((sum, item) => {
            const quantity = item.quantityInStock || 0;
            const cost = item.costPrice || 0;
            return sum + (quantity * cost);
          }, 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          lowStock: activeInventory.filter(item => item.status === "Low Stock").length,
          outOfStock: activeInventory.filter(item => item.status === "Out of Stock").length,
          nearingReorder: activeInventory.filter(item => {
            const quantity = item.quantityInStock || 0;
            const reorderPoint = item.reorderPoint || 10;
            return quantity > 0 && quantity <= reorderPoint * 1.2;
          }).length,
          categories: [{ name: 'Uncategorized', count: activeInventory.length, percentage: 100 }],
          recentTransactions: []
        };
      });
      
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
      // Don't set error state for statistics, just log it
      showToast("warning", "Couldn't load statistics", "Using calculated values instead");
    } finally {
      setStatisticsLoading(false);
    }
  };
  
  // Load recent transactions
  const loadRecentTransactions = async () => {
    try {
      const data = await inventoryService.getTransactions({ limit: 5 }).catch(() => {
        // Return dummy data as fallback
        return { transactions: recentTransactions };
      });
      
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error loading transactions:", error);
      // Don't set error state for transactions, just log it
      showToast("warning", "Couldn't load recent transactions");
    }
  };
  
  // Load transactions for a specific product
  const loadProductTransactions = async (productId) => {
    try {
      console.log('loadProductTransactions called with productId:', productId);
      // Clear existing transactions first
      setProductTransactions([]);
      
      const data = await inventoryService.getTransactions({ productId, limit: 100 }).catch((err) => {
        console.error('Error fetching transactions:', err);
        // Return empty array on error
        return { transactions: [] };
      });
      
      console.log('API returned transactions:', data.transactions?.length || 0, 'for product:', productId);
      console.log('Transaction details:', data.transactions);
      setProductTransactions(data.transactions || []);
    } catch (error) {
      console.error(`Error loading transactions for product ${productId}:`, error);
      setProductTransactions([]);
      // Don't show toast on every load to avoid spam
    }
  };

  // Stock transfer API helpers
  const fetchTransfers = async (opts = {}) => {
    try {
      setTransfersLoading(true);
      const query = new URLSearchParams(opts).toString();
      const res = await fetch(`/api/stock-transfers${query ? `?${query}` : ''}`);
      if (!res.ok) return setTransfers([]);
      const data = await res.json();
      setTransfers(data.transfers || []);
    } catch (err) {
      console.error('Error fetching transfers:', err);
      setTransfers([]);
    } finally {
      setTransfersLoading(false);
    }
  };

  const fetchStockByBranch = async (opts = {}) => {
    try {
      const query = new URLSearchParams(opts).toString();
      const res = await fetch(`/api/stock-by-branch${query ? `?${query}` : ''}`);
      if (!res.ok) return setStockByBranch([]);
      const data = await res.json();
      setStockByBranch(data.branches || []);
    } catch (err) {
      console.error('Error fetching stock by branch:', err);
      setStockByBranch([]);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (!res.ok) return setBranches([]);
      const data = await res.json();
      setBranches(data.branches || data || []);
    } catch (err) {
      console.error('Error fetching branches:', err);
      setBranches([]);
    }
  };

  const handleCreateTransfer = async (formData) => {
    try {
      setIsSubmitting(true);
      console.log('[Frontend] Creating transfer with data:', formData);
      const res = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          directTransfer: true // Auto-complete the transfer
        }),
      });
      
      const responseData = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        console.error('[Frontend] Transfer failed:', {
          status: res.status,
          error: responseData.error,
          code: responseData.code,
          details: responseData.details
        });
        showToast('error', responseData.error || `Failed to transfer stock (${res.status})`);
        if (responseData.details) {
          console.error('[Frontend] Error details:', responseData.details);
        }
        return false;
      }
      
      const result = responseData;
      await fetchTransfers();
      await fetchStockByBranch();
      await loadInventory(); // Refresh inventory to show updated stock
      showToast('success', `Stock transferred successfully from ${result.transfer?.fromBranch?.name} to ${result.transfer?.toBranch?.name}`);
      return true;
    } catch (err) {
      console.error('[Frontend] Error creating transfer:', err);
      showToast('error', `Failed to transfer stock: ${err.message || 'Network error'}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTransfer = async (transferId) => {
    try {
      const res = await fetch(`/api/stock-transfers/${transferId}?action=approve`, { method: 'PUT' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.error || 'Failed to approve transfer');
        return null;
      }
      await fetchTransfers();
      showToast('success', 'Transfer approved');
      return await res.json();
    } catch (err) {
      console.error('Error approving transfer:', err);
      showToast('error', 'Failed to approve transfer');
      return null;
    }
  };

  const handleReceiveTransfer = async (transferId) => {
    try {
      const res = await fetch(`/api/stock-transfers/${transferId}?action=receive`, { method: 'PUT' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.error || 'Failed to receive transfer');
        return null;
      }
      await fetchTransfers();
      await fetchStockByBranch();
      showToast('success', 'Transfer received');
      return await res.json();
    } catch (err) {
      console.error('Error receiving transfer:', err);
      showToast('error', 'Failed to receive transfer');
      return null;
    }
  };

  const handleRejectTransfer = async (transferId, reason) => {
    try {
      const res = await fetch(`/api/stock-transfers/${transferId}?action=reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.error || 'Failed to reject transfer');
        return null;
      }
      await fetchTransfers();
      showToast('success', 'Transfer rejected');
      return await res.json();
    } catch (err) {
      console.error('Error rejecting transfer:', err);
      showToast('error', 'Failed to reject transfer');
      return null;
    }
  };
  
  // Handle sorting
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle product selection
  const handleItemClick = async (item) => {
    // Clear previous transactions immediately
    setProductTransactions([]);
    
    // Fetch complete product data including units
    try {
      const response = await fetch(`/api/stock/${item.id}`);
      if (response.ok) {
        const completeProduct = await response.json();
        setSelectedItem(completeProduct);
      } else {
        // Fallback to the item from inventory list
        setSelectedItem(item);
      }
    } catch (error) {
      console.error('Error fetching complete product data:', error);
      // Fallback to the item from inventory list
      setSelectedItem(item);
    }
    
    setIsDetailOpen(true);
    
    // Load transactions for this product - ensure we use the correct product ID
    const productIdToLoad = item?.id;
    if (productIdToLoad) {
      console.log('Loading transactions for product:', productIdToLoad);
      await loadProductTransactions(productIdToLoad);
    }
  };

  const getMovementMeta = (transaction) => {
    const normalize = (value) => (value || '').toString().toLowerCase();
    const rawType = normalize(transaction.type);
    const notes = normalize(transaction.notes);
    const reference = normalize(transaction.reference);

    const isIncoming = (value) => (
      value.includes('stock in') ||
      value.includes('stock_in') ||
      value.includes('receipt') ||
      value.includes('goods receipt') ||
      value.includes('gr-') ||
      value.includes('purchase') ||
      value.includes('incoming')
    );

    const isOutgoing = (value) => (
      value.includes('stock out') ||
      value.includes('stock_out') ||
      value.includes('sale') ||
      value.includes('invoice') ||
      value.includes('shipment') ||
      value.includes('delivery')
    );

    if (isIncoming(rawType) || isIncoming(notes) || isIncoming(reference)) {
      const label = notes.includes('receipt') || reference.includes('gr-') ? 'Goods Receipt' : 'Incoming Stock';
      return { type: 'incoming', label };
    }

    if (isOutgoing(rawType) || isOutgoing(notes) || isOutgoing(reference)) {
      const label = notes.includes('sale') ? 'Sale' : 'Stock Out';
      return { type: 'outgoing', label };
    }

    return { type: 'adjustment', label: 'Adjustment' };
  };
  
  // Open form for creating a new product
  const handleAddProduct = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setIsFormOpen(true);
  };
  
  // Open form for editing a product
  const handleEditProduct = async (product, e) => {
    if (e) e.stopPropagation(); // Prevent triggering the row click
    
    // Fetch complete product data including units for editing
    try {
      const response = await fetch(`/api/stock/${product.id}`);
      if (response.ok) {
        const completeProduct = await response.json();
        setSelectedItem(completeProduct);
      } else {
        // Fallback to the product from inventory list
    setSelectedItem(product);
      }
    } catch (error) {
      console.error('Error fetching complete product data for editing:', error);
      // Fallback to the product from inventory list
      setSelectedItem(product);
    }
    
    setIsEditing(true);
    setIsFormOpen(true);
  };
  
  // Handle product deletion with warning modal
  const handleDeleteProduct = async (productId, e) => {
    if (e) e.stopPropagation(); // Prevent triggering the row click
    
    // Find product for the modal
    const productToDelete = inventory.find(p => p.id === productId);
    if (!productToDelete) {
      showToast("error", "Product not found", "Unable to delete product");
      return;
    }
    
    try {
      // Get usage details for the warning modal
      const usageData = await inventoryService.getProductUsage(productId);
      
      // Show the warning modal with usage details
      setDeletionWarningModal({
        isOpen: true,
        product: productToDelete,
        usageDetails: usageData.usageDetails || {}
      });
    } catch (error) {
      console.error(`Error getting product usage:`, error);
      // Show modal anyway with empty usage details
      setDeletionWarningModal({
        isOpen: true,
        product: productToDelete,
        usageDetails: { totalUsage: 0, invoices: 0, sales: 0, quotations: 0 }
      });
    }
  };
  
  // Handle confirmed deletion from modal
  const handleConfirmedDeletion = async () => {
    const { product } = deletionWarningModal;
    const productName = product?.name || "Product";
    
    // Show a pending toast
    showToast("info", `Deleting ${productName}...`, null, Infinity);
    
    try {
      await inventoryService.deleteProduct(product.id);
      
      // Close the infinite duration toast
      closeToast();
      
      // Update inventory list by removing the deleted product
      setInventory(prevInventory => 
        prevInventory.filter(p => p.id !== product.id)
      );
      
      // Reload statistics
      loadStatistics();
      
      // Show success toast
      showToast("success", `${productName} deleted`, "Product removed successfully");
    } catch (error) {
      console.error(`Error deleting product ${product.id}:`, error);
      
      // Close the infinite duration toast
      closeToast();
      
      // Show error toast
      showToast("error", `Failed to delete ${productName}`, error.message);
    }
  };
  
  // Open transaction form
  const handleTransactionClick = (type, product) => {
    setSelectedItem(product);
    setTransactionType(type);
    setIsTransactionFormOpen(true);
  };

  // Handle restock - open purchase order modal
  const handleRestock = async (product) => {
    setPurchaseOrderProduct(product);
    setSuppliersLoading(true);
    try {
      const response = await fetch("/api/purchases/suppliers");
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error("Error loading suppliers:", error);
      showToast("error", "Failed to load suppliers", "Please try again");
    } finally {
      setSuppliersLoading(false);
    }
    setShowPurchaseOrderModal(true);
  };

  // Handle purchase order save
  const handleSavePurchaseOrder = async (payload) => {
    try {
      const response = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create purchase order");
      }
      showToast("success", "Purchase order created successfully", "");
      setShowPurchaseOrderModal(false);
      setPurchaseOrderProduct(null);
      // Optionally reload inventory to reflect any changes
      loadInventory();
    } catch (error) {
      console.error("Error creating purchase order:", error);
      showToast("error", "Failed to create purchase order", error.message);
      throw error;
    }
  };
  
  // Handle product form submission with improved image handling
  const handleProductSubmit = async (formData) => {
    setIsSubmitting(true);
    
    try {
      let productId;
      let resultProduct;
      
      if (isEditing) {
        // Show pending toast
        showToast("info", `Updating ${formData.name}...`, null, Infinity);
        
        const updated = await inventoryService.updateProduct(selectedItem.id, formData, selectedItem).catch(() => {
          // Mock response for demo
          showToast("warning", "Using demo mode", "Changes won't persist to a database");
          return {
            product: {
              ...selectedItem,
              ...formData,
              lastUpdated: new Date().toISOString()
            }
          };
        });
        
        // Close the infinite toast
        closeToast();
        
        resultProduct = updated.product;
        productId = resultProduct.id;
        
        // Save product taxes (always save, even if empty array)
        try {
          const taxResponse = await fetch(`/api/products/${productId}/taxes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taxTypeIds: formData.selectedTaxIds || [] })
          });
          
          if (!taxResponse.ok) {
            const errorData = await taxResponse.json();
            throw new Error(errorData.error || 'Failed to save taxes');
          }
          
          console.log('Taxes saved successfully:', formData.selectedTaxIds);
        } catch (error) {
          console.error('Error saving product taxes:', error);
          showToast("error", "Taxes not saved", error.message || "Product updated but tax assignment failed. Please try assigning taxes again.");
        }
        
        // Update inventory list with the product data (without image yet)
        // For products with units, use the original stock level for display, not the calculated total
        const updatedProduct = {
          ...resultProduct,
          quantityInStock: resultProduct.originalStockLevel !== undefined 
            ? resultProduct.originalStockLevel 
            : resultProduct.quantityInStock
        };
        
        setInventory(inventory.map(p => 
          p.id === productId ? updatedProduct : p
        ));
        
        // Update selected item if detail view is open
        if (isDetailOpen && selectedItem.id === productId) {
          setSelectedItem(updatedProduct);
        }
        
        showToast("success", `${formData.name} updated`, "Product details saved successfully");
      } else {
        // Show pending toast
        showToast("info", `Creating ${formData.name}...`, null, Infinity);
        
        const created = await inventoryService.createProduct(formData);
        
        // Close the infinite toast
        closeToast();
        
        resultProduct = created.product;
        productId = resultProduct.id;
        
        // Save product taxes (always save, even if empty array)
        try {
          const taxResponse = await fetch(`/api/products/${productId}/taxes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taxTypeIds: formData.selectedTaxIds || [] })
          });
          
          if (!taxResponse.ok) {
            const errorData = await taxResponse.json();
            throw new Error(errorData.error || 'Failed to save taxes');
          }
          
          console.log('Taxes saved successfully:', formData.selectedTaxIds);
        } catch (error) {
          console.error('Error saving product taxes:', error);
          showToast("error", "Taxes not saved", error.message || "Product created but tax assignment failed. Please try assigning taxes again.");
        }
        
        // Add to inventory list (without image yet)
        setInventory([resultProduct, ...inventory]);
        
        showToast("success", `${formData.name} created`, "New product added to inventory");
      }
      
      // Important: Don't close the form yet if there's an image to upload
      const imageFile = formData.imageFile;
      
      if (imageFile) {
        // Show uploading toast
        showToast("info", `Uploading image for ${formData.name}...`, null, Infinity);
        
        // Keep the form open with submitting state until image upload completes
        try {
          // Create form data for file upload
          const uploadData = new FormData();
          uploadData.append('file', imageFile);
          uploadData.append('productId', productId);
          
          // Upload the image
          const uploadResponse = await fetch('/api/stock/upload-image', {
            method: 'POST',
            body: uploadData
          });
          
          // Close the infinite toast
          closeToast();
          
          if (uploadResponse.ok) {
            const responseData = await uploadResponse.json();
            
            // Extract image URL from response
            let imageUrl = null;
            if (responseData.imageUrl) {
              imageUrl = responseData.imageUrl;
            } else if (responseData.imagePath) {
              imageUrl = responseData.imagePath;
            } else if (responseData.url) {
              imageUrl = responseData.url;
            } else if (responseData.image) {
              imageUrl = responseData.image;
            }
            
            if (imageUrl) {
              // Update inventory with the new image URL
              setInventory(currentInventory => 
                currentInventory.map(item => 
                  item.id === productId 
                    ? { ...item, image: imageUrl, imageUrl: imageUrl } 
                    : item
                )
              );
              
              // Update selected item if detail view is open
              if (isDetailOpen && selectedItem && selectedItem.id === productId) {
                setSelectedItem(prev => ({ ...prev, image: imageUrl, imageUrl: imageUrl }));
              }
              
              showToast("success", "Image uploaded", "Product image updated successfully");
            }
          } else {
            showToast("error", "Failed to upload image", "Server returned an error");
          }
        } catch (error) {
          console.error("Error uploading image:", error);
          showToast("error", "Error uploading image", error.message);
        }
      }
      
      // Now close the form after all operations are complete
      setIsFormOpen(false);
      
      // Refresh statistics
      loadStatistics();
    } catch (error) {
      console.error("Error saving product:", error);
      
      // Handle SKU conflict with deleted product
      if (error.status === 409 && error.data?.conflictType === 'deleted_product') {
        // Close the infinite toast
        closeToast();
        
        // Store the form data for later use
        setSkuConflictModal({
          isOpen: true,
          conflictData: error.data,
          pendingFormData: formData
        });
      } else {
        showToast("error", "Failed to save product", error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle SKU conflict modal actions
  const handleRestoreProduct = async (deletedProductId) => {
    try {
      const response = await fetch('/api/stock/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds: [deletedProductId] })
      });

      if (!response.ok) {
        throw new Error('Failed to restore product');
      }

      const result = await response.json();
      
      // Close the modal
      setSkuConflictModal({ isOpen: false, conflictData: null, pendingFormData: null });
      
      // Show success message
      showToast("success", "Product restored", "The deleted product has been restored successfully");
      
      // Refresh inventory
      loadInventory();
      
      // Now create the new product with the same SKU
      if (skuConflictModal.pendingFormData) {
        await handleProductSubmit(skuConflictModal.pendingFormData);
      }
      
    } catch (error) {
      console.error('Error restoring product:', error);
      showToast("error", "Failed to restore product", error.message);
    }
  };

  const handleCreateWithNewSku = async () => {
    try {
      // Close the modal
      setSkuConflictModal({ isOpen: false, conflictData: null, pendingFormData: null });
      
      // Reopen the form with the same data but allow user to change SKU
      setIsFormOpen(true);
      setIsEditing(false);
      setSelectedItem(skuConflictModal.pendingFormData);
      
      showToast("info", "Please change the SKU", "The form has been reopened. Please modify the SKU and try again.");
      
    } catch (error) {
      console.error('Error handling new SKU creation:', error);
      showToast("error", "Failed to reopen form", error.message);
    }
  };

  const handleSkuConflictCancel = () => {
    setSkuConflictModal({ isOpen: false, conflictData: null, pendingFormData: null });
    showToast("info", "Product creation cancelled", "You can try again with a different SKU");
  };
  
  // Handle transaction form submission
  const handleTransactionSubmit = async (formData) => {
    // Prevent double submission
    if (isSubmitting) {
      console.warn('Transaction already submitting, ignoring duplicate call');
      return;
    }
    
    setIsSubmitting(true);
    
    // Get transaction type and quantity for better feedback
    const { type, quantity } = formData;
    const productName = selectedItem?.name || "Product";
    
    // Show pending toast
    showToast("info", `Processing ${type} for ${productName}...`, null, Infinity);
    
    try {
      // Ensure required fields are present for API
      const payload = {
        productId: selectedItem?.id,
        type: formData.type,
        quantity: formData.quantity,
        unitCost: formData.unitCost || null, // Include unitCost for FIFO
        notes: formData.notes || null
      };
      const result = await inventoryService.recordTransaction(payload);
      
      // Close the infinite toast
      closeToast();
      
      // Update inventory list with fresh data to avoid stale/partial fields (category, value)
      if (result.updatedProduct) {
        let hydratedProduct = null;
        try {
          const fresh = await inventoryService.fetchProductById(result.updatedProduct.id);
          // API may return product directly or wrapped in { product }
          hydratedProduct = fresh?.product || fresh || result.updatedProduct;
        } catch (_) {
          hydratedProduct = result.updatedProduct;
        }

        setInventory(prev => prev.map(p => 
          p.id === result.updatedProduct.id ? hydratedProduct : p
        ));

        // Update selected item if detail view is open
        if (isDetailOpen && selectedItem?.id === result.updatedProduct.id) {
          setSelectedItem(hydratedProduct);
        }
      }
      
      // Add transaction to list
      if (result.transaction) {
        setTransactions([result.transaction, ...transactions.slice(0, 4)]);
        
        // Reload product transactions if detail modal is open for this product
        if (selectedItem && isDetailOpen && result.transaction.productId === selectedItem.id) {
          // Add the transaction immediately to show instant feedback
          setProductTransactions([result.transaction, ...productTransactions]);
          
          // Then reload after a short delay to ensure we get all transactions from the database
          setTimeout(async () => {
            await loadProductTransactions(selectedItem.id);
          }, 500);
        } else if (selectedItem && result.transaction.productId === selectedItem.id) {
          // If modal is closed but product is selected, just add to the list
          setProductTransactions([result.transaction, ...productTransactions]);
        }
      }
      
      // Close form
      setIsTransactionFormOpen(false);
      
      // Refresh statistics and lightweight list data
      loadStatistics();
      
      // Show success toast with detailed information
      const actionText = type === "Stock In" ? "added to" : 
                         type === "Stock Out" ? "removed from" : 
                         "adjusted in";
      
      showToast("success", `Inventory updated`, `${quantity} units ${actionText} ${productName}`);
    } catch (error) {
      console.error("Error recording transaction:", error);
      
      // Close the infinite toast
      closeToast();
      
      // Show error toast
      showToast("error", "Failed to record transaction", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle export
  const handleExport = async (format = 'csv') => {
    // Show pending toast
    showToast("info", `Preparing ${format.toUpperCase()} export...`, null, Infinity);
    
    try {
      const blob = await inventoryService.exportInventory(format).catch(() => {
        // Create CSV content as fallback
        const headers = ['ID', 'Name', 'SKU', 'Category', 'Quantity', 'Unit Price', 'Cost Price', 'Status', 'Location'];
        const rows = inventory.map(p => [
          p.id,
          p.name,
          p.sku,
          p.category,
          p.quantityInStock,
          p.unitPrice,
          p.costPrice,
          p.status,
          p.location
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(r => r.join(','))
        ].join('\n');
        
        showToast("warning", "Using demo mode", "Generating client-side export");
        return new Blob([csvContent], {type: 'text/csv'});
      });
      
      // Close the infinite toast
      closeToast();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `inventory-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      // Show success toast
      showToast("success", "Export complete", `Downloaded as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Error exporting inventory:", error);
      
      // Close the infinite toast
      closeToast();
      
      // Show error toast
      showToast("error", "Failed to export inventory", error.message);
    }
  };
  
  // Format currency in Malawi Kwacha
  const formatCurrency = (amount) => {
    // Check if amount is a number
    // if (amount === null || amount === undefined || isNaN(Number(amount))) {
    //   return 'MWK 0'; // Return a default value instead of NaN
    // }
    if (amount === null || amount === undefined) {
      return 'MWK 0';
    }

    // Remove commas if it's a string with formatted number
    const numericAmount = typeof amount === 'string'
      ? Number(amount.replace(/,/g, ''))
      : Number(amount);

    if (isNaN(numericAmount)) {
      return 'MWK 0';
    }
    
    try {
      return new Intl.NumberFormat('en-MW', { 
        style: 'currency', 
        currency: 'MWK',
        maximumFractionDigits: 0
      }).format(Number(numericAmount));
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `MWK ${Number(numericAmount).toLocaleString() || 0}`;
    }
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
  
  // Handle drag over for file upload
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  // Handle drag leave for file upload
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  // Handle drop for file upload
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
    }, 500);
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
  
  // Trigger file input
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Open upload modal
  const openUploadModal = () => {
    setUploadedFiles([]);
    setIsUploadModalOpen(true);
  };
  
  // Handle file upload
  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    processFiles(files);
  };
  
  // Complete upload process
  const completeUpload = async () => {
    if (uploadedFiles.length === 0 || !selectedItem) return;
    
    // Show pending toast
    showToast("info", `Uploading files...`, null, Infinity);
    
    // Start uploading
    setIsUploading(true);
    
    try {
      // Create form data for upload
      const formData = new FormData();
      uploadedFiles.forEach((file, index) => {
        formData.append(`file-${index}`, file.file);
      });
      formData.append('productId', selectedItem.id);
      
      // Upload the image
      const uploadResponse = await fetch('/api/stock/upload-image', {
        method: 'POST',
        body: formData
      });
      
      // Close the infinite toast
      closeToast();
      
      if (uploadResponse.ok) {
        const responseData = await uploadResponse.json();
        
        // Extract image URL from response
        let imageUrl = null;
        if (responseData.imageUrl) {
          imageUrl = responseData.imageUrl;
        } else if (responseData.imagePath) {
          imageUrl = responseData.imagePath;
        } else if (responseData.url) {
          imageUrl = responseData.url;
        } else if (responseData.image) {
          imageUrl = responseData.image;
        }
        
        if (imageUrl) {
          // Update inventory with the new image URL
          setInventory(currentInventory => 
            currentInventory.map(item => 
              item.id === selectedItem.id 
                ? { ...item, image: imageUrl, imageUrl: imageUrl } 
                : item
            )
          );
          
          // Update selected item if detail view is open
          if (isDetailOpen && selectedItem) {
            setSelectedItem(prev => ({ ...prev, image: imageUrl, imageUrl: imageUrl }));
          }
          
          showToast("success", "Files uploaded", `${uploadedFiles.length} files attached to ${selectedItem.name}`);
        }
      } else {
        showToast("error", "Failed to upload files", "Server returned an error");
      }
      
      // Close the upload modal
      setIsUploadModalOpen(false);
    } catch (error) {
      console.error("Error uploading files:", error);
      showToast("error", "Error uploading files", error.message);
    } finally {
      setIsUploading(false);
    }
  };
  
  // NEW: Check deletion status for multiple products
  const checkProductsDeletionStatus = async (products) => {
    try {
      const statusPromises = products.map(async (product) => {
        try {
          const status = await inventoryService.checkCanDelete(product.id);
          return { productId: product.id, ...status };
        } catch (error) {
          // If API fails, assume product can be deleted (fallback)
          return { 
            productId: product.id, 
            canDelete: true, 
            reason: null,
            usageCount: 0
          };
        }
      });
      
      const statuses = await Promise.all(statusPromises);
      
      // Update deletion status state
      const statusMap = {};
      statuses.forEach(status => {
        statusMap[status.productId] = {
          canDelete: status.canDelete,
          reason: status.reason,
          usageCount: status.usageCount,
          usageDetails: status.usageDetails
        };
      });
      
      setDeletionStatus(statusMap);
    } catch (error) {
      console.error('Error checking products deletion status:', error);
      // Don't show error toast for this background operation
    }
  };
  
  // NEW: Get deletion status for a specific product
  const getProductDeletionStatus = (productId) => {
    return deletionStatus[productId] || { canDelete: true, reason: null, usageCount: 0 };
  };
  
  // NEW: Generate tooltip text for delete button
  const getDeleteTooltipText = (productId, productName) => {
    const status = getProductDeletionStatus(productId);
    
    if (status.canDelete) {
      return `Delete ${productName}`;
    }
    
    let tooltip = `Cannot delete ${productName}: ${status.reason}`;
    if (status.usageCount > 0) {
      tooltip += ` (${status.usageCount} usage${status.usageCount > 1 ? 's' : ''})`;
    }
    
    return tooltip;
  };
  
  // NEW: Batch operation functions
  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === inventory.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(inventory.map(product => product.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedProducts.length === 0) {
      showToast("warning", "No products selected", "Please select products to delete");
      return;
    }

    const productsToDelete = inventory.filter(p => selectedProducts.includes(p.id));
    setBatchDeleteModal({ isOpen: true, products: productsToDelete });
  };

  const confirmBatchDelete = async (reason) => {
    try {
      showToast("info", "Deleting products...", null, Infinity);

      const response = await fetch('/api/stock/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedProducts,
          reason: reason || 'Batch deletion'
        })
      });

      closeToast();

      if (response.ok) {
        const result = await response.json();
        showToast("success", "Products deleted", `Successfully deleted ${result.deletedCount} products`);
        
        // Reset selection and reload data
        setSelectedProducts([]);
        setIsSelectMode(false);
        await loadInventory();
        await loadStatistics();
      } else {
        const error = await response.json();
        showToast("error", "Delete failed", error.error);
      }
    } catch (error) {
      closeToast();
      showToast("error", "Delete failed", "Network error occurred");
    }
    setBatchDeleteModal({ isOpen: false, products: [] });
  };

  const loadDeletedProducts = async () => {
    try {
      const response = await fetch('/api/stock/restore');
      if (response.ok) {
        const data = await response.json();
        setDeletedProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading deleted products:', error);
    }
  };

  const handleRestore = (products) => {
    setRestoreModal({ isOpen: true, products: Array.isArray(products) ? products : [products] });
  };

  const confirmRestore = async () => {
    try {
      showToast("info", "Restoring products...", null, Infinity);

      const productIds = restoreModal.products.map(p => p.id);
      const response = await fetch('/api/stock/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      });

      closeToast();

      if (response.ok) {
        const result = await response.json();
        showToast("success", "Products restored", `Successfully restored ${result.restoredCount} products`);
        
        // Reload data
        await loadInventory();
        await loadStatistics();
        if (showDeletedItems) {
          await loadDeletedProducts();
        }
      } else {
        const error = await response.json();
        showToast("error", "Restore failed", error.error);
      }
    } catch (error) {
      closeToast();
      showToast("error", "Restore failed", "Network error occurred");
    }
    setRestoreModal({ isOpen: false, products: [] });
  };

  // Load deleted products when switching to deleted view and refresh statistics
  useEffect(() => {
    if (showDeletedItems) {
      loadDeletedProducts();
    }
    // Always refresh statistics when switching views to ensure accuracy
    loadStatistics();
  }, [showDeletedItems, inventory]); // Add inventory dependency to refresh stats when inventory changes

  // Status badge component for inventory items
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "In Stock":
        badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
        icon = <CheckCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      case "Low Stock":
        badgeClass = "bg-amber-50 text-amber-700 border border-amber-200";
        icon = <AlertTriangle className="w-3.5 h-3.5 mr-1" />;
        break;
      case "Out of Stock":
        badgeClass = "bg-red-50 text-red-700 border border-red-200";
        icon = <AlertCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      default:
        badgeClass = "bg-gray-50 text-gray-700 border border-gray-200";
    }
    
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center whitespace-nowrap ${badgeClass}`}>
        {icon}
        {status}
      </span>
    );
  };


  return (
    <PermissionGuard permission="inventory.view" >
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 p-4 rounded shadow-lg z-50 flex items-center animate-fadeIn max-w-md
          ${toast.type === 'success' ? 'bg-green-100 border-l-4 border-green-500 text-green-700' : 
            toast.type === 'error' ? 'bg-red-100 border-l-4 border-red-500 text-red-700' : 
            toast.type === 'warning' ? 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700' : 
            'bg-blue-100 border-l-4 border-blue-500 text-blue-700'}`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" /> : 
           toast.type === 'error' ? <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" /> : 
           toast.type === 'warning' ? <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" /> : 
           <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />}
          <div className="mr-2 flex-grow">
            <p className="font-medium">{toast.message}</p>
            {toast.detail && <p className="text-sm">{toast.detail}</p>}
          </div>
          <button 
            className="text-current hover:opacity-75 flex-shrink-0"
            onClick={closeToast}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Stock Management</h1>
          <p className="text-gray-500 mt-1">Manage your products, track stock levels, and monitor inventory movements</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* View Toggle */}
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                !showDeletedItems 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => {
                setShowDeletedItems(false);
                setSelectedProducts([]);
              }}
            >
              Active Products
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                showDeletedItems 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => {
                setShowDeletedItems(true);
                setSelectedProducts([]);
              }}
            >
              <Archive size={14} className="inline mr-1" />
              Deleted ({deletedProducts.length})
            </button>
          </div>

          {!showDeletedItems ? (
            <>
              {/* Batch Operations Toggle */}
              <button
                className={`px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 ${
                  isSelectMode
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-200 hover:bg-orange-700'
                    : 'bg-white text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md'
                }`}
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedProducts([]);
                }}
              >
                <CheckSquare size={16} />
                <span>{isSelectMode ? 'Cancel Selection' : 'Select Products'}</span>
              </button>

              {/* Batch Delete Button */}
              {isSelectMode && selectedProducts.length > 0 && (
                <button
                  className="px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-red-200 hover:bg-red-700 transition-all duration-200"
                  onClick={handleBatchDelete}
                >
                  <Trash2 size={16} />
                  <span>Delete Selected ({selectedProducts.length})</span>
                </button>
              )}

              <button 
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-blue-200 hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                onClick={handleAddProduct}
              >
                <Plus size={16} />
                <span>Add Product</span>
              </button>
            </>
          ) : (
            /* Deleted Items View Controls */
            selectedProducts.length > 0 && (
              <button
                className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-green-200 hover:from-green-700 hover:to-green-800 transition-all duration-200"
                onClick={() => {
                  const productsToRestore = deletedProducts.filter(p => selectedProducts.includes(p.id));
                  handleRestore(productsToRestore);
                }}
              >
                <RotateCcw size={16} />
                <span>Restore Selected ({selectedProducts.length})</span>
              </button>
            )
          )}
          
          {/* NEW: Bulk Operations Button */}
          <button 
            className="px-4 py-2.5 bg-white text-gray-700 rounded-lg font-medium flex items-center gap-2 shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md transition-all duration-200"
            onClick={() => setIsBulkOperationsOpen(true)}
          >
            <FileSpreadsheet size={16} />
            <span>Bulk Operations</span>
          </button>
          
          {/* NEW: Apply Taxes Button */}
          <button 
            className="px-4 py-2.5 bg-white text-purple-700 rounded-lg font-medium flex items-center gap-2 shadow-sm border border-gray-200 hover:bg-purple-50 hover:shadow-md transition-all duration-200"
            onClick={() => setIsBulkTaxModalOpen(true)}
          >
            <Settings size={16} />
            <span>Apply Taxes</span>
          </button>
          
          {/* NEW: Expiry Alerts Button */}
          <button 
            className="px-4 py-2.5 bg-white text-orange-700 rounded-lg font-medium flex items-center gap-2 shadow-sm border border-gray-200 hover:bg-orange-50 hover:shadow-md transition-all duration-200"
            onClick={() => setIsExpiryAlertsOpen(true)}
          >
            <Calendar size={16} />
            <span>Expiry Alerts</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* Total Products Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Products</p>
              <div className="mt-2">
                {statisticsLoading ? (
                  <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900">{statistics.totalItems}</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Active items in inventory</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <Package size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
        
        {/* Inventory Value Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Inventory Value</p>
              <div className="mt-2">
                {statisticsLoading ? (
                  <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(statistics.totalValue)}</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Total stock worth</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl">
              <BarChart2 size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
        
        {/* Low Stock Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
              <div className="mt-2">
                {statisticsLoading ? (
                  <div className="h-8 w-12 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-3xl font-bold text-amber-600">{statistics.lowStock}</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Needs attention</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>
          </div>
        </div>
        
        {/* Out of Stock Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Out of Stock</p>
              <div className="mt-2">
                {statisticsLoading ? (
                  <div className="h-8 w-12 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-3xl font-bold text-red-600">{statistics.outOfStock}</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Needs restocking</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="relative flex-grow max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          {/* Category Filter */}
          <div className="relative flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-white transition-all duration-200">
            <Filter size={16} className="text-gray-400 mr-2" />
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm text-gray-700 min-w-[120px]"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === "All" ? "All Categories" : category}
                </option>
              ))}
            </select>
          </div>
          
          {/* Status Filter */}
          <div className="relative flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-white transition-all duration-200">
            <Filter size={16} className="text-gray-400 mr-2" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm text-gray-700 min-w-[110px]"
            >
              <option value="All">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
          
          {/* Location Filter */}
          <div className="relative flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-white transition-all duration-200">
            <Filter size={16} className="text-gray-400 mr-2" />
            <select 
              value={locationFilter}
              onChange={(e) => handleLocationFilterChange(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm text-gray-700 min-w-[120px]"
            >
              {locations.map(location => (
                <option key={location} value={location}>
                  {location === "All" ? "All Locations" : location}
                </option>
              ))}
            </select>
          </div>
          
          <div className="h-6 w-px bg-gray-200 mx-1"></div>
          
          {/* View Toggle Buttons */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button 
              className={`px-3 py-2 flex items-center gap-1.5 transition-all duration-200 ${
                view === 'list' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setView('list')}
              title="List View"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor"/>
                <rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/>
                <rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/>
              </svg>
              <span className="text-xs font-medium">List</span>
            </button>
            <button 
              className={`px-3 py-2 flex items-center gap-1.5 border-l border-gray-200 transition-all duration-200 ${
                view === 'grid' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setView('grid')}
              title="Grid View"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/>
              </svg>
              <span className="text-xs font-medium">Grid</span>
            </button>
          </div>
          
          {pagePermissions.canExportInventory && (
            <button 
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2.5 bg-white hover:bg-gray-50 hover:shadow-sm transition-all duration-200 text-gray-700"
              onClick={() => handleExport('csv')}
            >
              <Download size={16} className="text-gray-500" />
              <span className="text-sm font-medium">Export</span>
            </button>
          )}
          
          {/* Stock Transfers View Toggle */}
          <button
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium ${
              view === 'transfers' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' 
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-sm'
            }`}
            onClick={() => {
              setView('transfers');
              setShowTransferModal(true);
            }}
          >
            <Truck size={16} />
            <span className="text-sm">Transfers</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 py-16">
          <div className="relative">
            <div className="h-14 w-14 border-4 border-gray-200 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 h-14 w-14 border-4 border-t-blue-600 border-r-transparent border-l-transparent border-b-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 mt-4 font-medium">Loading inventory...</p>
          <p className="text-gray-400 text-sm mt-1">Please wait while we fetch your data</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start">
          <div className="p-2 bg-red-100 rounded-lg mr-4">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-grow">
            <h3 className="text-red-800 font-semibold mb-1">Error Loading Inventory</h3>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button 
              className="px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
              onClick={loadInventory}
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        view === 'list' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr>
                    {(isSelectMode || showDeletedItems) && (
                      <th className="px-4 py-3.5 text-left">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={
                            showDeletedItems 
                              ? selectedProducts.length === deletedProducts.length && deletedProducts.length > 0
                              : selectedProducts.length === inventory.length && inventory.length > 0
                          }
                          onChange={() => {
                            const currentList = showDeletedItems ? deletedProducts : inventory;
                            if (selectedProducts.length === currentList.length) {
                              setSelectedProducts([]);
                            } else {
                              setSelectedProducts(currentList.map(product => product.id));
                            }
                          }}
                        />
                      </th>
                    )}
                    <th 
                      className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Product Name</span>
                        {sortField === 'name' && (
                          sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                    <th 
                      className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Category</span>
                        {sortField === 'category' && (
                          sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('quantityInStock')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Quantity</span>
                        {sortField === 'quantityInStock' && (
                          sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('unitPrice')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Unit Price</span>
                        {sortField === 'unitPrice' && (
                          sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        {sortField === 'status' && (
                          sortDirection === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inventory Value</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(showDeletedItems ? deletedProducts : inventory).map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => {
                        if (isSelectMode || showDeletedItems) {
                          handleSelectProduct(item.id);
                        } else {
                          handleItemClick(item);
                        }
                      }}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors duration-150 ${showDeletedItems ? 'opacity-60' : ''} ${
                        (isSelectMode || showDeletedItems) && selectedProducts.includes(item.id) 
                          ? 'bg-blue-50/80 border-l-4 border-blue-500' 
                          : ''
                      }`}
                    >
                      {(isSelectMode || showDeletedItems) && (
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedProducts.includes(item.id)}
                            onChange={() => handleSelectProduct(item.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <img src={item.image || "/api/placeholder/80/80"} alt={item.name} className="w-11 h-11 mr-3 object-cover rounded-lg shadow-sm" />
                          <div>
                            <span className="font-medium text-gray-900 block">{item.name}</span>
                            {showDeletedItems && (
                              <div className="text-xs text-red-500 mt-1 font-medium">
                                Deleted: {formatDate(item.deletedAt)}
                                {item.deletionReason && ` - ${item.deletionReason}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded text-xs">
                          {item.sku}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {item.category || "Uncategorized"}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-sm font-semibold ${
                        item.status === 'Out of Stock' ? 'text-red-600' : 
                        item.status === 'Low Stock' ? 'text-amber-600' : 
                        'text-gray-700'
                      }`}>
                        {item.quantityInStock}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-700">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-4 text-sm">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-gray-900">
                        {formatCurrency(
                          item.totalStockValue != null && !isNaN(Number(item.totalStockValue))
                            ? Number(item.totalStockValue)
                            : (item.quantityInStock * (item.costPrice || 0))
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          {showDeletedItems ? (
                            // Actions for deleted items
                            <button 
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              onClick={() => handleRestore(item)}
                              title={`Restore ${item.name}`}
                            >
                              <RotateCcw size={16} />
                            </button>
                          ) : (
                            // Actions for active items
                            <>
                              <button 
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                onClick={() => handleItemClick(item)}
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              {pagePermissions.canUpdateInventory && (
                                <button 
                                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  onClick={(e) => handleEditProduct(item, e)}
                                  title="Edit Product"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              {pagePermissions.canDeleteInventory && (
                                <button 
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  onClick={(e) => handleDeleteProduct(item.id, e)}
                                  title={`Delete ${item.name}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {inventory.length === 0 && (
              <div className="py-16 text-center">
                <div className="bg-gray-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  {(searchTerm || categoryFilter !== "All" || statusFilter !== "All") 
                    ? "Try adjusting your search or filter criteria" 
                    : "Get started by adding your first product to the inventory"}
                </p>
                <button 
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-200 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 mx-auto"
                  onClick={handleAddProduct}
                >
                  <Plus size={18} />
                  Add Your First Product
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {(showDeletedItems ? deletedProducts : inventory).map((item) => (
              <div 
                key={item.id} 
                className={`bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col cursor-pointer group ${
                  showDeletedItems ? 'opacity-60' : ''
                } ${
                  (isSelectMode || showDeletedItems) && selectedProducts.includes(item.id) 
                    ? 'ring-2 ring-blue-500 bg-blue-50/50' 
                    : ''
                }`}
                onClick={() => {
                  if (isSelectMode || showDeletedItems) {
                    handleSelectProduct(item.id);
                  } else {
                    handleItemClick(item);
                  }
                }}
              >
                <div className="relative bg-gray-50 p-4">
                  <img 
                    src={item.image || "/api/placeholder/80/80"} 
                    alt={item.name} 
                    className="w-full h-48 object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={item.status} />
                  </div>
                  {(isSelectMode || showDeletedItems) && (
                    <div className="absolute top-3 left-3">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                        checked={selectedProducts.includes(item.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(item.id);
                        }}
                      />
                    </div>
                  )}
                  {showDeletedItems && (
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="bg-red-100/90 backdrop-blur text-red-800 text-xs px-3 py-1.5 rounded-lg font-medium">
                        Deleted: {formatDate(item.deletedAt)}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-4 flex-grow border-t border-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-1.5 line-clamp-1 group-hover:text-blue-600 transition-colors">{item.name}</h3>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded text-xs">{item.sku}</span>
                    <span className="text-gray-500 text-xs">{item.category || "Uncategorized"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="block text-xs text-gray-500 mb-1">Quantity</span>
                      <span className={`text-sm font-bold ${
                        item.status === 'Out of Stock' ? 'text-red-600' : 
                        item.status === 'Low Stock' ? 'text-amber-600' : 
                        'text-gray-900'
                      }`}>
                        {item.quantityInStock}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="block text-xs text-gray-500 mb-1">Price</span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(item.unitPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Stock Value</span>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(item.quantityInStock * item.costPrice)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-100 p-3 bg-gray-50/50 flex justify-end space-x-1.5">
                  {showDeletedItems ? (
                    // Actions for deleted items
                    <button 
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(item);
                      }}
                      title={`Restore ${item.name}`}
                    >
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    // Actions for active items
                    <>
                      <button 
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {pagePermissions.canUpdateInventory && (
                        <button 
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          onClick={(e) => handleEditProduct(item, e)}
                          title="Edit Product"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {pagePermissions.canDeleteInventory && (
                        <button 
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          onClick={(e) => handleDeleteProduct(item.id, e)}
                          title={`Delete ${item.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            
            {inventory.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="bg-gray-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  {(searchTerm || categoryFilter !== "All" || statusFilter !== "All" || locationFilter !== "All") 
                    ? "Try adjusting your search or filter criteria" 
                    : "Get started by adding your first product to the inventory"}
                </p>
                <button 
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-200 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 mx-auto"
                  onClick={handleAddProduct}
                >
                  <Plus size={18} />
                  Add Your First Product
                </button>
              </div>
            )}
          </div>
        )
      )}
      
      {/* NEW: Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{(() => { const p = Number(pagination.currentPage) || 1; const s = Number(pagination.pageSize) || 20; const n = (p - 1) * s + 1; return Number.isFinite(n) ? n : 0; })()}</span> to <span className="font-semibold text-gray-900">{(() => { const p = Number(pagination.currentPage) || 1; const s = Number(pagination.pageSize) || 20; const t = Number(pagination.totalItems) || 0; const n = Math.min(p * s, t); return Number.isFinite(n) ? n : 0; })()}</span> of <span className="font-semibold text-gray-900">{Number.isFinite(Number(pagination.totalItems)) ? (Number(pagination.totalItems) || 0) : 0}</span> products
              </span>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show:</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-gray-600">per page</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 hover:text-gray-900"
              >
                First
              </button>
              
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 hover:text-gray-900"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-9 h-9 text-sm border rounded-lg transition-colors ${
                        pagination.currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 hover:text-gray-900"
              >
                Next
              </button>
              
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 hover:text-gray-900"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RefreshCw size={16} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            </div>
            <Link href="/stock/transactions" className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              View All
              <ChevronDown size={14} className="rotate-[-90deg]" />
            </Link>
          </div>
          
          <div className="divide-y divide-gray-50">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 flex items-start hover:bg-gray-50/50 transition-colors">
                  <div className={`p-2.5 rounded-full mr-3.5 flex-shrink-0 ${
                    transaction.type === "Stock In" ? 'bg-emerald-100' : 
                    transaction.type === "Stock Out" ? 'bg-red-100' : 
                    'bg-blue-100'
                  }`}>
                    {transaction.type === "Stock In" ? (
                      <ArrowUp size={14} className="text-emerald-600" />
                    ) : transaction.type === "Stock Out" ? (
                      <ArrowDown size={14} className="text-red-600" />
                    ) : (
                      <RefreshCw size={14} className="text-blue-600" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-semibold text-gray-900 block truncate">{transaction.product}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            transaction.type === "Stock In" ? 'bg-emerald-50 text-emerald-700' : 
                            transaction.type === "Stock Out" ? 'bg-red-50 text-red-700' : 
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {transaction.type}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(transaction.date)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-sm font-bold ${
                          transaction.type === "Stock In" ? 'text-emerald-600' : 
                          transaction.type === "Stock Out" ? 'text-red-600' : 
                          'text-gray-700'
                        }`}>
                          {transaction.quantity > 0 ? '+' : ''}{transaction.quantity} units
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-gray-500">
                <div className="bg-gray-100 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="h-7 w-7 text-gray-400" />
                </div>
                <p className="font-medium text-gray-600">No recent transactions found</p>
                <p className="text-sm text-gray-400 mt-1">Stock movements will appear here</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
            </div>
            <Link href="/stock/low-stock" className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              View All
              <ChevronDown size={14} className="rotate-[-90deg]" />
            </Link>
          </div>
          
          <div className="divide-y divide-gray-50">
            {(() => {
              const lowStockItems = inventory.filter(item => item.status === "Low Stock" || item.status === "Out of Stock");
              const totalPages = Math.ceil(lowStockItems.length / lowStockPageSize);
              const startIndex = (lowStockPage - 1) * lowStockPageSize;
              const endIndex = startIndex + lowStockPageSize;
              const paginatedItems = lowStockItems.slice(startIndex, endIndex);
              
              return (
                <>
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((item) => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center flex-grow min-w-0 mr-4">
                          <img src={item.image || "/api/placeholder/80/80"} alt={item.name} className="w-11 h-11 object-cover rounded-lg shadow-sm mr-3.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{item.sku}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                item.status === "Out of Stock" ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center flex-shrink-0">
                          <div className="text-right mr-4">
                            <div className="text-xs text-gray-500">Current / Reorder</div>
                            <div className={`font-bold ${item.status === "Out of Stock" ? "text-red-600" : "text-amber-600"}`}>
                              {item.quantityInStock} / {item.reorderPoint}
                            </div>
                          </div>
                          <button 
                            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm rounded-lg font-medium shadow-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestock(item);
                            }}
                          >
                            <Plus size={14} />
                            Restock
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-gray-500">
                      <div className="bg-green-100 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="h-7 w-7 text-green-500" />
                      </div>
                      <p className="font-medium text-gray-600">All stocked up!</p>
                      <p className="text-sm text-gray-400 mt-1">No low stock alerts at the moment</p>
                    </div>
                  )}
                  
                  {lowStockItems.length > 0 && (
                    <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {startIndex + 1} to {Math.min(endIndex, lowStockItems.length)} of {lowStockItems.length} alerts
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLowStockPage(prev => Math.max(1, prev - 1))}
                          disabled={lowStockPage === 1}
                          className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Prev
                        </button>
                        <div className="px-3 py-1.5 text-sm text-gray-600 flex items-center">
                          Page {lowStockPage} of {totalPages}
                        </div>
                        <button
                          onClick={() => setLowStockPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={lowStockPage === totalPages}
                          className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Product Detail Modal */}
      {isDetailOpen && selectedItem && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4 ">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fadeInUp">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{selectedItem.name}</h2>
              <button 
                className="text-gray-500 hover:text-gray-700 text-2xl"
                onClick={() => setIsDetailOpen(false)}
              >
                ×
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-1">
                  <div className="relative bg-gray-50 rounded-lg p-4">
                    <img 
                      src={selectedItem.image || "/api/placeholder/80/80"}
                      alt={selectedItem.name} 
                      className="w-full h-auto object-contain"
                    />
                    <div className="absolute top-2 right-2">
                      <StatusBadge status={selectedItem.status} />
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">SKU</span>
                      <div className="font-medium">{selectedItem.sku}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Category</span>
                      <div className="font-medium">{selectedItem.category}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Location</span>
                      <div className="font-medium">{selectedItem.location || 'Not specified'}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Last Updated</span>
                      <div className="font-medium">{formatDate(selectedItem.lastUpdated)}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-lg mb-4">Stock Information</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${
                        selectedItem.status === 'Out of Stock' ? 'text-red-600' : 
                        selectedItem.status === 'Low Stock' ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {parseFloat(selectedItem.originalStockLevel !== undefined ? selectedItem.originalStockLevel : selectedItem.quantityInStock || 0).toFixed(3)}
                      </div>
                      <div className="text-sm text-gray-500">In Stock</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{selectedItem.reorderPoint}</div>
                      <div className="text-sm text-gray-500">Reorder Point</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">-</div>
                      <div className="text-sm text-gray-500">Reserved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">-</div>
                      <div className="text-sm text-gray-500">On Order</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-lg mb-4">Pricing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Cost Price</span>
                      <div className="text-lg font-bold">{formatCurrency(selectedItem.costPrice)}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Selling Price</span>
                      <div className="text-lg font-bold">{formatCurrency(selectedItem.unitPrice)}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Profit Margin</span>
                      <div className="text-lg font-bold">
                        {Math.round(((selectedItem.unitPrice - selectedItem.costPrice) / selectedItem.unitPrice) * 100)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Stock Value</span>
                      <div className="text-lg font-bold">
                        {formatCurrency(
                          selectedItem.totalStockValue != null && !isNaN(Number(selectedItem.totalStockValue))
                            ? Number(selectedItem.totalStockValue)
                            : (selectedItem.quantityInStock * (selectedItem.costPrice || 0))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Product Units Display */}
              {selectedItem?.units && selectedItem.units.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg mb-6">
                  <h3 className="font-medium text-lg mb-4 text-blue-900">Product Units</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedItem.units.map((unit, index) => (
                      <div key={unit.id || index} className="bg-white p-3 rounded-md border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{unit.name || 'Unknown Unit'}</span>
                            <span className="text-sm text-gray-500">({unit.symbol || 'N/A'})</span>
                            {unit.isBaseUnit && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                Base Unit
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Price:</span>
                            <span className="font-medium">MWK {parseFloat(unit.unitPrice || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Cost:</span>
                            <span className="font-medium">MWK {parseFloat(unit.costPrice || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Stock:</span>
                            <span className={`font-medium ${
                              parseFloat(unit.quantityInStock || 0) <= parseFloat(unit.reorderPoint || 0) 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              {parseFloat(unit.quantityInStock || 0).toFixed(3)} {unit.symbol || ''}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Reorder:</span>
                            <span className="font-medium">{parseFloat(unit.reorderPoint || 0).toFixed(3)} {unit.symbol || ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="font-medium text-lg">Stock Movement History</h3>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {productTransactions.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {productTransactions.map((transaction, index) => {
                        const movementMeta = getMovementMeta(transaction);
                        const movementStyles = {
                          incoming: {
                            border: 'border-green-200',
                            badge: 'bg-green-100 text-green-700',
                            iconBg: 'bg-green-50',
                            iconColor: 'text-green-600',
                            quantity: 'text-green-600',
                            label: movementMeta.label || 'Incoming Stock',
                          },
                          outgoing: {
                            border: 'border-red-200',
                            badge: 'bg-red-100 text-red-700',
                            iconBg: 'bg-red-50',
                            iconColor: 'text-red-600',
                            quantity: 'text-red-600',
                            label: movementMeta.label || 'Sale / Stock Out',
                          },
                          adjustment: {
                            border: 'border-gray-200',
                            badge: 'bg-gray-100 text-gray-700',
                            iconBg: 'bg-gray-50',
                            iconColor: 'text-gray-500',
                            quantity: 'text-gray-700',
                            label: movementMeta.label || 'Adjustment',
                          },
                        };

                        const typeStyle = movementStyles[movementMeta.type] || movementStyles.adjustment;

                        const quantityValue = Math.abs(Number(transaction.quantity) || 0);
                        const displayQuantity =
                          movementMeta.type === 'incoming'
                            ? `+${quantityValue} units`
                            : movementMeta.type === 'outgoing'
                              ? `-${quantityValue} units`
                              : `${Number(transaction.quantity) || 0} units`;

                        return (
                          <div
                            key={transaction.id || index}
                            className={`p-3 flex items-start gap-3 border-l-4 ${typeStyle.border} hover:bg-gray-50 transition-colors`}
                          >
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center ${typeStyle.iconBg}`}>
                              {transaction.type === "Stock In" ? (
                                <ArrowUp size={14} className={typeStyle.iconColor} />
                              ) : transaction.type === "Stock Out" ? (
                                <ArrowDown size={14} className={typeStyle.iconColor} />
                              ) : (
                                <RefreshCw size={14} className={typeStyle.iconColor} />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${typeStyle.badge}`}>
                                  {typeStyle.label}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(transaction.date)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {transaction.product || selectedItem?.name || 'Product'}
                                  </p>
                                  {transaction.notes && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {transaction.notes}
                                    </p>
                                  )}
                                  {transaction.user && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      Logged by {transaction.user}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="text-right">
                                  <span className={`block text-sm font-semibold ${typeStyle.quantity}`}>
                                    {displayQuantity}
                                  </span>
                                  {transaction.balance !== undefined && (
                                    <span className="text-xs text-gray-400">
                                      Balance: {transaction.balance}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <RefreshCw className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm">No movement history found</p>
                      <p className="text-xs text-gray-400 mt-1">Stock transactions will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-between">
              <div className="flex space-x-2">
              {pagePermissions.canAdjustInventory &&(<> <button 
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm flex items-center gap-1 hover:bg-gray-50"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleTransactionClick("Stock In", selectedItem);
                  }}
                >
                  <Truck size={14} />
                  <span>Stock In</span>
                </button>
                <button 
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm flex items-center gap-1 hover:bg-gray-50"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleTransactionClick("Stock Out", selectedItem);
                  }}
                >
                  <ShoppingCart size={14} />
                  <span>Stock Out</span>
                </button>
                <button 
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm flex items-center gap-1 hover:bg-gray-50"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleTransactionClick("Adjustment", selectedItem);
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Adjust</span>
                </button> </>)}
                 {pagePermissions.canUpdateInventory &&(
                <button 
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm flex items-center gap-1 hover:bg-gray-50"
                  onClick={() => {
                    setSelectedItem(selectedItem);
                    setIsDetailOpen(false);
                    setIsUploadModalOpen(true);
                  }}
                >
                  <Upload size={14} />
                  <span>Upload Image</span>
                </button>)}
              </div>
              <div className="flex space-x-3">
                <button 
                  className="px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Close
                </button>
                {pagePermissions.canUpdateInventory &&(<button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleEditProduct(selectedItem);
                  }}
                >
                  Edit Product
                </button>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fadeIn"
          onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-xl font-semibold">{confirmDialog.title}</h3>
              <button 
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full p-1"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-start">
                <div className={`flex-shrink-0 p-2 rounded-full mr-4 ${
                  confirmDialog.type === 'danger' ? 'bg-red-100' : 
                  confirmDialog.type === 'warning' ? 'bg-yellow-100' : 
                  'bg-blue-100'
                }`}>
                  {confirmDialog.type === 'danger' ? (
                    <AlertCircle size={24} className="text-red-500" />
                  ) : confirmDialog.type === 'warning' ? (
                    <AlertTriangle size={24} className="text-yellow-500" />
                  ) : (
                    <AlertCircle size={24} className="text-blue-500" />
                  )}
                </div>
                <div className="text-gray-700">
                  {confirmDialog.message}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
              <button
                type="button"
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 
                  confirmDialog.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' : 
                  'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {isFormOpen && (
        <ProductForm 
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          product={isEditing ? selectedItem : null}
          onSubmit={handleProductSubmit}
          isSubmitting={isSubmitting}
          showToast={showToast}
          customCategories={customCategories}
          categoryOptions={categoryOptions}
          locations={locations}
          branches={branches}
          onLocationAdd={(newLocation) => {
            setLocations(prev => {
              if (!prev.includes(newLocation)) {
                return [...prev.filter(loc => loc !== "All"), newLocation, "All"].sort();
              }
              return prev;
            });
          }}
          onCategoryAdd={(newCategory) => {
            setCategoryOptions(prev => {
              if (!prev.includes(newCategory)) {
                return [...prev, newCategory].sort();
              }
              return prev;
            });
          }}
        />
      )}

      {/* Transaction Form Modal */}
      {isTransactionFormOpen && selectedItem && (
        <TransactionForm 
          isOpen={isTransactionFormOpen}
          onClose={() => {
            setIsTransactionFormOpen(false);
            setTransactionType(null); // Reset transaction type when closing
          }}
          product={selectedItem}
          initialType={transactionType} // Pass the transaction type from button click
          onSubmit={handleTransactionSubmit}
          isSubmitting={isSubmitting}
          showToast={showToast}
        />
      )}
      
      {/* Image Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold flex items-center">
                  <Paperclip className="w-5 h-5 mr-2 text-blue-600" />
                  Upload Image
                  {selectedItem && (
                    <span className="ml-2 text-sm text-gray-500">for {selectedItem.name}</span>
                  )}
                </h3>
                <button 
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
                  onClick={() => setIsUploadModalOpen(false)}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-5">
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
                <p className="text-xs text-gray-400">Supports: JPG, PNG, WebP (Max 2MB per file)</p>
              </div>
                
              {/* File Previews */}
              {uploadedFiles.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Uploaded Files ({uploadedFiles.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto p-1 rounded-md">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex-shrink-0 mr-3 text-gray-500">
                          <FileText className="w-5 h-5" />
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
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button 
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                onClick={() => setIsUploadModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center ${
                  (uploadedFiles.length === 0 || isUploading || !selectedItem) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={uploadedFiles.length === 0 || isUploading || !selectedItem}
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
                    Upload Image
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      
      {/* CSS for animations */}
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
      
      {/* Stock Transfers View */}
      {view === 'transfers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Stock Transfers</h2>
              <p className="text-gray-500 mt-1">Manage stock movements between branches</p>
            </div>
            <button
              onClick={() => { fetchTransfers(); fetchStockByBranch(); }}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all duration-200 flex items-center gap-2"
              title="Refresh"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <StockPerBranch
              branches={stockByBranch}
              loading={transfersLoading}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <StockTransfersList
              transfers={transfers}
              loading={transfersLoading}
              onRefresh={() => fetchTransfers()}
            />
          </div>

        </div>
      )}
      
      {/* NEW: Bulk Operations Modal */}
      <BulkInventoryOperations
        isOpen={isBulkOperationsOpen}
        onClose={() => setIsBulkOperationsOpen(false)}
        onUpload={handleBulkUpload}
        onExport={handleBulkExport}
        showToast={showToast}
        branches={branches}
      />
      
      {/* NEW: Bulk Tax Application Modal */}
      <BulkTaxApplicationModal
        isOpen={isBulkTaxModalOpen}
        onClose={() => setIsBulkTaxModalOpen(false)}
        products={inventory}
        showToast={showToast}
      />
      
      {/* Product Deletion Warning Modal */}
      <ProductDeletionWarningModal
        isOpen={deletionWarningModal.isOpen}
        onClose={() => setDeletionWarningModal({ isOpen: false, product: null, usageDetails: {} })}
        onConfirm={handleConfirmedDeletion}
        product={deletionWarningModal.product}
        usageDetails={deletionWarningModal.usageDetails}
      />

      {/* SKU Conflict Modal */}
      <SkuConflictModal
        isOpen={skuConflictModal.isOpen}
        onClose={() => setSkuConflictModal({ isOpen: false, conflictData: null, pendingFormData: null })}
        conflictData={skuConflictModal.conflictData}
        onRestoreProduct={handleRestoreProduct}
        onCreateWithNewSku={handleCreateWithNewSku}
        onCancel={handleSkuConflictCancel}
        isProcessing={isSubmitting}
      />

      {/* Stock Transfer Modal */}
      <StockTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSubmit={async (formData) => {
          const success = await handleCreateTransfer(formData);
          if (success) setShowTransferModal(false);
          return success;
        }}
        branches={branches}
        products={inventory}
        loading={isSubmitting}
      />

      {/* NEW: Expiry Alerts Modal */}
      {isExpiryAlertsOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden animate-fadeInUp">
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Expiry Alert System</h2>
                <button 
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
                  onClick={() => setIsExpiryAlertsOpen(false)}
                  type="button"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-5 max-h-[80vh] overflow-y-auto">
              <ExpiryAlertSystem
                products={inventory}
                onViewProduct={handleViewProduct}
              />
            </div>
          </div>
        </div>
      )}
      {/* Batch Delete Modal */}
      {batchDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete {batchDeleteModal.products.length} Products
                </h3>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  You are about to delete the following products:
                </p>
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded p-3">
                  {batchDeleteModal.products.map(product => (
                    <div key={product.id} className="text-sm text-gray-700 py-1">
                      • {product.name} ({product.sku})
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for deletion (optional)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter reason..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmBatchDelete(e.target.value);
                    }
                  }}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setBatchDeleteModal({ isOpen: false, products: [] })}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const reason = document.querySelector('input[placeholder="Enter reason..."]')?.value;
                    confirmBatchDelete(reason);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {restoreModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <RotateCcw className="h-6 w-6 text-green-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Restore {restoreModal.products.length} Product{restoreModal.products.length > 1 ? 's' : ''}
                </h3>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  You are about to restore the following products:
                </p>
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded p-3">
                  {restoreModal.products.map(product => (
                    <div key={product.id} className="text-sm text-gray-700 py-1">
                      • {product.name} ({product.sku})
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setRestoreModal({ isOpen: false, products: [] })}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestore}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Restore Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Modal */}
      {showPurchaseOrderModal && (
        <PurchaseOrderModal
          isOpen={showPurchaseOrderModal}
          onClose={() => {
            setShowPurchaseOrderModal(false);
            setPurchaseOrderProduct(null);
          }}
          product={purchaseOrderProduct}
          suppliers={suppliers}
          suppliersLoading={suppliersLoading}
          products={inventory}
          onSave={handleSavePurchaseOrder}
        />
      )}

    </div>
    </PermissionGuard>
  );
};

// Helper function to format product label
function formatProductLabel(product) {
  if (!product) return "";
  const code = product.sku || product.code || "";
  const name = product.name || "";
  return code ? `${code} — ${name}` : name;
}

// Product Search Select Component
function ProductSearchSelect({
  products = [],
  value,
  onChange,
  placeholder = "Search products...",
  required = false,
}) {
  const containerRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value),
    [products, value]
  );

  useEffect(() => {
    if (!open) {
      setSearchTerm(selectedProduct ? formatProductLabel(selectedProduct) : "");
    }
  }, [selectedProduct, open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        if (selectedProduct) {
          setSearchTerm(formatProductLabel(selectedProduct));
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return products.slice(0, 50);
    }
    return products
      .filter((product) => formatProductLabel(product).toLowerCase().includes(term))
      .slice(0, 50);
  }, [products, searchTerm]);

  const handleSelect = (product) => {
    onChange?.(product.id);
    setOpen(false);
    setSearchTerm(formatProductLabel(product));
  };

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" value={value || ""} required={required} />
      <input
        type="text"
        value={searchTerm}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setOpen(true);
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredProducts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No products found</p>
          ) : (
            filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => handleSelect(product)}
              >
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">
                    {product.sku || product.code || "No SKU"} • In stock:{" "}
                    {product.stockLevel ?? product.quantityInStock ?? "N/A"}
                  </p>
                </div>
                <div className="text-xs font-semibold text-gray-700">
                  MWK{" "}
                  {Number(
                    product.costPrice || product.cost || product.purchasePrice || product.price || 0
                  ).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Get default product cost
const getDefaultProductCost = (product) => {
  if (!product) return 0;
  
  // Helper to convert Decimal/object values to numbers
  const toNumber = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null) {
      // Handle Prisma Decimal type
      return Number(val) || null;
    }
    const num = Number(val);
    return isNaN(num) ? null : num;
  };
  
  // Try multiple fields in order of preference
  // Priority: lastPurchaseCost > cost > averageCost > costPrice > purchasePrice
  const lastPurchaseCost = toNumber(product.lastPurchaseCost);
  const cost = toNumber(product.cost);
  const averageCost = toNumber(product.averageCost);
  const costPrice = toNumber(product.costPrice);
  const purchasePrice = toNumber(product.purchasePrice);
  const unitCost = toNumber(product.unitCost);
  const price = toNumber(product.price);
  
  const value = lastPurchaseCost || cost || averageCost || costPrice || purchasePrice || unitCost || price || 0;
  return value;
};

// Form Section Component
function FormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-gray-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Purchase Order Modal Component
function PurchaseOrderModal({ isOpen, onClose, product, suppliers, suppliersLoading, products, onSave }) {
  const [form, setForm] = useState({
    supplierId: "",
    poDate: format(new Date(), "yyyy-MM-dd"),
    expectedDeliveryDate: "",
    status: "Approved",
    notes: "",
  });
  const [items, setItems] = useState([
    {
      productId: product?.id || "",
      quantityOrdered: String(product?.reorderPoint || 10),
      unitCost: String(getDefaultProductCost(product)),
      description: product?.description || product?.name || "",
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (product) {
      setItems([
        {
          productId: product.id,
          quantityOrdered: String(product.reorderPoint || 10),
          unitCost: String(getDefaultProductCost(product)),
          description: product.description || product.name || "",
        },
      ]);
    }
  }, [product]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantityOrdered || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  );

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [key]: value };
        if (key === "productId" && value) {
          const selectedProduct = products.find((p) => p.id === value);
          if (selectedProduct) {
            const defaultCost = getDefaultProductCost(selectedProduct);
            // Always populate cost when product is selected (user can still manually change it)
            if (defaultCost > 0) {
              updated.unitCost = String(defaultCost);
            } else {
              // If no cost found, set to empty string so user can enter manually
              updated.unitCost = "";
            }
            // Also auto-populate description if empty
            if (!updated.description) {
              updated.description = selectedProduct.description || selectedProduct.name || "";
            }
          } else {
            // Product not found, clear the cost
            updated.unitCost = "";
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", quantityOrdered: "", unitCost: "", description: "" }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const normalizedItems = items.map((item) => ({
        ...item,
        quantityOrdered: Number(item.quantityOrdered || 0),
        unitCost: Number(item.unitCost || 0),
      }));
      await onSave({ ...form, status: "Approved", items: normalizedItems });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-semibold text-gray-900">New Purchase Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <FormSection
              title="Order Information"
              description="Supplier and timing for this purchase request."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  {suppliersLoading ? (
                    <div className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      Loading suppliers...
                    </div>
                  ) : (
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={form.supplierId}
                      onChange={(e) => handleChange("supplierId", e.target.value)}
                      required
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.supplierName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">PO Date *</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.poDate}
                    onChange={(e) => handleChange("poDate", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expected Delivery</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.expectedDeliveryDate}
                    onChange={(e) => handleChange("expectedDeliveryDate", e.target.value)}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Line Items"
              description="Each product row drives receiving, costing, and billing."
            >
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 sm:grid-cols-5"
                  >
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Product</label>
                      <ProductSearchSelect
                        products={products}
                        value={item.productId}
                        onChange={(productId) => handleItemChange(idx, "productId", productId)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={item.quantityOrdered}
                        onChange={(e) => handleItemChange(idx, "quantityOrdered", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Cost Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Description</label>
                      <input
                        type="text"
                        placeholder="Optional note"
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                      <span>
                        MWK{" "}
                        {(
                          Number(item.quantityOrdered || 0) * Number(item.unitCost || 0)
                        ).toLocaleString()}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => removeItem(idx)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  + Add Item
                </button>
              </div>
            </FormSection>

            <FormSection title="Notes & Totals" description="Internal instructions and quick totals overview.">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Delivery windows, approvals, offloading instructions…"
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-indigo-700">Subtotal</p>
                    <p className="text-sm text-indigo-900">Products × cost price</p>
                  </div>
                  <div className="text-lg font-semibold text-indigo-900">
                    MWK {subtotal.toLocaleString()}
                  </div>
                </div>
              </div>
            </FormSection>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Purchase Order"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const ProductForm = ({ isOpen, onClose, product, onSubmit, isSubmitting, showToast, customCategories = [], categoryOptions = [], locations = [], onLocationAdd, onCategoryAdd, branches = [] }) => {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    description: "",
    quantityInStock: "",
    reorderPoint: "",
    unitPrice: "",
    costPrice: "",
    location: "",
    image: "", // This will store the URL, not the blob
    branchId: "", // Branch assignment
    // New enhanced fields
    expiryDate: "",
    discountAmount: "",
    isPerishable: false,
    batchNumber: "",
    supplier: "",
    weight: "",
    dimensions: "",
    barcode: "",
    tags: [],
    // Unit management fields
    unitManagementEnabled: false,
    selectedBaseUnit: null,
    selectedUnits: [],
    unitConfigurations: {},
    // Tax assignment fields
    selectedTaxIds: []
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [newTag, setNewTag] = useState("");
  
  // Unit management state
  const [baseUnits, setBaseUnits] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  
  // Tax management state
  const [taxTypes, setTaxTypes] = useState([]);
  const [taxesLoading, setTaxesLoading] = useState(false);

  // Fetch base units and units when component mounts
  useEffect(() => {
    const fetchUnits = async () => {
      setUnitsLoading(true);
      try {
        const response = await fetch('/api/units?includeUnits=true');
        if (response.ok) {
          const data = await response.json();
          setBaseUnits(data.baseUnits);
          
          // Flatten all units from all base units
          const allUnits = data.baseUnits.flatMap(baseUnit => 
            baseUnit.units.map(unit => ({ ...unit, baseUnitId: baseUnit.id }))
          );
          setUnits(allUnits);
        }
      } catch (error) {
        console.error('Error fetching units:', error);
        showToast('error', 'Error', 'Failed to load unit data');
      } finally {
        setUnitsLoading(false);
      }
    };

    if (isOpen) {
      fetchUnits();
    }
  }, [isOpen, showToast]);

  // Fetch tax types when component mounts
  useEffect(() => {
    const fetchTaxTypes = async () => {
      setTaxesLoading(true);
      try {
        const response = await fetch('/api/tax-types?status=Active');
        if (response.ok) {
          const data = await response.json();
          setTaxTypes(Array.isArray(data?.taxTypes) ? data.taxTypes : (Array.isArray(data) ? data : []));
        }
      } catch (error) {
        console.error('Error fetching tax types:', error);
        showToast('error', 'Error', 'Failed to load tax types');
      } finally {
        setTaxesLoading(false);
      }
    };

    if (isOpen) {
      fetchTaxTypes();
    }
  }, [isOpen, showToast]);

  // Fetch product taxes when editing
  useEffect(() => {
    const fetchProductTaxes = async () => {
      if (product && product.id) {
        try {
          console.log('Fetching taxes for product:', product.id);
          const response = await fetch(`/api/products/${product.id}/taxes`);
          console.log('Tax fetch response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Fetched tax data:', data);
            // API returns { taxes: [...] } or sometimes [] when table missing
            const list = Array.isArray(data) ? data : (Array.isArray(data?.taxes) ? data.taxes : []);
            const taxIds = list.map(pt => pt.taxTypeId ?? pt.id).filter(Boolean);
            console.log('Setting selectedTaxIds to:', taxIds);
            setFormData(prev => ({ ...prev, selectedTaxIds: taxIds }));
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error fetching taxes:', errorData);
            setFormData(prev => ({ ...prev, selectedTaxIds: [] }));
          }
        } catch (error) {
          console.error('Error fetching product taxes:', error);
          setFormData(prev => ({ ...prev, selectedTaxIds: [] }));
        }
      } else {
        setFormData(prev => ({ ...prev, selectedTaxIds: [] }));
      }
    };

    if (isOpen && product) {
      fetchProductTaxes();
    } else if (isOpen && !product) {
      setFormData(prev => ({ ...prev, selectedTaxIds: [] }));
    }
  }, [isOpen, product]);

  // Stable callbacks for unit management
  const handleUnitConfigurationChange = useCallback((configs) => {
    setFormData(prev => ({ ...prev, unitConfigurations: configs }));
  }, []);

  const handleBaseUnitChange = useCallback((baseUnit) => {
    setFormData(prev => ({ ...prev, selectedBaseUnit: baseUnit }));
  }, []);

  const handleUnitsChange = useCallback((units) => {
    setFormData(prev => ({ ...prev, selectedUnits: units }));
  }, []);

  // Reset form when opening for new product
  useEffect(() => {
    if (!product && isOpen) {
      // Reset form to initial state when creating a new product
      setFormData({
        name: "",
        sku: "",
        category: "",
        description: "",
        quantityInStock: "",
        reorderPoint: "",
        unitPrice: "",
        costPrice: "",
        location: "",
        image: "",
        branchId: "",
        expiryDate: "",
        discountAmount: "",
        isPerishable: false,
        batchNumber: "",
        supplier: "",
        weight: "",
        dimensions: "",
        barcode: "",
        tags: [],
        unitManagementEnabled: false,
        selectedBaseUnit: null,
        selectedUnits: [],
        unitConfigurations: {},
        selectedTaxIds: []
      });
      setPreviewUrl(null);
      setImageFile(null);
      setErrors({});
    }
  }, [product, isOpen]);

  // If editing, populate the form with product data
  useEffect(() => {
    if (product) {
      // Check if product has units configured
      const hasUnits = product.units && product.units.length > 0;
      
      console.log("=== FRONTEND EDIT DEBUG ===");
      console.log("Editing product:", {
        name: product.name,
        quantityInStock: product.quantityInStock,
        originalStockLevel: product.originalStockLevel,
        stockLevel: product.stockLevel,
        hasUnits: hasUnits
      });
      console.log("Available stock values:", {
        productQuantityInStock: product.quantityInStock,
        productStockLevel: product.stockLevel,
        productOriginalStockLevel: product.originalStockLevel,
        willUseForForm: hasUnits ? (product.stockLevel || product.originalStockLevel || "") : (product.quantityInStock || "")
      });
      console.log("===========================");
      
      // Prepare unit management data
      let unitManagementData = {
        unitManagementEnabled: hasUnits,
        selectedBaseUnit: null,
        selectedUnits: [],
        unitConfigurations: {}
      };

      if (hasUnits) {
        // Helper function to normalize unit structure (handles both nested and flattened)
        const getUnit = (pu) => pu.unit || pu;
        
        // Find the base unit from the first unit's baseUnit
        const firstUnit = product.units[0];
        const firstUnitData = getUnit(firstUnit);
        if (firstUnitData?.baseUnit) {
          // Find the base unit in our loaded baseUnits
          const baseUnitId = firstUnitData.baseUnit?.id || firstUnitData.baseUnit;
          const baseUnit = baseUnits.find(bu => bu.id === baseUnitId);
          if (baseUnit) {
            unitManagementData.selectedBaseUnit = baseUnit;
          }
        }

        // Prepare selected units and configurations
        unitManagementData.selectedUnits = product.units
          .filter(pu => {
            const unit = getUnit(pu);
            return unit && unit.id; // Filter out any undefined units
          })
          .map(pu => {
            const unit = getUnit(pu);
            return {
              id: unit.id,
              name: unit.name,
              symbol: unit.symbol,
              conversionToBase: unit.conversionToBase,
              isBaseUnit: unit.isBaseUnit,
              baseUnitId: unit.baseUnit?.id || unit.baseUnit
            };
          });

        // Prepare unit configurations
        unitManagementData.unitConfigurations = {};
        product.units.forEach(pu => {
          const unit = getUnit(pu);
          if (unit && unit.id) {
            unitManagementData.unitConfigurations[unit.id] = {
              unitPrice: parseFloat(pu.unitPrice || 0).toFixed(2),
              costPrice: parseFloat(pu.costPrice || 0).toFixed(2),
              quantityInStock: parseFloat(pu.quantityInStock || 0).toFixed(3),
              reorderPoint: parseFloat(pu.reorderPoint || 0).toFixed(3),
              isDefault: pu.isDefault || false
            };
          }
        });
      }

      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        category: product.category || "",
        description: product.description || "",
        // Use original stock level for editing, not the calculated effective stock level
        // When unit management is enabled, always use the actual database stock level
        quantityInStock: hasUnits ? (product.stockLevel || product.originalStockLevel || "") : (product.quantityInStock || ""),
        reorderPoint: product.reorderPoint || "",
        unitPrice: product.unitPrice || "",
        costPrice: product.costPrice || "",
        location: product.location || "",
        image: product.image || "", // Use the stored URL
        branchId: product.branchId || "", // Branch assignment
        // New enhanced fields
        expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : "",
        discountAmount: product.discountAmount || "",
        isPerishable: product.isPerishable || false,
        batchNumber: product.batchNumber || "",
        supplier: product.supplier || "",
        weight: product.weight || "",
        dimensions: product.dimensions || "",
        barcode: product.barcode || "",
        tags: product.tags || [],
        // Unit management fields
        ...unitManagementData
      });
      
      // Set preview URL if available
      if (product.image) {
        setPreviewUrl(product.image);
      }
    }
  }, [product, baseUnits]); // Add baseUnits as dependency
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // For number fields, allow empty string or convert to number
    let processedValue;
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value) || '';
    } else if (type === 'checkbox') {
      processedValue = checked;
    } else {
      processedValue = value;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    // Clear error for this field when user changes it
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };
  
  // Handle tag addition
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag("");
    }
  };
  
  // Handle tag removal
  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };
  
  // Handle image file change
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("error", "Image size exceeds 2MB limit");
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showToast("error", "Please upload an image file");
        return;
      }
      
      // Create a preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setImageFile(file);
      
      // Show feedback
      showToast("info", "Image selected", file.name);
    }
  };
  
  // Validate form data
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Product name is required";
    }
    
    if (!formData.category.trim()) {
      newErrors.category = "Category is required";
    }
    
    if (formData.unitPrice !== '' && formData.unitPrice < 0) newErrors.unitPrice = "Unit price cannot be negative";
    if (formData.costPrice !== '' && formData.costPrice < 0) newErrors.costPrice = "Cost price cannot be negative";
    if (formData.quantityInStock !== '' && formData.quantityInStock < 0) newErrors.quantityInStock = "Quantity cannot be negative";
    if (formData.reorderPoint !== '' && formData.reorderPoint < 0) newErrors.reorderPoint = "Reorder point cannot be negative";
    if (formData.discountAmount !== '' && formData.discountAmount < 0) newErrors.discountAmount = "Discount amount cannot be negative";
    if (formData.weight !== '' && formData.weight < 0) newErrors.weight = "Weight cannot be negative";
    
    if (formData.isPerishable && !formData.expiryDate) {
      newErrors.expiryDate = "Expiry date is required for perishable items";
    }
    if (formData.expiryDate && new Date(formData.expiryDate) < new Date()) {
      newErrors.expiryDate = "Expiry date cannot be in the past";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Determine product status based on quantity and reorder point
    const quantityInStock = formData.quantityInStock === '' ? 0 : parseFloat(formData.quantityInStock) || 0;
    const reorderPoint = formData.reorderPoint === '' ? 0 : parseFloat(formData.reorderPoint) || 0;
    
    const status = quantityInStock === 0 ? "Out of Stock" :
                   quantityInStock <= reorderPoint ? "Low Stock" : "In Stock";
    
    // Ensure category is not empty, use "Uncategorized" as default
    const categoryValue = formData.category ? formData.category.trim() : "Uncategorized";
    
    try {
      // Prepare product data
      const productData = {
        ...formData,
        category: categoryValue,
        status,
        image: formData.image || "/api/placeholder/80/80",
        imageFile: imageFile, // Pass the image file to parent component
        // Convert empty strings to null for database
        quantityInStock: formData.quantityInStock === '' ? null : parseFloat(formData.quantityInStock),
        reorderPoint: formData.reorderPoint === '' ? null : parseFloat(formData.reorderPoint),
        unitPrice: formData.unitPrice === '' ? null : parseFloat(formData.unitPrice),
        costPrice: formData.costPrice === '' ? null : parseFloat(formData.costPrice),
        discountAmount: formData.discountAmount === '' ? null : parseFloat(formData.discountAmount),
        weight: formData.weight === '' ? null : parseFloat(formData.weight),
        // Branch assignment - only include if selected
        branchId: formData.branchId || null,
        // Unit management data
        unitManagementEnabled: formData.unitManagementEnabled,
        selectedBaseUnit: formData.selectedBaseUnit,
        selectedUnits: formData.selectedUnits,
        unitConfigurations: formData.unitConfigurations
      };
      
      // Submit the product data - parent component will handle image uploads
      await onSubmit(productData);
    } catch (error) {
      console.error("Error saving product:", error);
      showToast("error", "Failed to save product", error.message);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fadeInUp">
        <div className="p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{product ? "Edit Product" : "Add New Product"}</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              onClick={onClose}
              type="button"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Image upload on the left side */}
              <div className="md:col-span-1">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Product Image</label>
                  
                  {/* Image preview */}
                  <div 
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all hover:border-blue-400 hover:bg-gray-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <div className="relative">
                        <img 
                          src={previewUrl} 
                          alt="Product preview" 
                          className="w-full h-32 object-contain mb-2"
                        />
                        <button 
                          type="button"
                          className="absolute top-0 right-0 bg-red-100 text-red-600 p-1 rounded-full hover:bg-red-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewUrl(null);
                            setImageFile(null);
                            setFormData(prev => ({ ...prev, image: "" }));
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-500">Click to upload product image</p>
                        <p className="text-xs text-gray-400 mt-1">Max size: 2MB</p>
                      </>
                    )}
                    
                    <input 
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </div>
                </div>
              </div>
              
              {/* Form fields on the right side */}
              <div className="md:col-span-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name*</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full p-2 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                    placeholder="Enter product name"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                </div>
                
                <div>
                  <DynamicCategorySelect
                    value={formData.category}
                    onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    options={categoryOptions}
                    placeholder="Select or add category"
                    onAddCategory={async (newCategory) => {
                      try {
                        // Call the API to create the category
                        const response = await fetch('/api/categories', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            name: newCategory.trim(),
                            type: 'inventory'
                          })
                        });

                        if (response.ok) {
                          // Add the new category to the options
                          if (onCategoryAdd) {
                            onCategoryAdd(newCategory);
                          }
                          showToast("success", "Category added", `"${newCategory}" added to categories`);
                        } else {
                          const error = await response.json();
                          showToast("error", "Failed to add category", error.error);
                        }
                      } catch (error) {
                        console.error('Error adding category:', error);
                        showToast("error", "Failed to add category", "Network error occurred");
                      }
                    }}
                    required={true}
                    label="Category"
                    className={errors.category ? 'border-red-500' : ''}
                  />
                  {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Product description (optional)"
                  />
                </div>
              </div>
              
              {/* These fields span 2 columns on larger screens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (MWK)*</label>
                <input
                  type="number"
                  name="unitPrice"
                  value={formData.unitPrice === 0 || formData.unitPrice === '' ? '' : formData.unitPrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className={`w-full p-2 border ${errors.unitPrice ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="Selling price"
                />
                {errors.unitPrice && <p className="mt-1 text-sm text-red-500">{errors.unitPrice}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (MWK)*</label>
                <input
                  type="number"
                  name="costPrice"
                  value={formData.costPrice === 0 || formData.costPrice === '' ? '' : formData.costPrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className={`w-full p-2 border ${errors.costPrice ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="Purchase cost"
                />
                {errors.costPrice && <p className="mt-1 text-sm text-red-500">{errors.costPrice}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity In Stock*</label>
                <input
                  type="number"
                  name="quantityInStock"
                  value={formData.quantityInStock === 0 || formData.quantityInStock === '' ? '' : formData.quantityInStock}
                  onChange={handleChange}
                  min="0"
                  className={`w-full p-2 border ${errors.quantityInStock ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="Current quantity"
                />
                {errors.quantityInStock && <p className="mt-1 text-sm text-red-500">{errors.quantityInStock}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point*</label>
                <input
                  type="number"
                  name="reorderPoint"
                  value={formData.reorderPoint === 0 || formData.reorderPoint === '' ? '' : formData.reorderPoint}
                  onChange={handleChange}
                  min="0"
                  className={`w-full p-2 border ${errors.reorderPoint ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="Low stock threshold"
                />
                {errors.reorderPoint && <p className="mt-1 text-sm text-red-500">{errors.reorderPoint}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Quantity at which you'll receive a low stock alert
                </p>
              </div>
              
              <div className="md:col-span-2">
                <DynamicCategorySelect
                  value={formData.location}
                  onChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                  options={locations.filter(loc => loc !== "All")}
                  placeholder="Select or add location"
                  searchPlaceholder="Search locations..."
                  emptyMessage="No locations available"
                  emptySearchMessage="No locations found"
                  addNewPlaceholder="Enter new location name..."
                  onAddCategory={async (newLocation) => {
                    // Add to locations list for immediate UI update
                    if (onLocationAdd) {
                      onLocationAdd(newLocation);
                    }
                    showToast("success", "Location added", `"${newLocation}" added to locations`);
                  }}
                  required={false}
                  label="Location"
                />
              </div>
              
              {/* Branch Selection */}
              {branches.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch (Optional)</label>
                  <select
                    name="branchId"
                    value={formData.branchId}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md bg-white"
                  >
                    <option value="">All Branches (No specific branch)</option>
                    {branches
                      .filter(branch => branch.isActive !== false)
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name || branch.branchName || `Branch ${branch.id.substring(0, 8)}`}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Select a branch to assign this product to. Leave unselected to create a product available across all branches.
                  </p>
                </div>
              )}
              
              {/* Tax Assignment Section */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taxes
                  <span className="text-gray-400 text-xs ml-1">(Applied automatically in POS)</span>
                </label>
                {taxesLoading ? (
                  <div className="text-sm text-gray-500">Loading taxes...</div>
                ) : !Array.isArray(taxTypes) || taxTypes.length === 0 ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                    No active tax types available. <a href="/tax-types" className="text-blue-600 hover:underline">Create tax types</a> first.
                  </div>
                ) : (
                  <div className="space-y-2 p-3 border border-gray-300 rounded-md bg-gray-50 max-h-48 overflow-y-auto">
                    {(Array.isArray(taxTypes) ? taxTypes : []).map((tax) => (
                      <label key={tax.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.selectedTaxIds?.includes(tax.id) || false}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            console.log(`Tax ${tax.taxName} ${isChecked ? 'checked' : 'unchecked'}`);
                            
                            if (isChecked) {
                              const newIds = [...(formData.selectedTaxIds || []), tax.id];
                              console.log('New selectedTaxIds:', newIds);
                              setFormData(prev => ({
                                ...prev,
                                selectedTaxIds: newIds
                              }));
                            } else {
                              const newIds = (formData.selectedTaxIds || []).filter(id => id !== tax.id);
                              console.log('New selectedTaxIds:', newIds);
                              setFormData(prev => ({
                                ...prev,
                                selectedTaxIds: newIds
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 flex-1">
                          <span className="font-medium">{tax.taxName}</span>
                          {tax.taxCode && <span className="text-gray-500 ml-1">({tax.taxCode})</span>}
                          <span className="text-gray-500 ml-2">
                            - {tax.calculationType === 'Fixed' ? `${tax.taxRate} MWK` : `${tax.taxRate}%`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Select one or more taxes to apply to this product. Taxes are calculated automatically during sales.
                </p>
              </div>
              
              {/* Enhanced Stock Management Fields */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-medium text-gray-800 mb-4 border-b pb-2">Enhanced Details</h3>
              </div>
              
              {/* Unit Management Section */}
              <div className="md:col-span-2">
                <UnitManagement
                  isEnabled={formData.unitManagementEnabled}
                  onToggle={(enabled) => setFormData(prev => ({ ...prev, unitManagementEnabled: enabled }))}
                  baseUnits={baseUnits}
                  units={units}
                  selectedBaseUnit={formData.selectedBaseUnit}
                  onBaseUnitChange={handleBaseUnitChange}
                  selectedUnits={formData.selectedUnits}
                  onUnitsChange={handleUnitsChange}
                  unitConfigurations={formData.unitConfigurations}
                  onConfigurationChange={handleUnitConfigurationChange}
                  baseUnitPrice={parseFloat(formData.unitPrice) || 0}
                  baseCostPrice={parseFloat(formData.costPrice) || 0}
                  baseQuantity={parseFloat(formData.quantityInStock) || 0}
                  baseReorderPoint={parseFloat(formData.reorderPoint) || 0}
                  disabled={isSubmitting}
                />
              </div>
              
              {/* Perishable Items Section */}
              <div className="md:col-span-2">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    name="isPerishable"
                    checked={formData.isPerishable}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">This is a perishable item</label>
                </div>
              </div>
              
              {formData.isPerishable && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date*</label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full p-2 border ${errors.expiryDate ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                    />
                    {errors.expiryDate && <p className="mt-1 text-sm text-red-500">{errors.expiryDate}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                    <input
                      type="text"
                      name="batchNumber"
                      value={formData.batchNumber}
                      onChange={handleChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Batch/Lot number"
                    />
                  </div>
                </>
              )}
              
              {/* Pricing and Discounts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount (MWK)</label>
                <input
                  type="number"
                  name="discountAmount"
                  value={formData.discountAmount === 0 || formData.discountAmount === '' ? '' : formData.discountAmount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className={`w-full p-2 border ${errors.discountAmount ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="Fixed discount amount"
                />
                {errors.discountAmount && <p className="mt-1 text-sm text-red-500">{errors.discountAmount}</p>}
                <p className="mt-1 text-xs text-gray-500">Fixed amount discount (not percentage)</p>
              </div>
              
              {/* Product Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Supplier name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight === 0 || formData.weight === '' ? '' : formData.weight}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className={`w-full p-2 border ${errors.weight ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="Product weight"
                />
                {errors.weight && <p className="mt-1 text-sm text-red-500">{errors.weight}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions (LxWxH cm)</label>
                <input
                  type="text"
                  name="dimensions"
                  value={formData.dimensions}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 10x5x2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Product barcode"
                />
              </div>
              
              {/* Tags Section */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 p-2 border border-gray-300 rounded-md"
                    placeholder="Add a tag and press Enter"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                
                {/* Display existing tags */}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Save size={16} className="mr-1" />
                {product ? "Update Product" : "Create Product"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Transaction Form Component
const TransactionForm = ({ isOpen, onClose, product, initialType, onSubmit, isSubmitting, showToast }) => {
  const [formData, setFormData] = useState({
    type: initialType || "Stock In", // Use initialType if provided, otherwise default to "Stock In"
    quantity: "",
    unitCost: "", // For FIFO costing when adding stock
    notes: ""
  });
  
  const [errors, setErrors] = useState({});
  
  // Reset form when product or initialType changes
  useEffect(() => {
    // Pre-fill unit cost with product's current cost for Stock In
    const defaultCost = product?.costPrice || product?.cost || product?.lastPurchaseCost || "";
    setFormData({
      type: initialType || "Stock In", // Use initialType if provided
      quantity: "",
      unitCost: initialType === "Stock In" ? (defaultCost || "") : "",
      notes: ""
    });
    setErrors({});
  }, [product, initialType]); // Add initialType to dependencies
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    // For number fields, allow empty string or convert to number
    let processedValue;
    if (type === 'number') {
      // For unitCost, allow decimals; for quantity, use integers
      if (name === 'unitCost') {
        processedValue = value === '' ? '' : (isNaN(parseFloat(value)) ? '' : value);
      } else {
        processedValue = value === '' ? '' : parseInt(value, 10) || '';
      }
    } else {
      processedValue = value;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    // Clear error for this field when user changes it
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };
  
  // Validate form data
  const validateForm = () => {
    const newErrors = {};
    
    if (formData.quantity === '' || formData.quantity <= 0) {
      newErrors.quantity = "Quantity must be greater than zero";
    }
    
    const availableStock = product.originalStockLevel !== undefined ? product.originalStockLevel : product.quantityInStock;
    if (formData.type === "Stock Out" && product && formData.quantity > availableStock) {
      newErrors.quantity = `Cannot remove more than available stock (${availableStock})`;
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      // Show the first error as a toast
      showToast("error", "Please correct the form errors", Object.values(newErrors)[0]);
      return false;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    // Calculate new quantity for preview
    const quantity = formData.quantity === '' ? 0 : parseInt(formData.quantity) || 0;
    const currentStock = product?.originalStockLevel !== undefined ? product.originalStockLevel : (product?.quantityInStock || 0);
    let newQuantity = currentStock;
    
    if (formData.type === "Stock In") {
      newQuantity += quantity;
    } else if (formData.type === "Stock Out") {
      newQuantity -= quantity;
    } else if (formData.type === "Adjustment") {
      newQuantity = quantity;
    }
    
    // Add toast preview for large changes
    const isLargeChange = quantity >= 10;
    
    if (isLargeChange) {
      const actionText = formData.type === "Stock In" ? "adding" : 
                       formData.type === "Stock Out" ? "removing" : 
                       "adjusting to";
                       
      const confirmMessage = `Are you sure you want to ${actionText} ${quantity} units?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    // Show preview message
    showToast("info", `New stock level will be ${newQuantity} units`, null, 3000);
    
    onSubmit({
      ...formData,
      quantity: quantity
    });
  };
  
  if (!isOpen || !product) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fadeInUp">
        <div className="p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Record Transaction</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              onClick={onClose}
              type="button"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-5">
          <div className="mb-6 flex items-center">
            <div className="w-16 h-16 mr-4 flex-shrink-0">
              <img 
                src={product?.image || "/api/placeholder/80/80"} 
                alt={product?.name || "Product"} 
                className="w-full h-full object-contain rounded-md"
              />
            </div>
            <div>
              <h3 className="font-medium">{product?.name}</h3>
              <p className="text-sm text-gray-500">
                Current Stock: <span className="font-medium">{product?.quantityInStock}</span>
              </p>
              {product?.reorderPoint && (
                <p className="text-xs text-gray-500">
                  Reorder Point: <span className="font-medium">{product?.reorderPoint}</span>
                </p>
              )}
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type*</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="Stock In">Stock In</option>
                  <option value="Stock Out">Stock Out</option>
                  <option value="Adjustment">Adjustment</option>
                </select>
                
                <p className="mt-1 text-xs text-gray-500">
                  {formData.type === "Stock In" ? 
                    "Add inventory when new stock arrives" : 
                    formData.type === "Stock Out" ? 
                    "Remove inventory when stock is taken" : 
                    "Set the exact inventory count (after physical count)"}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity*</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  className={`w-full p-2 border ${errors.quantity ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="Enter quantity"
                />
                {errors.quantity && <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>}
              </div>
              
              {formData.type === "Stock In" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Cost (MWK)
                    <span className="text-gray-400 text-xs ml-1">(for FIFO costing)</span>
                  </label>
                  <input
                    type="number"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className={`w-full p-2 border ${errors.unitCost ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                    placeholder="Purchase cost per unit"
                  />
                  {errors.unitCost && <p className="mt-1 text-sm text-red-500">{errors.unitCost}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.unitCost ? 
                      `Total: MWK ${(parseFloat(formData.quantity || 0) * parseFloat(formData.unitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` :
                      `⚠️ Will use product's current cost (${product?.cost || product?.costPrice || 0}) - Enter cost for accurate FIFO tracking`}
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Add any additional notes here..."
                ></textarea>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                {formData.type === "Stock In" ? <Truck size={16} className="mr-1" /> : 
                 formData.type === "Stock Out" ? <ShoppingCart size={16} className="mr-1" /> :
                 <RefreshCw size={16} className="mr-1" />}
                Record {formData.type}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
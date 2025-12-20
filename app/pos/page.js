"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  Search, 
  User, 
  Users, 
  ChevronDown, 
  Loader, 
  Check, 
  Trash2, 
  Edit3,
  Calculator,
  Receipt,
  DollarSign,
  Package,
  AlertCircle,
  Save,
  RefreshCw,
  Calendar,
  Info,
  CheckCircle,
  Ban,
  RotateCcw,
  Percent,
  ArrowRight,
  Download,
  Upload,
  FileText,
  UserPlus,
  Printer

} from 'lucide-react';
import { 
  fetchSales, 
  createSale, 
  getSalesStatistics,
  fetchProductsForSale,
  fetchProductsForSaleAll,
  fetchClients,
  printReceipt,
  voidSale,
  refundSale
} from "@/app/services/salesService";
import ClientModal from "@/components/ClientModal";
import ClientSearchCombobox from "@/components/ClientSearchCombobox";
import PermissionGuard from "@/components/PermissionGuard";
import UnitBasedQuantityInput from "@/components/UnitBasedQuantityInput";
import { getPermission } from "@/lib/permissions";
import { getPaymentMethodName, paymentMethods } from '@/lib/paymentMethods';

const POSPage = () => {
  const router = useRouter();
  
  // Tab and customer selection
  const [activeTab, setActiveTab] = useState("walkIn");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  
  // Historical transaction state
  const [historicalDate, setHistoricalDate] = useState('');
  const [originalReference, setOriginalReference] = useState('');
  const [migrationBatch, setMigrationBatch] = useState('');
  
  // Batch upload state
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);
  
  // Sales data
  const [recentSales, setRecentSales] = useState([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [salesError, setSalesError] = useState(null);
  const [statistics, setStatistics] = useState({
    total: { count: 0, amount: '0' },
    voided: { count: 0, amount: '0' },
    refunded: { count: 0, amount: '0' },
    byPaymentMethod: []
  });
  
  // Products
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  // Clients
  const [clients, setClients] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [filteredClients, setFilteredClients] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Current sale state
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [saleError, setSaleError] = useState(null);
  const [saleNotes, setSaleNotes] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  
  // Custom product entry
  const [showCustomProduct, setShowCustomProduct] = useState(false);
  const [customProduct, setCustomProduct] = useState({
    name: "",
    price: "",
    description: ""
  });
  
  // Void/Refund modals
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedSaleForAction, setSelectedSaleForAction] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isProcessingVoid, setIsProcessingVoid] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  // Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  
  // References
  const productSearchRef = useRef(null);
  const receiptModalRef = useRef(null);
  
  // Add state for showing the client modal
  const [showClientModal, setShowClientModal] = useState(false);
  const [pagePermissions, setPagePermissions] = useState({ 
    canVoidSales: false,
    canCreateSales: false,
    canDeleteSales:false, 
    canExportSales:false, 
    canRefundSales:false, 
    canUpdateSales:false, 
  });
  
  useEffect(() => {
    const fetchPermissions = async () => { 
      const canVoidSales = await getPermission("sales.void");
      const canCreateSales = await getPermission("sales.create");
      const canDeleteSales = await getPermission("sales.delete");
      const canExportSales = await getPermission("sales.export"); 
      const canRefundSales = await getPermission("sales.refund");
      const canUpdateSales = await getPermission("sales.update"); 
  
      setPagePermissions({ 
        canVoidSales,
        canCreateSales,
        canDeleteSales, 
        canExportSales, 
        canRefundSales, 
        canUpdateSales,   
        });
    };
  
    fetchPermissions();
  }, []);
  // Load recent sales, products, and clients on initial render
  useEffect(() => {
    loadRecentSales();
    loadProducts();
    loadClients();
    loadStatistics();
    
    // Set default tax rate from tenant settings
    // This would typically come from your API, but we'll hard-code it for now
    // setTaxRate(16.5); // This line is removed
  }, []);
  
  // Filter products based on search query
  useEffect(() => {
    if (productSearchQuery.trim() === "") {
      setFilteredProducts(products);
    } else {
      const query = productSearchQuery.toLowerCase();
      const filtered = products.filter(
        product => 
          product.name.toLowerCase().includes(query) || 
          (product.sku && product.sku.toLowerCase().includes(query))
      );
      setFilteredProducts(filtered);
    }
  }, [productSearchQuery, products]);
  
  // Filter clients based on search query
  useEffect(() => {
    if (clientSearchQuery.trim() === "") {
      setFilteredClients(clients);
    } else {
      const query = clientSearchQuery.toLowerCase();
      const filtered = clients.filter(
        client => 
          client.name.toLowerCase().includes(query) || 
          (client.email && client.email.toLowerCase().includes(query))
      );
      setFilteredClients(filtered);
    }
  }, [clientSearchQuery, clients]);

  // Update search query when a customer is selected
  useEffect(() => {
    if (selectedCustomer && selectedCustomer !== "") {
      const selectedClient = clients.find(client => client.id === selectedCustomer);
      if (selectedClient) {
        setClientSearchQuery(selectedClient.name);
      }
    }
  }, [selectedCustomer, clients]);

  // Handle client search input changes
  const handleClientSearchChange = (e) => {
    const value = e.target.value;
    setClientSearchQuery(value);
    
    // If the search is cleared, clear the selection
    if (value.trim() === "") {
      setSelectedCustomer("");
    }
  };
  
  // Close modals when escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showProductSearch) setShowProductSearch(false);
        if (showReceiptModal) setShowReceiptModal(false);
        if (showCustomProduct) setShowCustomProduct(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProductSearch, showReceiptModal, showCustomProduct]);
  
  // Handle clicks outside of modals
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target)) {
        setShowProductSearch(false);
      }
      if (receiptModalRef.current && !receiptModalRef.current.contains(e.target) && showReceiptModal) {
        setShowReceiptModal(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReceiptModal]);
  
  // Reset success and error messages after 5 seconds
  useEffect(() => {
    if (saleSuccess || saleError) {
      const timer = setTimeout(() => {
        setSaleSuccess(false);
        setSaleError(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [saleSuccess, saleError]);
  
  // Load recent sales
  const loadRecentSales = async () => {
    try {
      setIsLoadingSales(true);
      setSalesError(null);
      
      const response = await fetchSales({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' });
      setRecentSales(response.sales || []);
    } catch (error) {
      console.error("Error loading sales:", error);
      setSalesError("Failed to load recent sales");
    } finally {
      setIsLoadingSales(false);
    }
  };
  
  // Load sales statistics
  const loadStatistics = async () => {
    try {
      const stats = await getSalesStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
      // Don't set error state for statistics, just log it
    }
  };
  
  // Load products
  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      setProductsError(null);
      
      // Fetch all products across pages so everything is searchable and scrollable
      const productsData = await fetchProductsForSaleAll({ pageSize: 100 });
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
      setProductsError("Failed to load products");
      
      // Use sample data if API fails
      const sampleProducts = [
      ];
      setProducts(sampleProducts);
      setFilteredProducts(sampleProducts);
    } finally {
      setIsLoadingProducts(false);
    }
  };
  
  // Load clients
  const loadClients = async () => {
    try {
      setIsLoadingClients(true);
      setClientsError(null);
      
      // Fetch clients from the API
      const clientsData = await fetchClients({ limit: 100 });
      setClients(clientsData);
      setFilteredClients(clientsData);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClientsError("Failed to load clients");
      
      // Use sample data if API fails
      const sampleClients = [
        { id: "1", name: "Acme Corp", email: "info@acmecorp.com" },
        { id: "2", name: "John Doe", email: "john@example.com" },
        { id: "3", name: "Tech Solutions Ltd", email: "contact@techsolutions.com" },
      ];
      setClients(sampleClients);
      setFilteredClients(sampleClients);
    } finally {
      setIsLoadingClients(false);
    }
  };
  
  // Helper function to check if product has unit management enabled
  const hasUnitManagement = (product) => {
    const hasUnits = !!(product?.units && product.units.length > 0);
    console.log("=== UNIT MANAGEMENT CHECK ===");
    console.log("Product:", product?.name);
    console.log("Has units property:", !!product?.units);
    console.log("Units length:", product?.units?.length || 0);
    console.log("Has unit management:", hasUnits);
    console.log("=============================");
    return hasUnits;
  };
  
  // Add product to the current sale
  const addProduct = async (product, qty = quantity) => {
    if (!product) return;
    
    // Always fetch full product details to know if units are configured
    let detailedProduct = product;
    console.log("=== ADD PRODUCT DEBUG ===");
    console.log("Product ID:", product.id);
    console.log("Product name:", product.name);
    
    try {
      console.log("Fetching product details from API...");
      const res = await fetch(`/api/inventory/${product.id}`);
      console.log("API response status:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("API response data:", data);
        
        // The API returns the product data directly, not wrapped in a 'product' property
        if (data && (data.product || data.id)) {
          const productData = data.product || data;
          console.log("=== POS PRODUCT DETAILS DEBUG ===");
          console.log("Product ID:", product.id);
          console.log("Raw API response:", JSON.stringify(productData, null, 2));
          
          // The API now returns units in the correct format
          const units = Array.isArray(productData.units) ? productData.units : [];
          console.log("Units found:", units.length);
          console.log("Units data:", units);
          console.log("================================");

          detailedProduct = {
            ...product,
            ...productData,
            units: units
          };
          
          console.log("Detailed product with units:", detailedProduct);
        } else {
          console.log("No product data in API response");
        }
      } else {
        console.log("API request failed with status:", res.status);
      }
    } catch (e) {
      console.error("Error fetching product details:", e);
      // If detail fetch fails, proceed with basic product
    }
    
    console.log("Final detailed product:", detailedProduct);
    console.log("=========================");

    const isUnitManaged = hasUnitManagement(detailedProduct);

    // Determine initial quantity
    let parsedQty;
    if (isUnitManaged) {
      parsedQty = 1; // default to 1 base unit for unit-managed products
    } else {
      parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setSaleError("Quantity must be a positive number");
      return;
      }
    }

    // Stock check only for regular products (unit-managed will validate per-unit in UI)
    if (!isUnitManaged && detailedProduct.stockLevel !== null && detailedProduct.stockLevel < parsedQty) {
      setSaleError(`Only ${detailedProduct.stockLevel} units of ${detailedProduct.name} available in stock`);
      return;
    }
    
    const existingProduct = selectedProducts.find(p => p.id === detailedProduct.id);
    
    if (existingProduct) {
      if (isUnitManaged) {
        setSelectedProducts(selectedProducts.map(p =>
          p.id === detailedProduct.id
            ? { ...p, ...detailedProduct, quantity: parsedQty, subtotal: p.price * parsedQty }
            : p
        ));
      } else {
        if (detailedProduct.stockLevel !== null && existingProduct.quantity + parsedQty > detailedProduct.stockLevel) {
          setSaleError(`Cannot add ${parsedQty} more units of ${detailedProduct.name}. Only ${detailedProduct.stockLevel - existingProduct.quantity} units available.`);
        return;
      }
      setSelectedProducts(selectedProducts.map(p => 
          p.id === detailedProduct.id
            ? { ...p, quantity: p.quantity + parsedQty, subtotal: p.price * (p.quantity + parsedQty) }
          : p
      ));
      }
    } else {
      // Determine initial price (base unit price for unit-managed)
      let initialPrice = detailedProduct.price;
      if (isUnitManaged) {
        const baseUnit = (detailedProduct.units || []).find(u => u.isBaseUnit);
        if (baseUnit && baseUnit.unitPrice != null) {
          initialPrice = parseFloat(baseUnit.unitPrice);
        }
      }

      setSelectedProducts([...selectedProducts, {
        ...detailedProduct,
        quantity: parsedQty,
        subtotal: initialPrice * parsedQty,
        price: initialPrice,
        taxRate: 0,
        taxAmount: 0,
        taxDescription: '',
        discount: 0,
        discountAmount: 0,
        isCustom: false
      }]);
    }
    
    // Clear product selection
    setSelectedProduct("");
    setQuantity(1);
    setProductSearchQuery("");
    setShowProductSearch(false);
  };
  
  // Add custom product to the current sale
  const addCustomProduct = () => {
    const { name, price, description } = customProduct;
    
    if (!name.trim() || !price || parseFloat(price) <= 0) {
      setSaleError("Please enter a valid product name and price");
      return;
    }

    const customProd = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      stockLevel: null, // Custom products don't have stock
      isCustom: true,
      quantity: quantity,
      subtotal: parseFloat(price) * quantity,
      taxRate: 0,
      taxAmount: 0,
      taxDescription: "",
      discount: 0,
      discountAmount: 0
    };

    setSelectedProducts([...selectedProducts, customProd]);
    
    // Reset form
    setCustomProduct({ name: "", price: "", description: "" });
    setQuantity(1);
    setShowCustomProduct(false);
  };
  
  // Update product tax rate and amount
  const updateProductTax = (productId, taxRate, taxDescription) => {
    setSelectedProducts(selectedProducts.map(product => {
      if (product.id === productId) {
        const newTaxAmount = product.subtotal * (parseFloat(taxRate) / 100);
        return {
          ...product,
          taxRate: parseFloat(taxRate) || 0,
          taxAmount: newTaxAmount,
          taxDescription: taxDescription || ""
        };
      }
      return product;
    }));
  };
  
  // Update product discount
  const updateProductDiscount = (productId, discount) => {
    console.log('🔍 Discount Debug:', {
      productId,
      discountInput: discount,
      discountParsed: parseFloat(discount) || 0
    });
    
    setSelectedProducts(selectedProducts.map(product => {
      if (product.id === productId) {
        // Treat entered discount as per-unit discount; total discount scales with quantity
        const perUnitDiscount = parseFloat(discount) || 0;
        const newDiscountAmount = perUnitDiscount * (product.quantity || 1);
        console.log('💰 Product Discount Update:', {
          productName: product.name,
          productSubtotal: product.subtotal,
          perUnitDiscount,
          discountAmount: newDiscountAmount,
          newTotal: product.subtotal + (product.taxAmount || 0) - newDiscountAmount
        });
        
        return {
          ...product,
          // Store per-unit discount entered by user
          discount: perUnitDiscount,
          discountAmount: newDiscountAmount
        };
      }
      return product;
    }));
  };
  
  // Handle void sale
  const handleVoidSale = async () => {
    if (!selectedSaleForAction || !voidReason.trim()) {
      setSaleError("Please provide a reason for voiding the sale");
      return;
    }

    setIsProcessingVoid(true);
    try {
      await voidSale(selectedSaleForAction.id, voidReason);
      setSaleSuccess(true);
      setShowVoidModal(false);
      setVoidReason("");
      setSelectedSaleForAction(null);
      loadRecentSales();
      loadStatistics();
    } catch (error) {
      console.error("Error voiding sale:", error);
      setSaleError("Failed to void sale. Please try again.");
    } finally {
      setIsProcessingVoid(false);
    }
  };

  // Handle refund sale
  const handleRefundSale = async () => {
    if (!selectedSaleForAction || !refundReason.trim()) {
      setSaleError("Please provide a reason for the refund");
      return;
    }

    setIsProcessingRefund(true);
    try {
      await refundSale(selectedSaleForAction.id, refundReason);
      setSaleSuccess(true);
      setShowRefundModal(false);
      setRefundReason("");
      setSelectedSaleForAction(null);
      loadRecentSales();
      loadStatistics();
    } catch (error) {
      console.error("Error processing refund:", error);
      setSaleError("Failed to process refund. Please try again.");
    } finally {
      setIsProcessingRefund(false);
    }
  };
  
  // Handle quick add of a product
  const handleQuickAdd = (product) => {
    if (!product || (product.stockLevel !== null && product.stockLevel <= 0)) {
      return; // Don't add out-of-stock products
    }
    
    addProduct(product, 1);
  };
  
  // Update product quantity in the current sale
  const updateProductQuantity = (productId, newQuantity) => {
    const parsedQty = parseInt(newQuantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setSaleError("Quantity must be a positive number");
      return;
    }
    
    const product = products.find(p => p.id === productId);
    
    // Check if the new quantity exceeds stock level
    if (product && product.stockLevel !== null && parsedQty > product.stockLevel) {
      setSaleError(`Cannot set quantity to ${parsedQty}. Only ${product.stockLevel} units of ${product.name} available.`);
      return;
    }
    
    setSelectedProducts(selectedProducts.map(p => 
      p.id === productId
        ? {
            ...p,
            quantity: parsedQty,
            subtotal: p.price * parsedQty,
            // Recalculate total discount based on per-unit discount and new quantity
            discountAmount: (parseFloat(p.discount) || 0) * parsedQty
          }
        : p
    ));
  };

  // Update product quantity for unit-managed products
  const updateUnitBasedQuantity = useCallback((productId, newQuantity) => {
    setSelectedProducts(prev => prev.map(product => {
      if (product.id === productId) {
        // When quantity changes, recalculate average price if subtotal exists
        const avgUnitPrice = newQuantity > 0 && product.subtotal ? product.subtotal / newQuantity : product.price;
        return {
          ...product,
          quantity: newQuantity,
          price: avgUnitPrice
        };
      }
      return product;
    }));
  }, []);

  // Update unit quantities for unit-managed products
  const updateUnitQuantities = useCallback((productId, unitQuantities) => {
    console.log("=== POS UNIT QUANTITIES UPDATE ===");
    console.log("Product ID:", productId);
    console.log("Unit Quantities:", unitQuantities);
    console.log("==================================");
    
    setSelectedProducts(prev => prev.map(product => 
      product.id === productId 
        ? {...product, unitQuantities: unitQuantities}
        : product
    ));
  }, []);

  // Update product price for unit-managed products
  const updateUnitBasedPrice = useCallback((productId, newPrice) => {
    setSelectedProducts(prev => prev.map(product => {
      if (product.id === productId) {
        // newPrice is the total price already calculated by UnitBasedQuantityInput
        // We should use it directly as subtotal, not multiply by quantity
        // Calculate average unit price for display purposes based on current quantity
        const currentQuantity = product.quantity || 1;
        const avgUnitPrice = currentQuantity > 0 ? newPrice / currentQuantity : newPrice;
        return {
          ...product,
          price: avgUnitPrice,
          subtotal: newPrice // Use total price directly as subtotal
        };
      }
      return product;
    }));
  }, []);
  
  // Remove product from current sale
  const removeProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };
  // // Calculate subtotal
  // const calculateSubtotal = () => {
  //   return selectedProducts.reduce((sum, product) => sum + product.subtotal, 0) - discount;
  // };
  const updateDiscount = (selectedDiscount) => {
    // Clamp discount: not less than 0, not more than subtotal
    const subtotal = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    let validDiscount = Math.max(0, Math.min(selectedDiscount, subtotal));
    // setDiscount(validDiscount); // This line is removed
  };

  const calculateSubtotal = () => {
    const subtotal = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    return subtotal;
  };
  
  // Calculate tax amount
  const calculateTaxAmount = () => {
    return selectedProducts.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
  };
  
  // Calculate total discount amount
  const calculateDiscountAmount = () => {
    return selectedProducts.reduce((sum, product) => sum + (product.discountAmount || 0), 0);
  };
  
  // Calculate total
  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount() - calculateDiscountAmount() - globalDiscount;
  };
  
  // Start editing tax rate
  const startEditingTax = () => {
    // setTempTaxRate(taxRate); // This line is removed
    // setIsEditingTax(true); // This line is removed
  };
  
  // Save tax rate
  const saveTaxRate = () => {
    // Validate the tax rate
    // const parsedTaxRate = parseFloat(tempTaxRate); // This line is removed
    // if (!isNaN(parsedTaxRate) && parsedTaxRate >= 0) { // This line is removed
    //   setTaxRate(parsedTaxRate); // This line is removed
    // } else { // This line is removed
    //   // Reset to current tax rate if invalid // This line is removed
    //   setTempTaxRate(taxRate); // This line is removed
    // } // This line is removed
    // setIsEditingTax(false); // This line is removed
  };
  
  // Cancel editing tax rate
  const cancelEditingTax = () => {
    // setTempTaxRate(taxRate); // This line is removed
    // setIsEditingTax(false); // This line is removed
  };
  
  // Handle tax rate input change
  const handleTaxRateChange = (e) => {
    // setTempTaxRate(e.target.value); // This line is removed
  };
  
  // Handle tax rate key down - save on Enter, cancel on Escape
  const handleTaxRateKeyDown = (e) => {
    // if (e.key === 'Enter') { // This line is removed
    //   saveTaxRate(); // This line is removed
  };
  
  // Clear the current sale
  const clearSale = () => {
    setSelectedProducts([]);
    setActiveTab("walkIn");
    setSelectedCustomer("");
    setSaleNotes("");
    setPaymentMethod("cash");
    setQuantity(1);
    setProductSearchQuery("");
    setGlobalDiscount(0); // Clear global discount
    // Clear historical transaction fields
    setHistoricalDate('');
    setOriginalReference('');
    setMigrationBatch('');
    
    // Reset batch upload state
    setShowBatchUpload(false);
    setSelectedFile(null);
    setBatchName('');
    setUploadResults(null);
    
    // Note: keep receipt data separate; avoid resetting non-existent totals
  };

  // Download CSV template
  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/historical-transactions/template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'historical_transactions_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      setSaleError('Failed to download template. Please try again.');
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadResults(null);
      // Auto-generate batch name if empty
      if (!batchName) {
        setBatchName(`BATCH-${new Date().toISOString().split('T')[0]}-${Date.now()}`);
      }
    }
  };

  // Handle batch upload
  const handleBatchUpload = async () => {
    if (!selectedFile) {
      setSaleError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setSaleError(null);
    setUploadResults(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('migrationBatch', batchName || `BATCH-${new Date().toISOString().split('T')[0]}-${Date.now()}`);

      const response = await fetch('/api/historical-transactions/batch-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          // Validation errors
          setSaleError(`Validation failed: ${result.details.slice(0, 5).join(', ')}${result.details.length > 5 ? '...' : ''}`);
        } else {
          setSaleError(result.error || 'Upload failed');
        }
        return;
      }

      setUploadResults(result);
      
      // Clear file selection on successful upload
      setSelectedFile(null);
      setBatchName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh sales data
      loadRecentSales();
      loadStatistics();

    } catch (error) {
      console.error('Error uploading batch:', error);
      setSaleError('Failed to upload batch. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Save sale as draft
  const saveDraft = async () => {
    if (selectedProducts.length === 0) {
      setSaleError("Please add at least one product to the sale");
      return;
    }
    
    setIsSubmitting(true);
    setSaleError(null);
    
    try {
      // Prepare sale data
      const saleData = {
        clientId: activeTab === "registered" && selectedCustomer ? selectedCustomer : null,
        items: selectedProducts.map(product => ({
          productId: product.isCustom ? null : product.id,
          description: product.name,
          quantity: product.quantity,
          unitPrice: product.price,
          taxRate: product.taxRate || 0,
          taxAmount: product.taxAmount || 0,
          taxDescription: product.taxDescription || "",
          discount: product.discount || 0,
          discountAmount: product.discountAmount || 0,
          isCustom: product.isCustom || false
        })),
        paymentMethod: paymentMethod,
        notes: saleNotes,
        status: 'draft',
        subtotal: calculateSubtotal(),
        totalTaxAmount: calculateTaxAmount(),
        totalDiscountAmount: calculateDiscountAmount(),
        globalDiscount: globalDiscount,
        total: calculateTotal()
      };
      
      // Create the sale
      const result = await createSale(saleData);
      
      // Show success message
      setSaleSuccess(true);
      
      // Reset form
      clearSale();
      
      // Refresh recent sales and statistics
      loadRecentSales();
      loadStatistics();
      
      // Notify user
      alert(`Draft saved successfully with ID: ${result.sale.saleNumber}`);
    } catch (error) {
      console.error("Error saving draft:", error);
      setSaleError("Failed to save draft. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Complete the sale
  const completeSale = async () => {
    if (selectedProducts.length === 0) {
      setSaleError("Please add at least one product to the sale");
      return;
    }

    // Validate historical transaction data
    if (activeTab === "historical") {
      if (!historicalDate) {
        setSaleError("Please select a transaction date for historical entries");
        return;
      }
      
      const selectedDate = new Date(historicalDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (selectedDate > today) {
        setSaleError("Historical transaction date cannot be in the future");
        return;
      }
    }
    
    setIsSubmitting(true);
    setSaleError(null);
    
    try {
      // Prepare sale data
      const saleData = {
        clientId: (activeTab === "registered" || activeTab === "historical") && selectedCustomer ? selectedCustomer : null,
        items: selectedProducts.map(product => {
          const itemData = {
          productId: product.isCustom ? null : product.id,
          description: product.name,
          quantity: product.quantity,
          unitPrice: product.price,
          taxRate: product.taxRate || 0,
          taxAmount: product.taxAmount || 0,
          taxDescription: product.taxDescription || "",
          discount: product.discount || 0,
          discountAmount: product.discountAmount || 0,
          isCustom: product.isCustom || false
          };
          
          // Add unit quantities for unit-managed products
          if (hasUnitManagement(product) && product.units) {
            const unitQuantities = {};
            product.units.forEach(unit => {
              // Get the quantity from the unit-based input
              // This would need to be stored in the product object when quantities change
              unitQuantities[unit.id] = product.unitQuantities?.[unit.id] || 0;
            });
            itemData.unitQuantities = unitQuantities;
            
            console.log("=== SALE CREATION DEBUG ===");
            console.log("Product:", product.name);
            console.log("Has unit management:", hasUnitManagement(product));
            console.log("Product units:", product.units);
            console.log("Product unitQuantities:", product.unitQuantities);
            console.log("Calculated unitQuantities for sale:", unitQuantities);
            console.log("Item data being sent:", itemData);
            console.log("=============================");
          }
          
          return itemData;
        }),
        paymentMethod: paymentMethod,
        notes: saleNotes,
        status: 'completed',
        subtotal: calculateSubtotal(),
        totalTaxAmount: calculateTaxAmount(),
        totalDiscountAmount: calculateDiscountAmount(),
        globalDiscount: globalDiscount,
        total: calculateTotal(),
        // Historical transaction fields
        isHistorical: activeTab === "historical",
        historicalDate: activeTab === "historical" ? historicalDate : null,
        originalReference: activeTab === "historical" ? originalReference : null,
        migrationBatch: activeTab === "historical" ? migrationBatch : null
      };
      
      // Create the sale
      const result = await createSale(saleData);
      
      // Show success message
      setSaleSuccess(true);
      
      // Set receipt number for the modal
      setReceiptNumber(result.sale.saleNumber);
      
      // Set current receipt for possible printing
      setCurrentReceipt(result.sale);
      
      // Show receipt modal
      setShowReceiptModal(true);
      
      // Reset form
      clearSale();
      
      // Refresh recent sales and statistics
      loadRecentSales();
      loadStatistics();
      
      // Refresh products to get updated stock levels
      loadProducts();
      
    } catch (error) {
      console.error("Error completing sale:", error);
      setSaleError("Failed to complete sale. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="w-4 h-4" />;
      case 'card':
        return <CreditCard className="w-4 h-4" />;
      case 'mobile_money':
        return <Smartphone className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };
  
  // Format payment method for display
  const formatPaymentMethod = (method) => {
    const methodMap = {
      'cash': 'Cash',
      'card': 'Card',
      'mobile_money': 'Mobile Money',
      'bank_transfer': 'Bank Transfer',
      'check': 'Check'
    };
    
    return methodMap[method] || method;
  };
  
  // Print the current receipt
  const handlePrintReceipt = async () => {
    if (!currentReceipt) return;
    
    try {
      await printReceipt(currentReceipt.id);
    } catch (error) {
      console.error("Error printing receipt:", error);
      alert("Failed to print receipt. Please try again.");
    }
  };
  
  // View sale details
  const viewSaleDetails = (saleId) => {
    router.push(`/pos/list/${saleId}`);
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return `MK ${typeof amount === 'number' 
      ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : amount}`;
  };

  // Find a client by ID
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "Unknown Client";
  };

  // Add handler for when a client is created
  const handleClientCreated = (newClient) => {
    setClients((prev) => [...prev, newClient]);
    setFilteredClients((prev) => [...prev, newClient]);
    setSelectedCustomer(newClient.id);
    setShowClientModal(false);
  };

  return (
    <PermissionGuard permission="sales.view">   
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">POS</h1>
        <div className="flex space-x-2">
          <button 
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center"
            onClick={() => router.push('/pos/list')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span>Sales History</span>
          </button>
          {/* {pagePermissions.canCreateSales &&( <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            onClick={clearSale}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            <span>New Sale</span>
          </button>)} */}
        </div>
      </div>

      {/* Success message */}
      {saleSuccess && (
        <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow animated fadeIn">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">Sale completed successfully!</p>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {saleError && (
        <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow animated fadeIn">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{saleError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - New Sale Form */}
        {pagePermissions.canCreateSales &&( <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">New Sale</h2>
            <div className="flex mb-4">
              <button 
                className={`px-4 py-2 ${activeTab === "walkIn" ? "bg-blue-100 text-blue-600" : "bg-gray-100"} rounded-l-md`}
                onClick={() => {
                  setActiveTab("walkIn");
                  setSelectedCustomer("");
                }}
              >
                Walk-in Customer
              </button>
              <button 
                className={`px-4 py-2 ${activeTab === "registered" ? "bg-blue-100 text-blue-600" : "bg-gray-100"} flex items-center`}
                onClick={() => setActiveTab("registered")}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Registered Customer
              </button>
              <button 
                className={`px-4 py-2 ${activeTab === "historical" ? "bg-blue-100 text-blue-600" : "bg-gray-100"} rounded-r-md flex items-center`}
                onClick={() => setActiveTab("historical")}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Historical Transaction
              </button>
            </div>

            {activeTab === "registered" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Select Customer</label>
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search and select customer..."
                      className="w-full p-2 border border-gray-200 rounded-md pr-10"
                      value={clientSearchQuery}
                      onChange={handleClientSearchChange}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={() => {
                        // Delay hiding to allow clicking on options
                        setTimeout(() => setShowClientDropdown(false), 200);
                      }}
                      disabled={isLoadingClients}
                    />
                    <div className="absolute right-3 top-3 pointer-events-none">
                      {isLoadingClients ? (
                        <Loader className="h-4 w-4 animate-spin text-gray-500" />
                      ) : (
                        <Search className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Dropdown with search results */}
                  {showClientDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredClients.length > 0 ? (
                        <>
                          {filteredClients.map((client) => (
                            <div
                              key={client.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => {
                                setSelectedCustomer(client.id);
                                setClientSearchQuery(client.name);
                                setShowClientDropdown(false);
                              }}
                            >
                              <div className="font-medium text-gray-900">{client.name}</div>
                              {client.email && (
                                <div className="text-sm text-gray-500">{client.email}</div>
                              )}
                            </div>
                          ))}
                          <div
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-t border-gray-200 bg-blue-50"
                            onClick={() => {
                              setShowClientModal(true);
                              setShowClientDropdown(false);
                            }}
                          >
                            <div className="font-medium text-blue-600">+ Add New Client</div>
                          </div>
                        </>
                      ) : clientSearchQuery.trim() !== "" ? (
                        <div className="px-3 py-2 text-gray-500 text-center">
                          No clients found
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-gray-500 text-center">
                          Start typing to search clients...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {clientsError && (
                  <p className="mt-1 text-sm text-red-600">{clientsError}</p>
                )}
              </div>
            )}

            {activeTab === "historical" && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                    <h3 className="text-sm font-medium text-yellow-800">Historical Transaction Entry</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                      onClick={() => setShowBatchUpload(!showBatchUpload)}
                    >
                      <Package className="w-3 h-3 mr-1" />
                      {showBatchUpload ? 'Single Entry' : 'Batch Upload'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-yellow-700 mb-4">
                  Record transactions that occurred before system implementation. All entries will be audited and marked as historical data.
                </p>
                
                {!showBatchUpload ? (
                  // Single transaction entry form
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">Transaction Date *</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-gray-200 rounded-md"
                          value={historicalDate}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setHistoricalDate(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">Original Reference</label>
                        <input
                          type="text"
                          placeholder="Original receipt/invoice number"
                          className="w-full p-2 border border-gray-200 rounded-md"
                          value={originalReference}
                          onChange={(e) => setOriginalReference(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1 text-gray-700">Migration Batch</label>
                      <input
                        type="text"
                        placeholder="e.g., BATCH-2024-001 (optional)"
                        className="w-full p-2 border border-gray-200 rounded-md"
                        value={migrationBatch}
                        onChange={(e) => setMigrationBatch(e.target.value)}
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1 text-gray-700">Customer (Optional)</label>
                      <ClientSearchCombobox
                        clients={clients}
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        onAddNew={() => setShowClientModal(true)}
                        placeholder="Search or select a customer..."
                        disabled={isLoadingClients}
                        isLoading={isLoadingClients}
                        allowEmpty={true}
                        emptyLabel="Walk-in Customer"
                      />
                    </div>
                  </>
                ) : (
                  // Batch upload form
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Batch Upload Instructions</h4>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• Download the CSV template below and fill in your historical transactions</li>
                        <li>• Each row represents one transaction with all required details</li>
                        <li>• Ensure dates are in YYYY-MM-DD format and not in the future</li>
                        <li>• Upload the completed file to process all transactions at once</li>
                      </ul>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                        onClick={downloadTemplate}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download CSV Template
                      </button>
                      
                      <div className="flex-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Select File to Upload
                        </button>
                      </div>
                    </div>
                    
                    {selectedFile && (
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-gray-500 mr-2" />
                            <span className="text-sm text-gray-700">{selectedFile.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => {
                              setSelectedFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="mt-3">
                          <label className="block text-sm font-medium mb-1 text-gray-700">Migration Batch Name</label>
                          <input
                            type="text"
                            placeholder={`BATCH-${new Date().toISOString().split('T')[0]}`}
                            className="w-full p-2 border border-gray-200 rounded-md text-sm"
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                          />
                        </div>
                        
                        <button
                          type="button"
                          className="mt-3 w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center disabled:opacity-50"
                          onClick={handleBatchUpload}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Batch Transactions
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {uploadResults && (
                      <div className={`border rounded-md p-4 ${uploadResults.results.failed > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                        <h4 className={`text-sm font-medium mb-2 ${uploadResults.results.failed > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                          Upload Results
                        </h4>
                        <div className="text-sm space-y-1">
                          <p className="text-green-700">✓ {uploadResults.results.successful} transactions processed successfully</p>
                          {uploadResults.results.failed > 0 && (
                            <p className="text-red-700">✗ {uploadResults.results.failed} transactions failed</p>
                          )}
                          <p className="text-gray-600">Migration Batch: {uploadResults.results.migrationBatch}</p>
                        </div>
                        
                        {uploadResults.results.failedTransactions?.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm font-medium text-red-700 cursor-pointer">View Failed Transactions</summary>
                            <div className="mt-2 text-xs space-y-1">
                              {uploadResults.results.failedTransactions.map((failed, index) => (
                                <div key={index} className="text-red-600">
                                  Row {failed.rowNumber}: {failed.error}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4 relative">
              <label className="block text-sm font-medium mb-1">Add Products</label>
              <div className="flex gap-2">
                <div className="relative flex-grow" ref={productSearchRef}>
                  <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    className="w-full p-2 border border-gray-200 rounded-md"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    onFocus={() => setShowProductSearch(true)}
                    onKeyDown={(e) => {
                      // Add first matching product on Enter
                      if (e.key === 'Enter' && filteredProducts.length > 0) {
                        const product = filteredProducts[0];
                        if (product.stockLevel > 0) {
                          handleQuickAdd(product);
                        }
                      }
                    }}
                  />
                  <div className="absolute right-3 top-3 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  
                  {/* Product search results dropdown */}
                  {showProductSearch && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {isLoadingProducts ? (
                        <div className="p-4 text-center">
                          <Loader className="w-5 h-5 text-blue-500 animate-spin mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">Loading products...</p>
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="p-4 text-center">
                          <p className="text-gray-500">No products found</p>
                        </div>
                      ) : (
                        filteredProducts.map(product => (
                          <div 
                            key={product.id}
                            className={`p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex justify-between items-center ${product.stockLevel <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => product.stockLevel > 0 && handleQuickAdd(product)}
                          >
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <div className="flex text-xs text-gray-500 gap-2">
                                {product.sku && <span>SKU: {product.sku}</span>}
                                <span>In stock: {product.stockLevel !== null ? product.stockLevel : 'N/A'}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(product.price)}</p>
                              {product.stockLevel <= 0 ? (
                                <span className="text-xs text-red-500">Out of stock</span>
                              ) : (
                                <button 
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAdd(product);
                                  }}
                                >
                                  + Add to sale
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                <div className="w-20">
                  <input 
                    type="number" 
                    className="w-full p-2 border border-gray-200 rounded-md" 
                    min="1" 
                    value={quantity} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setQuantity(val > 0 ? val : 1);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Custom Product Button */}
            <div className="mb-4">
              <button
                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center"
                onClick={() => setShowCustomProduct(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Product
              </button>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    {selectedProducts.some(p => !hasUnitManagement(p)) && (
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    )}
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (per item)</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedProducts.length > 0 ? (
                    selectedProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(product.price)}</td>
                        {!hasUnitManagement(product) && (
                          <td className="px-4 py-3 text-sm text-right">
                            <input
                              type="number"
                              className="w-16 p-1 text-right border border-gray-200 rounded-md"
                              min="1"
                              value={product.quantity}
                              onChange={(e) => updateProductQuantity(product.id, e.target.value)}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <input
                                type="number"
                                className="w-12 p-1 text-right border border-gray-200 rounded-md text-xs"
                                min="0"
                                step="0.1"
                                value={product.taxRate || ''}
                                onChange={(e) => updateProductTax(product.id, e.target.value, product.taxDescription)}
                              />
                              <span className="text-xs ml-1">%</span>
                            </div>
                            <input
                              type="text"
                              placeholder="Tax type"
                              className="w-20 p-1 border border-gray-200 rounded-md text-xs"
                              value={product.taxDescription || ""}
                              onChange={(e) => updateProductTax(product.id, product.taxRate, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <span className="text-xs mr-1 text-gray-600">MK</span>
                            <input
                              type="number"
                              className="w-16 p-1 text-right border border-gray-200 rounded-md text-xs"
                              min="0"
                              step="0.01"
                              placeholder="0.00 per item"
                              value={product.discount || ''}
                              onChange={(e) => updateProductDiscount(product.id, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(product.subtotal + (product.taxAmount || 0) - (product.discountAmount || 0))}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeProduct(product.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-3 text-sm text-gray-500 text-center">
                        No products added yet. Search and select products to add to the sale.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Unit-Based Quantity Input Section */}
            {selectedProducts.some(p => hasUnitManagement(p)) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-blue-900 mb-3">Unit-Based Products</h3>
                <div className="space-y-4">
                  {selectedProducts
                    .filter(p => hasUnitManagement(p))
                    .map((product) => (
                      <div key={product.id} className="bg-white border border-blue-200 rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{product.name}</span>
                          <span className="text-sm text-gray-500">{formatCurrency(product.price)}</span>
                        </div>
                        <UnitBasedQuantityInput
                          product={product}
                          quantity={product.quantity}
                          onQuantityChange={(newQuantity) => updateUnitBasedQuantity(product.id, newQuantity)}
                          onPriceChange={(newPrice) => updateUnitBasedPrice(product.id, newPrice)}
                          onUnitQuantitiesChange={(unitQuantities) => updateUnitQuantities(product.id, unitQuantities)}
                          className="w-full"
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium">Subtotal:</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Total Tax:</span>
                <span>{formatCurrency(calculateTaxAmount())}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Total Discount:</span>
                <span className="text-red-600">-{formatCurrency(calculateDiscountAmount())}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Global Discount:</span>
                <div className="flex items-center">
                  <span className="text-xs mr-1 text-gray-600">MK</span>
                  <input
                    type="number"
                    className="w-20 p-1 text-right border border-gray-200 rounded-md text-xs"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={globalDiscount || ''}
                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              {globalDiscount > 0 && (
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-gray-600">Applied Global Discount:</span>
                  <span className="text-red-600">-{formatCurrency(globalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map(method => (
                  <button
                    key={method.key}
                    onClick={() => setPaymentMethod(method.key)}
                    className={`p-2 border rounded-md flex justify-center items-center ${
                      paymentMethod === method.key
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-gray-200'
                    }`}
                  >
                    <span className="mr-2">{method.icon}</span>
                    {method.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
              <textarea
                className="w-full p-2 border border-gray-200 rounded-md"
                rows="2"
                placeholder="Add notes about this sale..."
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
              ></textarea>
            </div>

            <div className="flex space-x-2">
              <button 
                className="px-4 py-2 border border-gray-300 bg-white rounded-md flex-1 flex items-center justify-center"
                onClick={clearSale}
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </button>
              <button 
                className={`px-4 py-2 bg-gray-200 text-gray-700 rounded-md flex-1 flex items-center justify-center ${
                  isSubmitting || selectedProducts.length === 0 ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                onClick={saveDraft}
                disabled={isSubmitting || selectedProducts.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </button>
              <button 
                className={`px-4 py-2 bg-green-600 text-white rounded-md flex-1 flex items-center justify-center ${
                  isSubmitting || selectedProducts.length === 0 ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                onClick={completeSale}
                disabled={isSubmitting || selectedProducts.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Complete Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>)}

        {/* Right Column - Recent Sales */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Recent Sales</h2>
          <div className="mb-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search sales..." 
                className="w-full p-2 pl-10 border border-gray-200 rounded-md"
                // Note: This would ideally be connected to an actual search function
              />
              <div className="absolute left-3 top-3">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
          
          {isLoadingSales ? (
            <div className="flex justify-center items-center py-16">
              <Loader className="animate-spin h-8 w-8 text-blue-500" />
            </div>
          ) : salesError ? (
            <div className="text-center py-16">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-500">{salesError}</p>
              <button 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={loadRecentSales}
              >
                <RefreshCw className="w-4 h-4 mr-2 inline-block" />
                Try Again
              </button>
            </div>
          ) : recentSales.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No sales recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Customer</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentSales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      className="hover:bg-gray-50" 
                    >
                      <td className="px-4 py-2 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {sale.saleNumber}
                          {sale.isHistorical && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              <Calendar className="w-3 h-3 mr-1" />
                              Historical
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">{sale.date}</td>
                      <td className="px-4 py-2 text-sm">{sale.client}</td>
                      <td className="px-4 py-2 text-sm text-right">{sale.total}</td>
                      <td className="px-4 py-2 text-sm text-center">
                        <div className="flex justify-center space-x-1">
                          <button
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => viewSaleDetails(sale.id)}
                            title="View Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          {pagePermissions.canVoidSales && sale.status === 'completed' && (
                            <button
                              className="text-orange-600 hover:text-orange-800"
                              onClick={() => {
                                setSelectedSaleForAction(sale);
                                setShowVoidModal(true);
                              }}
                              title="Void Sale"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {pagePermissions.canRefundSales && sale.status === 'completed' && (
                            <button
                              className="text-purple-600 hover:text-purple-800"
                              onClick={() => {
                                setSelectedSaleForAction(sale);
                                setShowRefundModal(true);
                              }}
                              title="Refund Sale"
                            >
                              <RotateCcw className="w-4 h-4" />
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
          
          <div className="mt-4 flex justify-center">
            <a href="/pos/list" className="text-blue-600 text-sm hover:underline flex items-center">
              View All Sales
              <ArrowRight className="w-4 h-4 ml-1" />
            </a>
          </div>
        </div>
      </div>
      
      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fadeInUp"
            ref={receiptModalRef}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Sale Completed</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowReceiptModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6 text-center">
              <div className="bg-green-100 text-green-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold mb-2">Success!</h4>
              <p className="text-gray-600">
                Sale {receiptNumber} has been completed successfully.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-md p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">Sale Details:</p>
              <p className="text-lg font-bold mb-1">Total: {currentReceipt ? currentReceipt.total : formatCurrency(calculateTotal())}</p>
              <p className="text-sm text-gray-600">
                Payment Method: {getPaymentMethodName(paymentMethod)}
              </p>
              {calculateTaxAmount() > 0 && (
                <p className="text-sm text-gray-600">
                  Total Tax: {formatCurrency(calculateTaxAmount())}
                </p>
              )}
              {calculateDiscountAmount() > 0 && (
                <p className="text-sm text-gray-600">
                  Total Discount: {formatCurrency(calculateDiscountAmount())}
                </p>
              )}
              {globalDiscount > 0 && (
                <p className="text-sm text-gray-600">
                  Global Discount: {formatCurrency(globalDiscount)}
                </p>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 flex items-center justify-center hover:bg-gray-50"
                onClick={() => setShowReceiptModal(false)}
              >
                Close
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center hover:bg-blue-700"
                onClick={handlePrintReceipt}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* CSS for animations */}
      <style jsx global>{`
        .animated {
          animation-duration: 0.3s;
          animation-fill-mode: both;
        }
        
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
        
        .fadeIn {
          animation-name: fadeIn;
        }
        
        .fadeInUp {
          animation-name: fadeInUp;
        }
      `}</style>

      {/* Custom Product Modal */}
      {showCustomProduct && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Custom Product</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowCustomProduct(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product Name *</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-md"
                  placeholder="Enter product name"
                  value={customProduct.name}
                  onChange={(e) => setCustomProduct({...customProduct, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Price *</label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-200 rounded-md"
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                  value={customProduct.price}
                  onChange={(e) => setCustomProduct({...customProduct, price: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full p-2 border border-gray-200 rounded-md"
                  rows="2"
                  placeholder="Enter description (optional)"
                  value={customProduct.description}
                  onChange={(e) => setCustomProduct({...customProduct, description: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-200 rounded-md"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setShowCustomProduct(false)}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={addCustomProduct}
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Sale Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Void Sale</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowVoidModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Are you sure you want to void sale {selectedSaleForAction?.saleNumber}?
              </p>
              <p className="text-sm text-red-600">
                This action will cancel the transaction and restore inventory levels.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason for voiding *</label>
              <textarea
                className="w-full p-2 border border-gray-200 rounded-md"
                rows="3"
                placeholder="Enter reason for voiding this sale..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>
            
            <div className="flex space-x-3">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setShowVoidModal(false)}
                disabled={isProcessingVoid}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center"
                onClick={handleVoidSale}
                disabled={isProcessingVoid || !voidReason.trim()}
              >
                {isProcessingVoid ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Voiding...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    Void Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Sale Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Refund Sale</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowRefundModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Are you sure you want to refund sale {selectedSaleForAction?.saleNumber}?
              </p>
              <p className="text-sm text-purple-600">
                This action will reverse the sale, restore inventory, and adjust financial records.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason for refund *</label>
              <textarea
                className="w-full p-2 border border-gray-200 rounded-md"
                rows="3"
                placeholder="Enter reason for refunding this sale..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            
            <div className="flex space-x-3">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setShowRefundModal(false)}
                disabled={isProcessingRefund}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center"
                onClick={handleRefundSale}
                disabled={isProcessingRefund || !refundReason.trim()}
              >
                {isProcessingRefund ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Process Refund
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Render the ClientModal at the end of the component */}
      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onClientCreated={handleClientCreated}
      />
    </div>
    </PermissionGuard>
  );
};

export default POSPage;
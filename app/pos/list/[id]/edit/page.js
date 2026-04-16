"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter , useParams } from "next/navigation";
import { 
  ArrowLeft,
  PlusCircle, 
  Search, 
  Filter, 
  ChevronDown, 
  Printer, 
  Download, 
  UserPlus, 
  ShoppingCart,
  Edit,
  Check,
  X,
  Loader,
  AlertCircle,
  Trash2,
  CreditCard,
  DollarSign,
  Smartphone,
  ArrowRight,
  Save,
  RefreshCw,
  Calendar,
  Info,
  CheckCircle
} from "lucide-react";
import { 
  fetchSaleById,
  fetchSales, 
  updateSale, 
  createSale, 
  getSalesStatistics,
  fetchProductsForSale,
  fetchClients,
  printReceipt
} from "@/app/services/salesService";
import ClientModal from "@/components/ClientModal";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import { getPaymentMethodName, paymentMethods } from "@/lib/paymentMethods";

const SalesPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [sale, setSale] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Tab and customer selection
  const [activeTab, setActiveTab] = useState("walkIn");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  
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
  
  // Current sale state
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [discount, setDiscount] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [taxRate, setTaxRate] = useState(16.5);
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [tempTaxRate, setTempTaxRate] = useState(16.5);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAccountsForEdit, setPaymentAccountsForEdit] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [saleError, setSaleError] = useState(null);
  const [saleNotes, setSaleNotes] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  
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
    setTaxRate(16.5);
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
  
  // Close modals when escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showProductSearch) setShowProductSearch(false);
        if (showReceiptModal) setShowReceiptModal(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProductSearch, showReceiptModal]);
  
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
// Load sale details
const loadSale = async (productList) => {
    try {
    setIsLoading(true);
    setError(null);

    let payAccounts = [];
    const balRes = await fetch("/api/payment-accounts/balances", { cache: "no-store" });
    const balJson = await balRes.json().catch(() => ({}));
    if (balRes.ok && balJson.success && Array.isArray(balJson.accounts)) {
      payAccounts = balJson.accounts;
    } else {
      const listRes = await fetch("/api/payment-accounts?activeOnly=true", { cache: "no-store" });
      const listJson = await listRes.json().catch(() => ({}));
      if (listRes.ok && listJson.success && listJson.paymentAccounts) {
        payAccounts = listJson.paymentAccounts.filter((a) => a.isActive !== false);
      }
    }
    setPaymentAccountsForEdit(payAccounts);
    
    const saleData = await fetchSaleById(id);
    setSale(saleData);
    // saleData.items.forEach((item) => {
    //   const product = productList.find(p => p.id === item.product.id);
    //   if (product) {
    //     addProduct(product, item.quantity);
    //   }
    // });
    const productsToAdd = saleData.items.map((item) => {
      const product = productList.find(p => p.id === item.product.id);
      if (!product) return null;

      const quantity = parseInt(item.quantity, 10);

      return {
        ...product,
        quantity,
        subtotal: product.price * quantity,
      };
    }).filter(Boolean);

    setSelectedProducts(productsToAdd);

    const rawPm = saleData.paymentMethod || "";
    let resolvedPm = rawPm;
    if (payAccounts.length) {
      if (payAccounts.some((a) => a.id === rawPm)) {
        resolvedPm = rawPm;
      } else {
        const legacy = paymentMethods.find((m) => m.key === rawPm);
        const cashAcc = payAccounts.find((a) => String(a.accountType).toLowerCase() === "cash");
        if (legacy?.key === "cash") {
          resolvedPm = cashAcc?.id || payAccounts[0].id;
        } else if (legacy) {
          const byName = payAccounts.find((a) =>
            a.name.toLowerCase().includes(String(legacy.name).toLowerCase().split(" ")[0])
          );
          resolvedPm = byName?.id || cashAcc?.id || payAccounts[0].id;
        } else {
          resolvedPm = cashAcc?.id || payAccounts[0].id;
        }
      }
    } else {
      resolvedPm = rawPm || "cash";
    }
    setPaymentMethod(resolvedPm);
    setDiscount(saleData.discount || 0);
    setTaxRate(saleData.taxRate || 16.5);
    setSelectedCustomer(saleData.clientId || "");
    setActiveTab(saleData.clientId ? "registered" : "walkIn");
    setSaleNotes(saleData.notes || "");

    } catch (error) {
    console.error(`Error loading sale ${id}:`, error);
    setError("Failed to load sale details. Please try again.");
    } finally {
    setIsLoading(false);
    }
};
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
      
      // Fetch products from the API - load a reasonable number for initial display
      const productsData = await fetchProductsForSale({ limit: 200 });
      setProducts(productsData);
      setFilteredProducts(productsData);
      await loadSale(productsData);
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
  
  // Add product to the current sale
  const addProduct = (product, qty = quantity) => {
    if (!product) return;
    
    const parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setSaleError("Quantity must be a positive number");
      return;
    }
    
    // Check if product has sufficient stock
    if (product.stockLevel !== null && product.stockLevel < parsedQty) {
      setSaleError(`Only ${product.stockLevel} units of ${product.name} available in stock`);
      return;
    }
    
    const existingProduct = selectedProducts.find(p => p.id === product.id);
    
    if (existingProduct) {
      // Check if the combined quantity exceeds stock level
      if (product.stockLevel !== null && existingProduct.quantity + parsedQty > product.stockLevel) {
        setSaleError(`Cannot add ${parsedQty} more units of ${product.name}. Only ${product.stockLevel - existingProduct.quantity} units available.`);
        return;
      }
      
      setSelectedProducts(selectedProducts.map(p => 
        p.id === product.id 
          ? {...p, quantity: p.quantity + parsedQty, subtotal: p.price * (p.quantity + parsedQty)} 
          : p
      ));
    } else {
      setSelectedProducts([...selectedProducts, {
        ...product,
        quantity: parsedQty,
        subtotal: product.price * parsedQty
      }]);
    }
    
    // Clear product selection
    setSelectedProduct("");
    setQuantity(1);
    setProductSearchQuery("");
    setShowProductSearch(false);
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
        ? {...p, quantity: parsedQty, subtotal: p.price * parsedQty}
        : p
    ));
  };
  
  // Remove product from current sale
  const removeProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };
  
  // Calculate subtotal
  // const calculateSubtotal = () => {
  //   return selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
  // };
  const updateDiscount = (selectedDiscount) => {
    // Clamp discount: not less than 0, not more than subtotal
    const subtotal = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    let validDiscount = Math.max(0, Math.min(selectedDiscount, subtotal));
    setDiscount(validDiscount);
  };

  const calculateSubtotal = () => {
    const subtotal = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    return subtotal - discount;
  };
  
  // Calculate tax amount
  const calculateTaxAmount = () => {
    return calculateSubtotal() * (taxRate / 100);
  };
  
  // Calculate total
  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount();
  };
  
  // Start editing tax rate
  const startEditingTax = () => {
    setTempTaxRate(taxRate);
    setIsEditingTax(true);
  };
  
  // Save tax rate
  const saveTaxRate = () => {
    // Validate the tax rate
    const parsedTaxRate = parseFloat(tempTaxRate);
    if (!isNaN(parsedTaxRate) && parsedTaxRate >= 0) {
      setTaxRate(parsedTaxRate);
    } else {
      // Reset to current tax rate if invalid
      setTempTaxRate(taxRate);
    }
    setIsEditingTax(false);
  };
  
  // Cancel editing tax rate
  const cancelEditingTax = () => {
    setTempTaxRate(taxRate);
    setIsEditingTax(false);
  };
  
  // Handle tax rate input change
  const handleTaxRateChange = (e) => {
    setTempTaxRate(e.target.value);
  };
  
  // Handle tax rate key down - save on Enter, cancel on Escape
  const handleTaxRateKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveTaxRate();
    } else if (e.key === 'Escape') {
      cancelEditingTax();
    }
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
          productId: product.id,
          description: product.name,
          quantity: product.quantity,
          unitPrice: product.price
        })),
        discount: discount,
        taxRate: taxRate,
        paymentMethod: paymentMethod,
        notes: saleNotes,
        status: 'draft'
      };
      
      // Create the sale
      const result = await updateSale(id,saleData);
      
      // Show success message
      setSaleSuccess(true);
      
      // Reset form
    //   clearSale();
      
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
    
    setIsSubmitting(true);
    setSaleError(null);
    
    try {
      // Prepare sale data
      const saleData = {
        clientId: activeTab === "registered" && selectedCustomer ? selectedCustomer : null,
        items: selectedProducts.map(product => ({
          productId: product.id,
          description: product.name,
          quantity: product.quantity,
          unitPrice: product.price
        })),
        discount: discount,
        taxRate: taxRate,
        paymentMethod: paymentMethod,
        notes: saleNotes,
        status: 'completed'
      };
      
      // Create the sale
      const result = await updateSale(id,saleData);
      viewSaleDetails(id)
      // Show success message
    //   setSaleSuccess(true);
      
      // Set receipt number for the modal
    //   setReceiptNumber(result.sale.saleNumber);
      
      // Set current receipt for possible printing
    //   setCurrentReceipt(result.sale);
      
      // Show receipt modal
    //   setShowReceiptModal(true);
      
      // Reset form
    //   clearSale();
      
      // Refresh recent sales and statistics
    //   loadRecentSales();
    //   loadStatistics();
      
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
  
  // Format currency (handles numbers and legacy "MK …" strings)
  const formatCurrency = (amount) => {
    let n = 0;
    if (amount == null || amount === "") n = 0;
    else if (typeof amount === "number" && Number.isFinite(amount)) n = amount;
    else if (
      typeof amount === "object" &&
      amount !== null &&
      typeof amount.toNumber === "function"
    ) {
      const t = amount.toNumber();
      n = Number.isFinite(t) ? t : 0;
    } else if (typeof amount === "string") {
      const stripped = amount.replace(/^MK\s*/i, "").replace(/,/g, "").trim();
      const p = parseFloat(stripped);
      n = Number.isFinite(p) ? p : 0;
    } else {
      const p = parseFloat(amount);
      n = Number.isFinite(p) ? p : 0;
    }
    return `MK ${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading sale details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="text-red-500 mb-4">{error}</p>
          <div className="flex justify-center space-x-4">
            <button 
              className="px-4 py-2 bg-gray-200 rounded-md"
              onClick={() => router.push('/sales')}
            >
              <ArrowLeft className="w-4 h-4 mr-2 inline-block" />
              Back to Sales
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!sale) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sale Not Found</h2>
          <p className="text-gray-500 mb-4">The requested sale could not be found</p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
            onClick={() => router.push('/sales')}
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline-block" />
            Back to Sales
          </button>
        </div>
      </div>
    );
  }
  if (sale.status==="completed") {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sale Completed</h2>
          <p className="text-gray-500 mb-4">The requested sale can not be updated!</p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
            onClick={() => router.push('/sales')}
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline-block" />
            Back to Sales
          </button>
        </div>
      </div>
    );
  }
  return (
    <PermissionGuard permission="sales.view">   
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sales</h1>
        <div className="flex space-x-2">
          <button 
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center"
            onClick={() => router.push('/pos/list')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span>Sales History</span>
          </button>
          {pagePermissions.canCreateSales &&( <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            onClick={() => router.push('/sales')}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            <span>New Sale</span>
          </button>)}
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
            <h2 className="text-lg font-semibold mb-2">Edit Sale</h2>
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
                className={`px-4 py-2 ${activeTab === "registered" ? "bg-blue-100 text-blue-600" : "bg-gray-100"} rounded-r-md flex items-center`}
                onClick={() => setActiveTab("registered")}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Registered Customer
              </button>
            </div>

            {activeTab === "registered" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Select Customer</label>
                <div className="relative">
                  <select 
                    className="w-full p-2 border border-gray-200 rounded-md appearance-none pr-10"
                    value={selectedCustomer}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setShowClientModal(true);
                      } else {
                        setSelectedCustomer(e.target.value);
                      }
                    }}
                    disabled={isLoadingClients}
                  >
                    <option value="">Select customer...</option>
                    {filteredClients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                    <option value="__add_new__">+ Add New Client</option>
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none">
                    {isLoadingClients ? (
                      <Loader className="h-4 w-4 animate-spin text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>
                {clientsError && (
                  <p className="mt-1 text-sm text-red-600">{clientsError}</p>
                )}
                
                {/* Client search box */}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Search clients..."
                    className="w-full p-2 border border-gray-200 rounded-md"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                  />
                </div>
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

            <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedProducts.length > 0 ? (
                    selectedProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(product.price)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <input
                            type="number"
                            className="w-16 p-1 text-right border border-gray-200 rounded-md"
                            min="1"
                            value={product.quantity}
                            onChange={(e) => updateProductQuantity(product.id, e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(product.subtotal)}</td>
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
                      <td colSpan="5" className="px-4 py-3 text-sm text-gray-500 text-center">
                        No products added yet. Search and select products to add to the sale.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium">Discount:</span>
                <span><input
                  type="number"
                  className="w-16 p-1 text-right border border-gray-200 rounded-md"
                  step="any"
                  min="1"
                  value={discount}
                  onChange={(e) => updateDiscount(e.target.value)}
                /></span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Subtotal:</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="font-medium flex items-center">
                  {isEditingTax ? (
                    <div className="flex items-center">
                      <span className="mr-2">Tax</span>
                      <input
                        type="number"
                        className="w-16 p-1 border border-gray-300 rounded-md"
                        value={tempTaxRate}
                        onChange={handleTaxRateChange}
                        onKeyDown={handleTaxRateKeyDown}
                        min="0"
                        step="0.1"
                        autoFocus
                      />
                      <span className="ml-1 mr-2">%</span>
                      <button 
                        className="p-1 text-green-600 hover:text-green-800"
                        onClick={saveTaxRate}
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-1 text-red-600 hover:text-red-800 ml-1"
                        onClick={cancelEditingTax}
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span>Tax ({taxRate}%)</span>
                      <button 
                        className="ml-2 text-gray-500 hover:text-gray-700"
                        onClick={startEditingTax}
                        title="Edit Tax Rate"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </span>
                <span>{formatCurrency(calculateTaxAmount())}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Payment account</label>
              <p className="text-xs text-gray-500 mb-2">From Payment Accounts (/payments/management).</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(paymentAccountsForEdit.length
                  ? paymentAccountsForEdit
                  : paymentMethods.map((m) => ({ id: m.key, name: m.name, icon: m.icon }))
                ).map((method) => (
                  <button
                    type="button"
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-2 border rounded-md flex justify-center items-center text-sm ${
                      paymentMethod === method.id
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-gray-200'
                    }`}
                  >
                    {method.icon ? <span className="mr-2">{method.icon}</span> : null}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentSales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      className="hover:bg-gray-50 cursor-pointer" 
                      onClick={() => viewSaleDetails(sale.id)}
                    >
                      <td className="px-4 py-2 text-sm font-medium">{sale.saleNumber}</td>
                      <td className="px-4 py-2 text-sm">{sale.date}</td>
                      <td className="px-4 py-2 text-sm">{sale.client}</td>
                      <td className="px-4 py-2 text-sm text-right">{sale.total}</td>
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
              <p className="text-lg font-bold mb-1">Total: {formatCurrency(calculateTotal())}</p>
              <p className="text-sm text-gray-600">
                Payment account:{" "}
                {paymentAccountsForEdit.find((a) => a.id === paymentMethod)?.name ||
                  getPaymentMethodName(paymentMethod)}
              </p>
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

export default SalesPage;
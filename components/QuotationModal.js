"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, ChevronDown, Info, Search, Loader } from "lucide-react";
import { calculateTax, calculateSubtotal, calculateTotal } from "@/lib/invoiceCalculations"; // Reuse the same calculations
import ClientModal from "./ClientModal";
import ClientSearchCombobox from "./ClientSearchCombobox";
import { fetchProductsForSaleAll } from "@/app/services/salesService";
import UnitBasedQuantityInput from "./UnitBasedQuantityInput";

// Enhanced calculation functions with per-item discount support for quotations
const calculateQuotationItemTotals = (item) => {
  const quantity = parseFloat(item.quantity) || 0;
  const unitPrice = parseFloat(item.unitPrice) || 0;
  const perItemDiscount = parseFloat(item.discountAmount) || 0; // Discount per individual item
  
  const lineTotal = quantity * unitPrice;
  const totalDiscountAmount = quantity * perItemDiscount; // Total discount = per-item discount × quantity
  const netAmount = lineTotal - totalDiscountAmount;
  const taxAmount = netAmount * ((item.taxRate || 0) / 100);
  const finalAmount = netAmount + taxAmount;
  
  return {
    lineTotal: Number(lineTotal.toFixed(2)),
    discountAmount: Number(totalDiscountAmount.toFixed(2)), // Total discount for the line
    perItemDiscount: Number(perItemDiscount.toFixed(2)), // Per-item discount amount
    netAmount: Number(netAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    amount: Number(finalAmount.toFixed(2))
  };
};

const QuotationModal = ({
  isOpen,
  onClose,
  mode,
  quotation,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    clientId: "",
    title: "",
    orderNumber: "",
    orderNumberAutogenerate: false,
    items: [{ description: "", quantity: "", unitPrice: "", taxRate: "0", discountAmount: "" }],
    issueDate: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "Approved",
    notes: "",
    discount: "",
    footerPhoneOverride: "",
    footerBankDetailsOverride: ""
  });
  
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [itemSearchQueries, setItemSearchQueries] = useState({}); // Separate search query for each item
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(null); // Track which item is actively searching
  const [loading, setLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [errors, setErrors] = useState({});
  const [showClientModal, setShowClientModal] = useState(false);
  
  // Unit management state
  const [unitQuantities, setUnitQuantities] = useState({});
  
  // Refs for product search dropdown
  const productSearchRef = useRef(null);

  // Helper function to check if a product has unit management
  const hasUnitManagement = (product) => {
    return product && product.units && product.units.length > 0;
  };

  // Handle unit quantity changes
  const handleUnitQuantityChange = (itemIndex, newQuantity) => {
    const updatedItems = [...formData.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      quantity: newQuantity
    };
    setFormData({ ...formData, items: updatedItems });
  };

  // Handle unit price changes
  const handleUnitPriceChange = (itemIndex, newPrice) => {
    const updatedItems = [...formData.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      unitPrice: newPrice
    };
    setFormData({ ...formData, items: updatedItems });
  };

  // Handle unit quantities changes
  const handleUnitQuantitiesChange = (itemIndex, newUnitQuantities) => {
    setUnitQuantities(prev => ({
      ...prev,
      [itemIndex]: newUnitQuantities
    }));
    
    // Update the item's quantity and unit price based on unit quantities
    const item = formData.items[itemIndex];
    if (hasUnitManagement(item.product) && item.product.units) {
      let totalBaseQuantity = 0;
      let totalPrice = 0;
      
      Object.entries(newUnitQuantities).forEach(([unitId, qty]) => {
        const unit = item.product.units.find(u => u.id === unitId);
        if (unit && qty > 0) {
          const conversionRate = parseFloat(unit.conversionToBase);
          const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
          totalBaseQuantity += convertedToBase;
          totalPrice += qty * parseFloat(unit.unitPrice || 0);
        }
      });
      
      // Calculate average unit price (total price / total quantity)
      const averageUnitPrice = totalBaseQuantity > 0 ? totalPrice / totalBaseQuantity : 0;
      
      // Update the item with calculated values
      const updatedItems = [...formData.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        quantity: totalBaseQuantity,
        unitPrice: averageUnitPrice // Use average unit price, not total price
      };
      setFormData({ ...formData, items: updatedItems });
    }
  };
  
  // Initialize form data when editing an existing quotation
  useEffect(() => {
    if (mode === "edit" && quotation) {
      setFormData({
        clientId: quotation.clientId,
        title: quotation.title || "",
        orderNumber: quotation.orderNumber || "",
        orderNumberAutogenerate: false,
        items: quotation.items?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate || "0",
          productId: item.productId,
          discountAmount: item.discountAmount || ""
        })) || [{ description: "", quantity: "", unitPrice: "", taxRate: "0", discountAmount: "" }],
        issueDate: quotation.date || new Date().toISOString().split("T")[0],
        validUntil: quotation.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "Approved",
        notes: quotation.notes || "",
        discount: parseFloat((quotation.discount || '0').toString().replace(/,/g, '')) || 0,
        footerPhoneOverride: quotation.footerPhoneOverride ?? "",
        footerBankDetailsOverride: quotation.footerBankDetailsOverride ?? ""
      });
    }
  }, [quotation, mode]);
  
  // Load products using the same enhanced method as POS
  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      setProductsError(null);
      
      // Fetch all products across pages so everything is searchable
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
  
  // Load clients and products on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch clients
        const clientsResponse = await fetch('/api/clients');
        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json();
          setClients(clientsData.clients || []);
        }
        
        // Load products using enhanced method
        await loadProducts();
      } catch (error) {
        console.error("Error loading form data:", error);
      }
    };
    
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);
  
  // Filter products based on active search query - True combobox like POS
  useEffect(() => {
    if (activeSearchIndex === null) {
      setFilteredProducts([]);
      setShowProductDropdown(false);
      return;
    }
    
    const currentQuery = itemSearchQueries[activeSearchIndex] || "";
    
    // If search query is empty, show ALL products (true combobox behavior)
    if (currentQuery.trim() === "") {
      setFilteredProducts(products);
    } else {
      // Filter products by search query (name and SKU)
      const query = currentQuery.toLowerCase();
      const filtered = products.filter(
          product => 
            product.name.toLowerCase().includes(query) || 
            (product.sku && product.sku.toLowerCase().includes(query))
      );
      setFilteredProducts(filtered);
    }
    
    // Show dropdown if we have an active search index and products
    setShowProductDropdown(activeSearchIndex !== null && products.length > 0);
  }, [itemSearchQueries, activeSearchIndex, products]);

  // Close product dropdown when clicking outside or pressing escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProductDropdown(false);
        setActiveSearchIndex(null);
      }
    };

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showProductDropdown]);
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };
  
  // Handle item changes
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: field === "quantity" || field === "unitPrice" || field === "taxRate" || field === "discountAmount"
        ? parseFloat(value) || 0 
        : value
    };
    
    // If product ID changes, update the description, unitPrice, and taxRate
    if (field === "productId" && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        updatedItems[index].description = product.name;
        updatedItems[index].unitPrice = product.price;
        // Apply product's tax rate if available
        if (product.taxRate !== undefined && product.taxRate !== null) {
          updatedItems[index].taxRate = product.taxRate;
        }
      }
    }
    
    setFormData({
      ...formData,
      items: updatedItems
    });
    
    // Clear item errors
    if (errors[`items.${index}.${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`items.${index}.${field}`];
      setErrors(newErrors);
    }
  };

  // Handle description input changes with product search
  const handleDescriptionChange = (index, value) => {
    console.log(`🔄 handleDescriptionChange: index=${index}, value="${value}"`);
    
    // Update the item description immediately to prevent data loss
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      description: value
    };
    
    // If a product is selected, clear it to allow custom description
    if (updatedItems[index].productId) {
      console.log(`Clearing productId for item ${index}`);
      updatedItems[index].productId = "";
    }
    
    setFormData({
      ...formData,
      items: updatedItems
    });
    
    // Update the search query for this specific item
    setItemSearchQueries(prev => ({ ...prev, [index]: value }));
    setActiveSearchIndex(index);
    // Always show dropdown when typing (true combobox behavior)
    setShowProductDropdown(true);
    
    console.log(`📝 Updated item ${index}:`, updatedItems[index]);
    
    // Clear item errors
    if (errors[`items.${index}.description`]) {
      const newErrors = { ...errors };
      delete newErrors[`items.${index}.description`];
      setErrors(newErrors);
    }
  };
  const updateDiscount = (selectedDiscount) => {
    const cleanNumber = (value) => {
      if (value === null || value === undefined) return 0;
      return parseFloat(value.toString().replace(/,/g, '')) || 0;
    };

    const subtotal = calculateSubtotal(formData.items); // Recalculate subtotal without discount
    const rawDiscount = cleanNumber(selectedDiscount);
    const validDiscount = Math.max(0, Math.min(rawDiscount, subtotal));

    setFormData({ ...formData, discount: validDiscount });
  };
  
  // Add a new item
  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: "", quantity: "", unitPrice: "", taxRate: "0", discountAmount: "" }
      ]
    });
  };
  
  // Remove an item
  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const updatedItems = [...formData.items];
      updatedItems.splice(index, 1);
      setFormData({
        ...formData,
        items: updatedItems
      });
    }
  };
  
  // Calculate totals
  const subtotal = calculateSubtotal(formData.items,formData.discount);
  const tax = calculateTax(formData.items,formData.discount);
  const total = calculateTotal(formData.items,formData.discount);
  
  // Calculate total line item discounts
  const totalLineItemDiscounts = formData.items.reduce((total, item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const perItemDiscount = parseFloat(item.discountAmount) || 0;
    return total + (quantity * perItemDiscount);
  }, 0);
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.clientId) {
      newErrors.clientId = "Client is required";
    }
    
    if (!formData.title) {
      newErrors.title = "Title is required";
    }
    
    if (!formData.issueDate) {
      newErrors.issueDate = "Issue date is required";
    }
    
    if (!formData.validUntil) {
      newErrors.validUntil = "Valid until date is required";
    }
    
    if (new Date(formData.validUntil) < new Date(formData.issueDate)) {
      newErrors.validUntil = "Valid until date cannot be before issue date";
    }
    
    // Validate each item
    formData.items.forEach((item, index) => {
      if (hasUnitManagement(item.product)) {
        // Special validation for unit-based products
        const itemUnitQuantities = unitQuantities[index] || {};
        const hasValidQuantities = Object.values(itemUnitQuantities).some(qty => qty > 0);
        
        if (!hasValidQuantities) {
          newErrors[`items.${index}.unitQuantities`] = "Please enter quantities for at least one unit";
        }
        
        return; // Skip other validations for unit-based products
      }
      
      // Only validate for non-unit-based products
      if (!item.description) {
        newErrors[`items.${index}.description`] = "Description is required";
      }
      
      if (item.quantity <= 0) {
        newErrors[`items.${index}.quantity`] = "Quantity must be greater than 0";
      }
      
      if (item.unitPrice < 0) {
        newErrors[`items.${index}.unitPrice`] = "Unit price cannot be negative";
      }
      
      if (item.taxRate < 0 || item.taxRate > 100) {
        newErrors[`items.${index}.taxRate`] = "Tax rate must be between 0 and 100";
      }
      
      // Validate that per-item discount doesn't exceed unit price (only if discount is provided)
      if (item.discountAmount && item.discountAmount !== "") {
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const perItemDiscount = parseFloat(item.discountAmount) || 0;
        if (perItemDiscount > unitPrice) {
          newErrors[`items.${index}.discountAmount`] = "Per-item discount cannot exceed unit price";
        }
      }
    });
    
    // Check if there's at least one item
    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
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
    
    setLoading(true);
    
    try {
      // Transform form data to ensure proper types
      const transformedData = {
        ...formData,
        discount: parseFloat(formData.discount) || 0,
        items: formData.items.map((item, index) => {
          // For unit-based products, calculate total quantity from unit quantities
          let finalQuantity = parseFloat(item.quantity) || 0;
          
          if (hasUnitManagement(item.product) && unitQuantities[index]) {
            // Calculate total quantity in base units from unit quantities
            let totalBaseQuantity = 0;
            Object.entries(unitQuantities[index]).forEach(([unitId, qty]) => {
              const unit = item.product.units?.find(u => u.id === unitId);
              if (unit && qty > 0) {
                const conversionRate = parseFloat(unit.conversionToBase);
                const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
                totalBaseQuantity += convertedToBase;
              }
            });
            finalQuantity = totalBaseQuantity;
          }
          
          return {
            ...item,
            quantity: finalQuantity,
            unitPrice: parseFloat(item.unitPrice) || 0,
            taxRate: parseFloat(item.taxRate) || 0,
            discountAmount: parseFloat(item.discountAmount) || 0,
            // Include unit quantities for unit-based products
            unitQuantities: hasUnitManagement(item.product) ? (unitQuantities[index] || {}) : null
          };
        })
      };
      
      // Submit transformed form data
      await onSubmit(transformedData);
      
      // Reset form and close modal on success
      setFormData({
        clientId: "",
        title: "",
        orderNumber: "",
        orderNumberAutogenerate: false,
        items: [{ description: "", quantity: "", unitPrice: "", taxRate: "0", discountAmount: "" }],
        issueDate: new Date().toISOString().split("T")[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "Approved",
        notes: "",
        discount: 0,
      });
      
      onClose();
    } catch (error) {
      console.error("Error submitting quotation:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Add this handler
  const handleClientCreated = (newClient) => {
    setClients((prev) => [...prev, newClient]);
    setFormData((prev) => ({ ...prev, clientId: newClient.id }));
  };

  // Handle product selection from dropdown
  const handleProductSelect = async (index, product) => {
    console.log(`Product selected: ${product.name} (ID: ${product.id}) for item ${index}`);
    
    try {
      // Fetch full product details including units
      const response = await fetch(`/api/stock/${product.id}`);
      if (response.ok) {
        const productData = await response.json();
        console.log("Full product data with units:", productData);
        
        const updatedItems = [...formData.items];
        updatedItems[index] = {
          ...updatedItems[index],
          description: productData.name, // Set description from product name
          unitPrice: productData.price || productData.unitPrice || "",
          productId: productData.id,
          // Apply product's tax rate if available
          taxRate: productData.taxRate !== undefined && productData.taxRate !== null ? productData.taxRate : (updatedItems[index].taxRate || 0),
          // Store full product data including units
          product: productData
        };
        
        // Initialize unit quantities for unit-based products
        if (hasUnitManagement(productData)) {
          const initialUnitQuantities = {};
          productData.units?.forEach(unit => {
            initialUnitQuantities[unit.id] = 0;
          });
          setUnitQuantities(prev => ({
            ...prev,
            [index]: initialUnitQuantities
          }));
        }
        
        setFormData({ ...formData, items: updatedItems });
      } else {
        // Fallback to basic product data if API fails
        const updatedItems = [...formData.items];
        updatedItems[index] = {
          ...updatedItems[index],
          description: product.name,
          unitPrice: product.price || product.unitPrice || "",
          productId: product.id,
          // Apply product's tax rate if available
          taxRate: product.taxRate !== undefined && product.taxRate !== null ? product.taxRate : (updatedItems[index].taxRate || 0)
        };
        setFormData({ ...formData, items: updatedItems });
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
      // Fallback to basic product data
      const updatedItems = [...formData.items];
      updatedItems[index] = {
        ...updatedItems[index],
        description: product.name,
        unitPrice: product.price || product.unitPrice || "",
        productId: product.id,
        // Apply product's tax rate if available
        taxRate: product.taxRate !== undefined && product.taxRate !== null ? product.taxRate : (updatedItems[index].taxRate || 0)
      };
      setFormData({ ...formData, items: updatedItems });
    }
    
    // Clear search state for this specific item
    setItemSearchQueries(prev => ({ ...prev, [index]: "" }));
    setShowProductDropdown(false);
    setActiveSearchIndex(null);
    
    console.log(`Updated item ${index} with product: ${product.name}`);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Create New Quotation" : "Edit Quotation"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="clientId">
                  Client <span className="text-red-500">*</span>
                </label>
                <ClientSearchCombobox
                  clients={clients}
                  value={formData.clientId}
                  onChange={handleChange}
                  onAddNew={() => setShowClientModal(true)}
                  placeholder="Search or select a client..."
                  error={errors.clientId}
                  showAddNew={true}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
                  Quotation title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Consulting services, Project XYZ"
                />
                {errors.title && (
                  <p className="text-red-500 text-xs mt-1">{errors.title}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="orderNumber">
                  Order number
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    id="orderNumber"
                    name="orderNumber"
                    placeholder={formData.orderNumberAutogenerate ? "Auto-generated" : "Enter order number"}
                    className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-100 disabled:text-gray-500 ${errors.orderNumber ? 'border-red-500' : 'border-gray-300'}`}
                    value={formData.orderNumber || ""}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    disabled={formData.orderNumberAutogenerate}
                  />
                  <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.orderNumberAutogenerate || false}
                      onChange={(e) => {
                        const autogen = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          orderNumberAutogenerate: autogen,
                          orderNumber: autogen ? `ORD-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : prev.orderNumber
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Autogenerate
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="issueDate">
                  Issue Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="issueDate"
                  name="issueDate"
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${errors.issueDate ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.issueDate}
                  onChange={handleChange}
                />
                {errors.issueDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.issueDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="validUntil">
                  Valid Until <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="validUntil"
                  name="validUntil"
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${errors.validUntil ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.validUntil}
                  onChange={handleChange}
                />
                {errors.validUntil && (
                  <p className="text-red-500 text-xs mt-1">{errors.validUntil}</p>
                )}
              </div>
            </div>
            <hr className="my-6" />
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Quotation Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>
            <div className="">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                      Item
                    </th>
                    <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      Qty
                    </th>
                    <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Price
                    </th>
                    <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Discount (per item)
                    </th>
                    <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      Tax %
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                          <div className="relative w-full min-w-[300px]" ref={productSearchRef}>
                              <input
                                type="text"
                              placeholder="Search products by name or SKU..."
                              className={`w-full p-3 border rounded-md text-sm ${errors[`items.${index}.description`] ? 'border-red-500' : 'border-gray-300'}`}
                              value={item.productId ? (products.find(p => p.id === item.productId)?.name || item.description) : (itemSearchQueries[index] || item.description)}
                                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                onFocus={() => {
                                console.log(`Search input focused for item ${index}`);
                                setActiveSearchIndex(index);
                                // Show dropdown immediately on focus (true combobox behavior)
                                    setShowProductDropdown(true);
                              }}
                              onKeyDown={(e) => {
                                // Add first matching product on Enter
                                if (e.key === 'Enter' && filteredProducts.length > 0) {
                                  e.preventDefault();
                                  const product = filteredProducts[0];
                                  handleProductSelect(index, product);
                                }
                              }}
                            />
                            <div className="absolute right-3 top-3 pointer-events-none">
                              <Search className="w-4 h-4 text-gray-400" />
                            </div>
                            
                            {/* Enhanced Product combobox dropdown - POS Style */}
                            {showProductDropdown && activeSearchIndex === index && (
                              <div className="absolute z-10 mt-1 w-full min-w-[400px] bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
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
                                  <>
                                    {/* Show header with count */}
                                    <div className="p-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                                      {itemSearchQueries[index] && itemSearchQueries[index].trim() !== "" 
                                        ? `Found ${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`
                                        : `All ${filteredProducts.length} products available`
                                      }
                                    </div>
                                    {filteredProducts.map(product => (
                                      <div 
                                        key={product.id}
                                        className={`p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex justify-between items-center ${product.stockLevel <= 0 ? 'opacity-50' : ''}`}
                                        onClick={() => handleProductSelect(index, product)}
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
                                                handleProductSelect(index, product);
                                              }}
                                            >
                                              + Add to quotation
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          {errors[`items.${index}.description`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.description`]}</p>
                          )}
                        </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {hasUnitManagement(item.product) ? (
                          <div className="text-center">
                            <div className="text-sm text-blue-600 font-medium">
                              {parseFloat(item.quantity || 0).toFixed(3)}
                            </div>
                            <div className="text-xs text-blue-500">calculated</div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            className={`w-16 p-2 border rounded-md text-sm ${errors[`items.${index}.quantity`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.quantity || ''}
                            step="1"
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            title="Enter the quantity of items"
                          />
                        )}
                        {errors[`items.${index}.quantity`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.quantity`]}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {hasUnitManagement(item.product) ? (
                          <div className="text-center">
                            <div className="text-sm text-blue-600 font-medium">
                              {formatCurrency(item.unitPrice || 0)}
                            </div>
                            <div className="text-xs text-blue-500">per unit</div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            className={`w-24 p-2 border rounded-md text-sm ${errors[`items.${index}.unitPrice`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.unitPrice || ''}
                            step="0.01"
                            onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                            title="Enter the price per unit in MWK"
                          />
                        )}
                        {errors[`items.${index}.unitPrice`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.unitPrice`]}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">MK</span>
                          <input
                            type="number"
                            className={`w-20 pl-6 pr-2 py-2 border rounded-md text-sm ${errors[`items.${index}.discountAmount`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.discountAmount || ''}
                            step="0.01"
                            placeholder="0.00"
                            onChange={(e) => handleItemChange(index, "discountAmount", e.target.value)}
                            title="Enter the discount amount in MWK per individual item"
                          />
                        </div>
                        {errors[`items.${index}.discountAmount`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.discountAmount`]}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          className={`w-16 p-2 border rounded-md text-sm ${errors[`items.${index}.taxRate`] ? 'border-red-500' : 'border-gray-300'}`}
                          value={item.taxRate || ''}
                          max="100"
                          step="0.1"
                          onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                          title="Enter the tax rate as a percentage (0-100%)"
                        />
                        {errors[`items.${index}.taxRate`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.taxRate`]}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                        {formatCurrency(calculateQuotationItemTotals(item).amount)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Unit-Based Products Section */}
            {formData.items.some(item => hasUnitManagement(item.product)) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <h3 className="text-sm font-medium text-blue-900 mb-3">Unit-Based Products</h3>
                <div className="space-y-4">
                  {formData.items
                    .map((item, index) => ({ item, index }))
                    .filter(({ item }) => hasUnitManagement(item.product))
                    .map(({ item, index }) => (
                      <div key={index} className="bg-white border border-blue-200 rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{item.description}</span>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-xs text-blue-600 font-medium">Unit-Based</span>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">MK {item.unitPrice}</span>
                        </div>
                        <UnitBasedQuantityInput
                          product={item.product}
                          quantity={item.quantity}
                          onQuantityChange={(newQuantity) => handleUnitQuantityChange(index, newQuantity)}
                          onPriceChange={(newPrice) => handleUnitPriceChange(index, newPrice)}
                          onUnitQuantitiesChange={(unitQuantities) => handleUnitQuantitiesChange(index, unitQuantities)}
                          className="w-full"
                        />
                        {errors[`items.${index}.unitQuantities`] && (
                          <p className="text-red-500 text-xs mt-2">{errors[`items.${index}.unitQuantities`]}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {errors.items && (
              <p className="text-red-500 text-xs mt-1">{errors.items}</p>
            )}
            
            <div className="flex justify-end mt-4">
              <div className="w-64">
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">Global Discount:</span>
                  <div className="flex items-center">
                    <span className="text-gray-500 text-sm mr-1">MK</span>
                    <input
                      type="number"
                                              className="w-28 p-1 text-right border border-gray-200 rounded-md"
                      step="0.01"
                      min="0"
                      value={formData.discount || ''}
                      onChange={(e) => updateDiscount(e.target.value)}
                      title="Enter the global discount amount in MWK"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {totalLineItemDiscounts > 0 && (
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Line Item Discounts:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(totalLineItemDiscounts)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between py-2 text-lg font-bold border-t border-gray-200 mt-2 pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add any additional notes or terms and conditions"
              ></textarea>
            </div>
            
            <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm font-medium text-gray-700 mb-2">Footer overrides (optional)</p>
              <p className="text-xs text-gray-500 mb-2">Override the default phone and bank details shown in the document footer. Leave blank to use settings defaults.</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5" htmlFor="footerPhoneOverride">Footer phone</label>
                  <input
                    id="footerPhoneOverride"
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={formData.footerPhoneOverride || ""}
                    onChange={(e) => setFormData({ ...formData, footerPhoneOverride: e.target.value })}
                    placeholder="e.g. +265 1 234 567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5" htmlFor="footerBankDetailsOverride">Footer bank details</label>
                  <textarea
                    id="footerBankDetailsOverride"
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={formData.footerBankDetailsOverride || ""}
                    onChange={(e) => setFormData({ ...formData, footerBankDetailsOverride: e.target.value })}
                    placeholder="Bank name, account name, number, branch..."
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-100 font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium shadow hover:bg-blue-700 flex items-center transition"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⌛</span>
                Saving...
              </>
            ) : (
              mode === "create" ? "Create Quotation" : "Update Quotation"
            )}
          </button>
        </div>
      </div>
      {/* Add Client Modal */}
      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onClientCreated={handleClientCreated}
      />
    </div>
  );
};

export default QuotationModal;
"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Info, Loader } from "lucide-react";
import { calculateTax, calculateSubtotal, calculateTotal } from "@/lib/invoiceCalculations";
import ClientModal from "../ClientModal";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";

const SalesModal = ({
  isOpen,
  onClose,
  mode,
  sale,
  onSubmit
}) => {
  // Load payment accounts dynamically
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();
  
  const [formData, setFormData] = useState({
    clientId: "",
    items: [{ description: "", quantity: 1, unitPrice: "", taxRate: "", accountId: "" }],
    saleDate: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    notes: ""
  });
  
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [incomeAccounts, setIncomeAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showClientModal, setShowClientModal] = useState(false);

  // Set default payment method when accounts load
  useEffect(() => {
    if (paymentAccounts.length > 0 && !formData.paymentMethod) {
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      if (defaultAccount) {
        setFormData(prev => ({ ...prev, paymentMethod: defaultAccount.id }));
      }
    }
  }, [paymentAccounts]);
  
  // Initialize form data when editing an existing sale
  useEffect(() => {
    if (mode === "edit" && sale && paymentAccounts.length > 0) {
      // Try to find payment account by name if paymentMethod is a string
      let paymentMethodId = sale.paymentMethod;
      if (sale.paymentMethod && typeof sale.paymentMethod === 'string' && !sale.paymentMethod.includes('-')) {
        // Looks like a payment method name, try to find account
        const account = paymentAccounts.find(acc => acc.name === sale.paymentMethod || acc.name.toLowerCase() === sale.paymentMethod.toLowerCase());
        if (account) {
          paymentMethodId = account.id;
        }
      }
      
      setFormData({
        clientId: sale.clientId,
        items: sale.items?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          productId: item.productId,
          accountId: item.accountId || ""
        })) || [{ description: "", quantity: 1, unitPrice: "", taxRate: "", accountId: "" }],
        saleDate: new Date(sale.saleDate).toISOString().split("T")[0],
        paymentMethod: paymentMethodId || "",
        notes: sale.notes || ""
      });
    }
  }, [sale, mode, paymentAccounts]);
  
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
        
        // Fetch products
        const productsResponse = await fetch('/api/stock');
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          setProducts(productsData.products || []);
        }

        const accountsResponse = await fetch('/api/chart-of-accounts?accountType=Income&isActive=true');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          setIncomeAccounts(accountsData.accounts || accountsData.data || []);
        }
      } catch (error) {
        console.error("Error loading form data:", error);
      }
    };
    
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);
  
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
      [field]: field === "quantity" || field === "unitPrice" || field === "taxRate" 
        ? parseFloat(value) || 0 
        : value
    };
    
    // If product ID changes, update the description, unitPrice, and taxRate
    if (field === "productId" && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        updatedItems[index].description = product.name;
        updatedItems[index].unitPrice = product.price;
        // Set default tax rate if product doesn't have one
        if (!updatedItems[index].taxRate) {
          updatedItems[index].taxRate = 0;
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
  
  // Add a new item
  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: "", quantity: 1, unitPrice: "", taxRate: "", accountId: "" }
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
  const subtotal = calculateSubtotal(formData.items);
  const tax = calculateTax(formData.items);
  const total = calculateTotal(formData.items);
  const isAccountSelectionValid = formData.items.every(item => item.accountId);
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.clientId) {
      newErrors.clientId = "Client is required";
    }
    
    if (!formData.saleDate) {
      newErrors.saleDate = "Sale date is required";
    }
    
    // Validate each item
    formData.items.forEach((item, index) => {
      if (!item.description) {
        newErrors[`items.${index}.description`] = "Description is required";
      }
      
      if (item.quantity <= 0) {
        newErrors[`items.${index}.quantity`] = "Quantity must be greater than 0";
      }
      
      if (item.unitPrice < 0) {
        newErrors[`items.${index}.unitPrice`] = "Selling Price cannot be negative";
      }
      
      if (item.taxRate < 0 || item.taxRate > 100) {
        newErrors[`items.${index}.taxRate`] = "Tax rate must be between 0 and 100";
      }

      if (!item.accountId) {
        newErrors[`items.${index}.accountId`] = "Income account is required";
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
      // Submit form data
      await onSubmit(formData);
      
      // Reset form and close modal on success
      setFormData({
        clientId: "",
        items: [{ description: "", quantity: 1, unitPrice: "", taxRate: "", accountId: "" }],
        saleDate: new Date().toISOString().split("T")[0],
        paymentMethod: "cash",
        notes: ""
      });
      
      onClose();
    } catch (error) {
      console.error("Error submitting sale:", error);
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
  
  const handleClientCreated = (newClient) => {
    setClients((prev) => [...prev, newClient]);
    setFormData((prev) => ({ ...prev, clientId: newClient.id }));
    setShowClientModal(false);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Create New POS Transaction" : "Edit POS Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="clientId">
                  Client <span className="text-red-500">*</span>
                </label>
                <select
                  id="clientId"
                  name="clientId"
                  className={`w-full p-2 border rounded-md ${errors.clientId ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.clientId}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setShowClientModal(true);
                    } else {
                      handleChange(e);
                    }
                  }}
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add New Client</option>
                </select>
                {errors.clientId && (
                  <p className="text-red-500 text-xs mt-1">{errors.clientId}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="paymentMethod">
                  Payment Method
                </label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  disabled={isLoadingPaymentAccounts}
                >
                  <option value="">{isLoadingPaymentAccounts ? 'Loading accounts...' : 'Select an account'}</option>
                  {paymentAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.accountType ? `(${account.accountType})` : ''}
                    </option>
                  ))}
                  {/* <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option> */}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="saleDate">
                  Sale Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="saleDate"
                  name="saleDate"
                  className={`w-full p-2 border rounded-md ${errors.saleDate ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.saleDate}
                  onChange={handleChange}
                />
                {errors.saleDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.saleDate}</p>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Sale Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Income Account
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Selling Price
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tax Rate (%)
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <select
                            className={`w-full p-2 border rounded-md ${errors[`items.${index}.description`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.productId || ""}
                            onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                          >
                            <option value="">Custom item</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                          {!item.productId && (
                            <input
                              type="text"
                              placeholder="Description"
                              className={`mt-1 w-full p-2 border rounded-md ${errors[`items.${index}.description`] ? 'border-red-500' : 'border-gray-300'}`}
                              value={item.description}
                              onChange={(e) => handleItemChange(index, "description", e.target.value)}
                            />
                          )}
                          {errors[`items.${index}.description`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.description`]}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <select
                            className={`w-full p-2 border rounded-md ${errors[`items.${index}.accountId`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.accountId || ""}
                            onChange={(e) => handleItemChange(index, "accountId", e.target.value)}
                          >
                            <option value="">Select income account</option>
                            {incomeAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.accountCode ? `${account.accountCode} - ${account.accountName || account.name}` : (account.accountName || account.name)}
                              </option>
                            ))}
                          </select>
                          {errors[`items.${index}.accountId`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.accountId`]}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <input
                            type="number"
                            className={`w-20 p-2 border rounded-md ${errors[`items.${index}.quantity`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.quantity}
                            min="1"
                            step="1"
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          />
                          {errors[`items.${index}.quantity`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.quantity`]}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <input
                            type="number"
                            className={`w-28 p-2 border rounded-md ${errors[`items.${index}.unitPrice`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.unitPrice}
                            min="0"
                            step="0.01"
                            placeholder="MK 0.00"
                            onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                          />
                          {errors[`items.${index}.unitPrice`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.unitPrice`]}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <input
                            type="number"
                            className={`w-20 p-2 border rounded-md ${errors[`items.${index}.taxRate`] ? 'border-red-500' : 'border-gray-300'}`}
                            value={item.taxRate}
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="0.00"
                            onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                          />
                          {errors[`items.${index}.taxRate`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.taxRate`]}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                          {formatCurrency((item.quantity || 0) * (parseFloat(item.unitPrice) || 0))}
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
              
              {errors.items && (
                <p className="text-red-500 text-xs mt-1">{errors.items}</p>
              )}
              
              <div className="flex justify-end mt-4">
                <div className="w-64">
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
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
                placeholder="Add any additional notes or payment details"
              ></textarea>
            </div>
          </form>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            disabled={loading || !isAccountSelectionValid}
            title={!isAccountSelectionValid ? "Select an income account for each item" : ""}
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⌛</span>
                Saving...
              </>
            ) : (
              mode === "create" ? "Create Transaction" : "Update Transaction"
            )}
          </button>
        </div>
      </div>
      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onClientCreated={handleClientCreated}
      />
    </div>
  );
};

export default SalesModal; 
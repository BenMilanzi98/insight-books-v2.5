"use client";

import { useState, useEffect } from "react";
import { X, Package, ArrowRight, Check, RefreshCw, Building2, Plus, Trash2 } from "lucide-react";

/**
 * Transfer stock between businesses (tenants) — same list as /switch-tenant via /api/tenant/list.
 * Server resolves default branch per business and runs the transfer.
 */
export const StockTransferModal = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [fromTenantId, setFromTenantId] = useState("");
  const [toTenantId, setToTenantId] = useState("");
  const [sourceProducts, setSourceProducts] = useState([]);
  const [loadingSourceProducts, setLoadingSourceProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]); // Array of {productId, quantity, availableStock}
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingTenants(true);
      try {
        const res = await fetch("/api/tenant/list", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setTenants(Array.isArray(data.tenants) ? data.tenants : []);
        }
      } catch {
        if (!cancelled) setTenants([]);
      } finally {
        if (!cancelled) setLoadingTenants(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !fromTenantId) {
      setSourceProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSourceProducts(true);
      try {
        const params = new URLSearchParams({
          allBranches: "true",
          tenantId: fromTenantId,
          limit: "0",
          page: "1",
        });
        const res = await fetch(`/api/stock?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setSourceProducts(Array.isArray(data.products) ? data.products : []);
        }
      } catch {
        if (!cancelled) setSourceProducts([]);
      } finally {
        if (!cancelled) setLoadingSourceProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, fromTenantId]);

  const products = sourceProducts;

  const availableProducts = products.filter(p =>
    parseFloat(p.stockLevel || 0) > 0 &&
    !selectedProducts.find(sp => sp.productId === (p.id || p._id))
  );

  if (!isOpen) return null;

  const handleAddProduct = () => {
    if (availableProducts.length === 0) return;
    
    const firstAvailable = availableProducts[0];
    setSelectedProducts([
      ...selectedProducts,
      {
        productId: firstAvailable.id || firstAvailable._id,
        quantity: "",
        availableStock: parseFloat(firstAvailable.stockLevel || 0),
        productName: firstAvailable.name,
        productSku: firstAvailable.sku
      }
    ]);
  };

  const handleRemoveProduct = (index) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleProductChange = (index, productId) => {
    const product = products.find(p => (p.id || p._id) === productId);
    if (product) {
      const updated = [...selectedProducts];
      updated[index] = {
        ...updated[index],
        productId: productId,
        availableStock: parseFloat(product.stockLevel || 0),
        productName: product.name,
        productSku: product.sku,
        quantity: "" // Reset quantity when product changes
      };
      setSelectedProducts(updated);
    }
  };

  const handleQuantityChange = (index, quantity) => {
    const updated = [...selectedProducts];
    updated[index].quantity = quantity;
    setSelectedProducts(updated);
    
    // Clear error for this product
    if (errors[`quantity_${index}`]) {
      const newErrors = { ...errors };
      delete newErrors[`quantity_${index}`];
      setErrors(newErrors);
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!fromTenantId) newErrors.fromTenant = "Source business is required";
    if (!toTenantId) newErrors.toTenant = "Destination business is required";
    if (fromTenantId === toTenantId) {
      newErrors.toTenant = "Source and destination businesses must be different";
    }
    if (selectedProducts.length === 0) {
      newErrors.products = "Please select at least one product to transfer";
    }
    
    selectedProducts.forEach((sp, index) => {
      const qty = parseFloat(sp.quantity);
      if (!sp.quantity || isNaN(qty) || qty <= 0) {
        newErrors[`quantity_${index}`] = "Valid quantity is required";
      } else if (qty > sp.availableStock) {
        newErrors[`quantity_${index}`] = `Insufficient stock. Available: ${sp.availableStock}`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const transfers = selectedProducts.map(sp => ({
      fromTenantId,
      toTenantId,
      productId: sp.productId,
      quantity: parseFloat(sp.quantity),
      notes: notes || null
    }));

    let successCount = 0;
    for (const transfer of transfers) {
      const success = await onSubmit(transfer);
      if (success) successCount++;
    }

    if (successCount === transfers.length) {
      setFromTenantId("");
      setToTenantId("");
      setSourceProducts([]);
      setSelectedProducts([]);
      setNotes("");
      setErrors({});
    }
  };

  const handleClose = () => {
    setFromTenantId("");
    setToTenantId("");
    setSourceProducts([]);
    setSelectedProducts([]);
    setNotes("");
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ zIndex: 9999 }}>
      {/* Backdrop overlay - the "weird background" */}
      <div 
        className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
        onClick={handleClose}
        style={{ zIndex: 9998 }}
      />
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0" style={{ position: 'relative', zIndex: 9999 }}>
        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-visible shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Transfer Stock</h3>
                <p className="text-sm text-gray-500 mt-1">Same businesses as &quot;Switch business&quot; — stock uses each business&apos;s default location</p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {tenants.length > 0 && tenants.length < 2 && (
              <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                Add another business (from <a href="/switch-tenant" className="underline font-medium">Switch business</a>) to transfer stock between businesses.
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full">
              <div className="space-y-4 w-full">
                {/* From business */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From business *
                  </label>
                  <select
                    value={fromTenantId}
                    onChange={(e) => {
                      setFromTenantId(e.target.value);
                      setSelectedProducts([]);
                      setToTenantId("");
                      if (errors.fromTenant) {
                        const newErrors = { ...errors };
                        delete newErrors.fromTenant;
                        setErrors(newErrors);
                      }
                    }}
                    disabled={loadingTenants}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${errors.fromTenant ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Select source business</option>
                    {tenants.length > 0 ? (
                      tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>{loadingTenants ? "Loading businesses..." : "No businesses available"}</option>
                    )}
                  </select>
                  {errors.fromTenant && (
                    <p className="mt-1 text-sm text-red-600">{errors.fromTenant}</p>
                  )}
                </div>

                {/* Arrow Icon */}
                <div className="flex justify-center -my-2">
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>

                {/* To business */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To business *
                  </label>
                  <select
                    value={toTenantId}
                    onChange={(e) => {
                      setToTenantId(e.target.value);
                      if (errors.toTenant) {
                        const newErrors = { ...errors };
                        delete newErrors.toTenant;
                        setErrors(newErrors);
                      }
                    }}
                    disabled={!fromTenantId || loadingTenants}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${errors.toTenant ? 'border-red-500' : 'border-gray-300'} ${!fromTenantId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="">{fromTenantId ? 'Select destination business' : 'Select source business first'}</option>
                    {fromTenantId
                      ? tenants
                          .filter((t) => t.id !== fromTenantId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))
                      : null}
                  </select>
                  {errors.toTenant && (
                    <p className="mt-1 text-sm text-red-600">{errors.toTenant}</p>
                  )}
                </div>

                {/* Products Section */}
                {fromTenantId && toTenantId && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Products to Transfer *
                      </label>
                      {!loadingSourceProducts && availableProducts.length > 0 && (
                        <button
                          type="button"
                          onClick={handleAddProduct}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
                        >
                          <Plus className="w-4 h-4" />
                          Add Product
                        </button>
                      )}
                      {loadingSourceProducts && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Loading inventory…
                        </span>
                      )}
                    </div>

                    {errors.products && (
                      <p className="mb-2 text-sm text-red-600">{errors.products}</p>
                    )}

                    {selectedProducts.length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-500">No products selected</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Add Product" to start</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {selectedProducts.map((sp, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Product {index + 1}
                              </label>
                              <select
                                value={sp.productId}
                                onChange={(e) => handleProductChange(index, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select product</option>
                                {products
                                  .filter(p =>
                                    parseFloat(p.stockLevel || 0) > 0 &&
                                    ((p.id || p._id) === sp.productId ||
                                      !selectedProducts.find(
                                        (sp2, i2) => i2 !== index && sp2.productId === (p.id || p._id)
                                      ))
                                  )
                                  .map(product => (
                                    <option key={product.id || product._id} value={product.id || product._id}>
                                      {product.name} {product.sku ? `(${product.sku})` : ''} - Stock: {parseFloat(product.stockLevel || 0)}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            {selectedProducts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProduct(index)}
                                className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                title="Remove product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          {sp.productId && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Quantity *
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={sp.quantity}
                                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                                  min="0.01"
                                  step="0.01"
                                  max={sp.availableStock}
                                  className={`flex-1 px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-300'}`}
                                  placeholder="Enter quantity"
                                />
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  Max: {sp.availableStock}
                                </span>
                              </div>
                              {errors[`quantity_${index}`] && (
                                <p className="mt-1 text-xs text-red-600">{errors[`quantity_${index}`]}</p>
                              )}
                              {sp.quantity && parseFloat(sp.quantity) > 0 && !errors[`quantity_${index}`] && (
                                <p className="mt-1 text-xs text-green-600 flex items-center">
                                  <Check className="w-3 h-3 mr-1" />
                                  {sp.productName} - {sp.quantity} units
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!fromTenantId && (
                  <div className="text-center py-4 text-sm text-gray-500 border-t pt-4">
                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Select source and destination businesses first</p>
                    <p className="text-xs text-gray-400 mt-1">Then you can add products to transfer</p>
                  </div>
                )}
                
                {fromTenantId && !toTenantId && (
                  <div className="text-center py-4 text-sm text-gray-500 border-t pt-4">
                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Select destination business to continue</p>
                  </div>
                )}

                {/* Notes */}
                {fromTenantId && toTenantId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add any notes about this transfer..."
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  disabled={loading || loadingSourceProducts || selectedProducts.length === 0}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 mr-2" />
                      Transfer {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simplified Stock Transfers List - Show completed transfers only
export const StockTransfersList = ({
  transfers = [],
  loading = false,
  onRefresh
}) => {
  // Show only completed (received) transfers for simplicity
  const completedTransfers = transfers.filter(t => 
    t.status?.toLowerCase() === 'received'
  ).slice(0, 10); // Show last 10 transfers

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading transfers...</span>
      </div>
    );
  }

  if (completedTransfers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No recent transfers</p>
        <p className="text-xs text-gray-400 mt-1">Transfers will appear here after completion</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent Transfers</h3>
          <p className="text-sm text-gray-500">Last 10 completed transfers</p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        )}
      </div>

      <div className="space-y-2">
        {completedTransfers.map((transfer) => (
          <div
            key={transfer.id || transfer._id}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {transfer.product?.name || "N/A"}
                  </span>
                  {transfer.product?.sku && (
                    <span className="text-sm text-gray-500">({transfer.product.sku})</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 mt-2">
                  <span className="text-gray-500">From</span>
                  <span className="font-medium text-gray-900">
                    {transfer.fromBranch?.tenant?.name || transfer.fromBranch?.name || "N/A"}
                  </span>
                  {transfer.fromBranch?.tenant?.name && transfer.fromBranch?.name ? (
                    <span className="text-xs text-gray-500">({transfer.fromBranch.name})</span>
                  ) : null}
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500">To</span>
                  <span className="font-medium text-gray-900">
                    {transfer.toBranch?.tenant?.name || transfer.toBranch?.name || "N/A"}
                  </span>
                  {transfer.toBranch?.tenant?.name && transfer.toBranch?.name ? (
                    <span className="text-xs text-gray-500">({transfer.toBranch.name})</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>Qty: {transfer.quantity || 0}</span>
                  <span>•</span>
                  <span>
                    {transfer.receivedAt 
                      ? new Date(transfer.receivedAt).toLocaleDateString()
                      : transfer.createdAt 
                      ? new Date(transfer.createdAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
              <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Check className="w-3 h-3 mr-1" />
                  Completed
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Stock Per Branch Component
export const StockPerBranch = ({
  branches = [],
  loading = false
}) => {
  // Format currency in Malawi Kwacha
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
      return 'MWK 0';
    }

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
      return `MWK ${Number(numericAmount).toLocaleString() || 0}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading stock data...</span>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
        <p>No business stock data available</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock by business</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch) => {
          // Calculate total value if not provided
          const totalValue = branch.totalValue !== undefined 
            ? branch.totalValue 
            : (branch.totalStockValue || branch.stockValue || 0);
          
          return (
            <div
              key={branch.id || branch._id}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-gray-500" />
                  {branch.name || "Unnamed business"}
                </h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Products:</span>
                  <span className="font-medium text-gray-900">
                    {branch.productCount || branch.products?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Stock:</span>
                  <span className="font-medium text-gray-900">
                    {branch.totalQuantity || branch.quantity || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Stock Value:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

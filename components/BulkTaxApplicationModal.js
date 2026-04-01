"use client";

import { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const BulkTaxApplicationModal = ({ 
  isOpen, 
  onClose, 
  products = [], 
  showToast 
}) => {
  const [selectedTaxTypeIds, setSelectedTaxTypeIds] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [applyToAll, setApplyToAll] = useState(false);
  const [taxTypes, setTaxTypes] = useState([]);
  const [taxTypesLoading, setTaxTypesLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch tax types when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTaxTypes();
      // Reset state when opening
      setSelectedTaxTypeIds([]);
      setSelectedProductIds([]);
      setApplyToAll(false);
      setSearchTerm('');
    }
  }, [isOpen]);

  const fetchTaxTypes = async () => {
    setTaxTypesLoading(true);
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
      setTaxTypesLoading(false);
    }
  };

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products;
    }
    const term = searchTerm.toLowerCase();
    return products.filter(product => 
      product.name?.toLowerCase().includes(term) ||
      product.sku?.toLowerCase().includes(term) ||
      product.category?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  // Handle tax type selection
  const handleTaxTypeToggle = (taxTypeId) => {
    setSelectedTaxTypeIds(prev => {
      if (prev.includes(taxTypeId)) {
        return prev.filter(id => id !== taxTypeId);
      } else {
        return [...prev, taxTypeId];
      }
    });
  };

  // Handle product selection
  const handleProductToggle = (productId) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  // Handle select all products
  const handleSelectAllProducts = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  // Handle apply taxes
  const handleApplyTaxes = async () => {
    if (selectedTaxTypeIds.length === 0) {
      showToast('error', 'No tax selected', 'Please select at least one tax type');
      return;
    }

    if (!applyToAll && selectedProductIds.length === 0) {
      showToast('error', 'No products selected', 'Please select products or choose "Apply to All Products"');
      return;
    }

    const productIds = applyToAll ? [] : selectedProductIds;
    const productCount = applyToAll ? products.length : selectedProductIds.length;

    if (productCount === 0) {
      showToast('error', 'No products', 'No products available to update');
      return;
    }

    setIsApplying(true);
    try {
      const response = await fetch('/api/products/bulk-taxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taxTypeIds: selectedTaxTypeIds,
          productIds: productIds,
          applyToAll: applyToAll,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply taxes');
      }

      showToast(
        'success',
        'Taxes applied successfully',
        `Applied to ${data.success} product(s)${data.failed > 0 ? ` (${data.failed} failed)` : ''}`
      );

      // Close modal and refresh inventory
      onClose();
      
      // Trigger page refresh if callback provided
      if (window.location) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error applying taxes:', error);
      showToast('error', 'Failed to apply taxes', error.message);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  const selectedTaxNames = taxTypes
    .filter(tax => selectedTaxTypeIds.includes(tax.id))
    .map(tax => tax.taxName)
    .join(', ');

  const productCount = applyToAll ? products.length : selectedProductIds.length;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeInUp">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Apply Taxes to Products</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              onClick={onClose}
              type="button"
              disabled={isApplying}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Step 1: Select Tax Types */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Step 1: Select Tax Type(s)
              </h3>
              {taxTypesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-600">Loading tax types...</span>
                </div>
              ) : taxTypes.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    No active tax types available. <a href="/tax-types" className="text-blue-600 hover:underline">Create tax types</a> first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-3 border border-gray-300 rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                  {taxTypes.map((tax) => (
                    <label 
                      key={tax.id} 
                      className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTaxTypeIds.includes(tax.id)}
                        onChange={() => handleTaxTypeToggle(tax.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={isApplying}
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
              {selectedTaxTypeIds.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: <span className="font-medium">{selectedTaxNames}</span>
                </p>
              )}
            </div>

            {/* Step 2: Select Products */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Step 2: Select Products
              </h3>
              
              {/* Apply to All Option */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => {
                      setApplyToAll(e.target.checked);
                      if (e.target.checked) {
                        setSelectedProductIds([]);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isApplying}
                  />
                  <span className="text-sm font-medium text-blue-800">
                    Apply to All Products ({products.length} products)
                  </span>
                </label>
                <p className="text-xs text-blue-700 mt-1 ml-6">
                  This will apply the selected tax(es) to all products in your inventory.
                </p>
              </div>

              {!applyToAll && (
                <>
                  {/* Search Products */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search products by name, SKU, or category..."
                      className="w-full p-2 border border-gray-300 rounded-md"
                      disabled={isApplying}
                    />
                  </div>

                  {/* Select All Button */}
                  {filteredProducts.length > 0 && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={handleSelectAllProducts}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        disabled={isApplying}
                      >
                        {selectedProductIds.length === filteredProducts.length
                          ? 'Deselect All'
                          : `Select All (${filteredProducts.length})`}
                      </button>
                      {selectedProductIds.length > 0 && (
                        <span className="ml-2 text-sm text-gray-600">
                          {selectedProductIds.length} selected
                        </span>
                      )}
                    </div>
                  )}

                  {/* Product List */}
                  <div className="border border-gray-300 rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        {searchTerm ? 'No products found matching your search' : 'No products available'}
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {filteredProducts.map((product) => (
                          <label
                            key={product.id}
                            className="flex items-center space-x-3 p-3 hover:bg-white cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(product.id)}
                              onChange={() => handleProductToggle(product.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              disabled={isApplying}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {product.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {product.sku || 'No SKU'} • {product.category || 'Uncategorized'}
                              </p>
                            </div>
                            <div className="text-xs text-gray-600">
                              MWK {Number(product.price || product.unitPrice || 0).toLocaleString()}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Summary */}
            {selectedTaxTypeIds.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Summary</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Tax Type(s):</span> {selectedTaxNames}
                  </p>
                  <p>
                    <span className="font-medium">Products:</span>{' '}
                    {applyToAll 
                      ? `All ${products.length} products`
                      : `${selectedProductIds.length} selected product(s)`
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    This will {applyToAll ? 'replace' : 'apply'} the selected tax(es) to the selected product(s).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyTaxes}
            disabled={isApplying || selectedTaxTypeIds.length === 0 || (!applyToAll && selectedProductIds.length === 0)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <CheckCircle size={16} className="mr-1" />
                <span>Apply to {productCount} Product{productCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkTaxApplicationModal;


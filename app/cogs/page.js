// app/cogs/page.js
"use client";
import { useState, useEffect } from "react";
import { 
  AlertCircle, 
  Package, 
  TrendingUp, 
  CreditCard, 
  ChevronDown,
  ChevronUp,
  DollarSign,
  ShoppingCart,
  BarChart3,
  Calendar,
  Hash
} from "lucide-react";

const COGSManagement = () => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [recordedExpenses, setRecordedExpenses] = useState(new Set());

  // Fetch COGS data on component mount
  useEffect(() => {
    fetchCOGSData();
    
    // Load recorded expenses from localStorage
    const savedRecordedExpenses = localStorage.getItem('cogsRecordedExpenses');
    if (savedRecordedExpenses) {
      setRecordedExpenses(new Set(JSON.parse(savedRecordedExpenses)));
    }
  }, []);

  const fetchCOGSData = async () => {
    try {
      setIsLoading(true);
      const [summaryResponse, productsResponse] = await Promise.all([
        fetch('/api/cogs/summary'),
        fetch('/api/cogs/products')
      ]);
      
      const summaryData = await summaryResponse.json();
      const productsData = await productsResponse.json();
      
      if (summaryResponse.ok) {
        setSummary(summaryData);
      } else {
        setError(summaryData.error || 'Failed to fetch COGS summary');
      }

      if (productsResponse.ok) {
        setProducts(productsData.products || []);
      } else {
        setError(productsData.error || 'Failed to fetch products data');
      }
    } catch (error) {
      setError('Failed to fetch COGS data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProductExpansion = (productId) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const formatCurrency = (amount) => {
    return `MK ${amount?.toLocaleString() || '0.00'}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleRecordAsExpense = async (product) => {
    if (!product.totalCOGS || product.totalCOGS <= 0) {
      setError('No COGS amount to record as expense');
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `COGS Expense - ${product.name} (Fully Sold)`,
          amount: product.totalCOGS,
          category: 'Cost of Goods Sold',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'cash',
          status: 'approved',
          notes: `Total cost of goods sold for ${product.name}. Product fully sold out.`
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Show success message
        setError(null);
        
        // Mark this product as recorded
        const newRecordedExpenses = new Set([...recordedExpenses, product.id]);
        setRecordedExpenses(newRecordedExpenses);
        
        // Save to localStorage for persistence
        localStorage.setItem('cogsRecordedExpenses', JSON.stringify([...newRecordedExpenses]));
        
        // Refresh the data to update the display
        await fetchCOGSData();
        
        alert(`Successfully recorded ${formatCurrency(product.totalCOGS)} as expense for ${product.name}`);
      } else {
        setError(data.error || 'Failed to record expense');
      }
    } catch (error) {
      console.error('Error recording expense:', error);
      setError('Failed to record expense');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cost of Goods Sold (COGS) Management</h1>
          <p className="text-gray-600">Track inventory costs, sales records, and profit margins for each product</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-800 font-medium mb-1">Error Loading COGS Data</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-blue-100 p-3 rounded-full mr-4">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{formatCurrency(summary?.summary?.totalCOGS || 0)}</span>
            <span className="text-gray-600 text-sm">Total COGS</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-green-100 p-3 rounded-full mr-4">
            <Package size={20} className="text-green-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{products.length}</span>
            <span className="text-gray-600 text-sm">Total Products</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-purple-100 p-3 rounded-full mr-4">
            <BarChart3 size={20} className="text-purple-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{summary?.summary?.transactionCount || 0}</span>
            <span className="text-gray-600 text-sm">COGS Transactions</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-yellow-100 p-3 rounded-full mr-4">
            <DollarSign size={20} className="text-yellow-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{formatCurrency(summary?.summary?.totalCOGSExpenses || 0)}</span>
            <span className="text-gray-600 text-sm">COGS Expenses</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Product Sales & COGS Tracking</h2>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 border-4 border-t-blue-600 border-r-transparent border-l-transparent border-b-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No products found. Add products to your inventory to start tracking COGS.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div key={product.id} className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  {/* Product Header */}
                  <button
                    onClick={() => toggleProductExpansion(product.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-medium text-gray-900 truncate">{product.name}</h3>
                          <p className="text-sm text-gray-500 truncate">ID: {product.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right min-w-0">
                          <p className="text-xs text-gray-500 truncate">Order Price</p>
                          <p className="text-sm font-medium truncate">{formatCurrency(product.cost)}</p>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-xs text-gray-500 truncate">Selling Price</p>
                          <p className="text-sm font-medium truncate">{formatCurrency(product.price)}</p>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-xs text-gray-500 truncate">Stock</p>
                          <p className="text-sm font-medium truncate">{product.stockLevel || 0} units</p>
                        </div>
                        <div className="flex-shrink-0">
                          {expandedProducts.has(product.id) ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Product Details */}
                  {expandedProducts.has(product.id) && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Product Statistics */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-4">Product Statistics</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600 truncate">Total Sales:</span>
                              <span className="text-sm font-medium truncate">{product.totalSales || 0} units</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600 truncate">Total Revenue:</span>
                              <span className="text-sm font-medium truncate">{formatCurrency(product.totalRevenue || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600 truncate">Total COGS:</span>
                              <span className="text-sm font-medium truncate">{formatCurrency(product.totalCOGS || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600 truncate">Gross Profit:</span>
                              <span className="text-sm font-medium text-green-600 truncate">
                                {formatCurrency((product.totalRevenue || 0) - (product.totalCOGS || 0))}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600 truncate">Profit Margin:</span>
                              <span className="text-sm font-medium text-green-600 truncate">
                                {product.totalRevenue > 0 
                                  ? `${(((product.totalRevenue || 0) - (product.totalCOGS || 0)) / product.totalRevenue * 100).toFixed(1)}%`
                                  : '0%'
                                }
                              </span>
                            </div>
                            
                            {/* Record as Expense Button - Only show when stock is "0" (fully sold) */}
                            {product.stockLevel === "0" && product.totalCOGS > 0 && (
                              <div className="mt-4 pt-3 border-t border-gray-200">
                                {recordedExpenses.has(product.id) ? (
                                  // Already recorded - show disabled state
                                  <button
                                    disabled
                                    className="w-full px-3 py-2 bg-gray-400 text-white text-xs font-medium rounded-md cursor-not-allowed flex items-center justify-center"
                                  >
                                    <CreditCard className="w-3 h-3 mr-1" />
                                    Recorded as Expense
                                  </button>
                                ) : (
                                  // Not recorded yet - show active button
                                  <button
                                    onClick={() => handleRecordAsExpense(product)}
                                    className="w-full px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
                                  >
                                    <CreditCard className="w-3 h-3 mr-1" />
                                    Record as Expense
                                  </button>
                                )}
                                <p className="text-xs text-gray-500 mt-1 text-center">
                                  {recordedExpenses.has(product.id) 
                                    ? `Already recorded: ${formatCurrency(product.totalCOGS)}`
                                    : `Create expense for total COGS: ${formatCurrency(product.totalCOGS)}`
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Recent Sales */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-4">Recent Sales</h4>
                          {product.sales && product.sales.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {product.sales.slice(0, 5).map((sale, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                                    <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-600 truncate">
                                      {formatDate(sale.date)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 ml-2">
                                    <div className="text-right min-w-0">
                                      <p className="text-xs font-medium truncate">{sale.quantity} units</p>
                                      <p className="text-xs text-gray-500 truncate">COGS: {formatCurrency(sale.cogs)}</p>
                                    </div>
                                    <div className="text-right min-w-0">
                                      <p className="text-xs font-medium truncate">{formatCurrency(sale.revenue)}</p>
                                      <p className="text-xs text-gray-500 truncate">Revenue</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <ShoppingCart className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">No sales recorded yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default COGSManagement;
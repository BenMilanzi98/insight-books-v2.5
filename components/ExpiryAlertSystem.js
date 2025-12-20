"use client";

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, XCircle, Calendar, Settings, CheckCircle } from 'lucide-react';

const ExpiryAlertSystem = ({ products = [], onViewProduct }) => {
  const [expiredProducts, setExpiredProducts] = useState([]);
  const [expiringProducts, setExpiringProducts] = useState([]);
  const [alertSettings, setAlertSettings] = useState({
    expiringSoonDays: 7, // Days before expiry to show alert
    showExpired: true,
    showExpiringSoon: true
  });

  // Calculate expiry alerts
  useEffect(() => {
    const now = new Date();
    const expiringThreshold = new Date();
    expiringThreshold.setDate(now.getDate() + alertSettings.expiringSoonDays);

    const expired = [];
    const expiring = [];

    products.forEach(product => {
      if (product.isPerishable && product.expiryDate) {
        const expiryDate = new Date(product.expiryDate);
        
        if (expiryDate < now) {
          // Product is expired
          expired.push({
            ...product,
            daysExpired: Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24))
          });
        } else if (expiryDate <= expiringThreshold) {
          // Product is expiring soon
          expiring.push({
            ...product,
            daysUntilExpiry: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
          });
        }
      }
    });

    setExpiredProducts(expired);
    setExpiringProducts(expiring);
  }, [products, alertSettings.expiringSoonDays]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('MWK', 'MWK');
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get alert severity
  const getAlertSeverity = (daysUntilExpiry) => {
    if (daysUntilExpiry <= 1) return 'critical';
    if (daysUntilExpiry <= 3) return 'high';
    if (daysUntilExpiry <= 7) return 'medium';
    return 'low';
  };

  // Get alert styling
  const getAlertStyles = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: 'text-red-600'
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          icon: 'text-orange-600'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-600'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600'
        };
    }
  };

  // Handle settings change
  const handleSettingsChange = (setting, value) => {
    setAlertSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  if (!alertSettings.showExpired && !alertSettings.showExpiringSoon) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Settings Panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-800 flex items-center">
            <Settings size={18} className="mr-2" />
            Expiry Alert Settings
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alert Days Before Expiry
            </label>
            <select
              value={alertSettings.expiringSoonDays}
              onChange={(e) => handleSettingsChange('expiringSoonDays', parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showExpired"
              checked={alertSettings.showExpired}
              onChange={(e) => handleSettingsChange('showExpired', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="showExpired" className="text-sm text-gray-700">
              Show expired products
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showExpiringSoon"
              checked={alertSettings.showExpiringSoon}
              onChange={(e) => handleSettingsChange('showExpiringSoon', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="showExpiringSoon" className="text-sm text-gray-700">
              Show expiring soon products
            </label>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alertSettings.showExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <XCircle size={20} className="text-red-600 mr-2" />
                <span className="text-lg font-semibold text-red-800">
                  {expiredProducts.length} Expired
                </span>
              </div>
              <span className="text-sm text-red-600">
                {expiredProducts.length > 0 ? 'Action Required' : 'All Good'}
              </span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              Products past their expiry date
            </p>
          </div>
        )}

        {alertSettings.showExpiringSoon && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock size={20} className="text-orange-600 mr-2" />
                <span className="text-lg font-semibold text-orange-800">
                  {expiringProducts.length} Expiring Soon
                </span>
              </div>
              <span className="text-sm text-orange-600">
                Next {alertSettings.expiringSoonDays} days
              </span>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              Products expiring within {alertSettings.expiringSoonDays} days
            </p>
          </div>
        )}
      </div>

      {/* Expired Products */}
      {alertSettings.showExpired && expiredProducts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-red-800 flex items-center">
              <XCircle size={18} className="mr-2" />
              Expired Products ({expiredProducts.length})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {expiredProducts.map((product) => {
              const styles = getAlertStyles('critical');
              return (
                <div key={product.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          {product.daysExpired} day{product.daysExpired !== 1 ? 's' : ''} expired
                        </span>
                      </div>
                      
                      <div className="mt-1 text-sm text-gray-600">
                        <span>SKU: {product.sku}</span>
                        <span className="mx-2">•</span>
                        <span>Stock: {product.stockLevel}</span>
                        <span className="mx-2">•</span>
                        <span>Expired: {formatDate(product.expiryDate)}</span>
                        {product.batchNumber && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Batch: {product.batchNumber}</span>
                          </>
                        )}
                      </div>
                      
                      {product.description && (
                        <p className="mt-1 text-sm text-gray-500">{product.description}</p>
                      )}
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(product.price)}
                      </div>
                      <button
                        onClick={() => onViewProduct(product)}
                        className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expiring Soon Products */}
      {alertSettings.showExpiringSoon && expiringProducts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-orange-800 flex items-center">
              <Clock size={18} className="mr-2" />
              Expiring Soon ({expiringProducts.length})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {expiringProducts.map((product) => {
              const severity = getAlertSeverity(product.daysUntilExpiry);
              const styles = getAlertStyles(severity);
              return (
                <div key={product.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          severity === 'critical' ? 'bg-red-100 text-red-800' :
                          severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {product.daysUntilExpiry} day{product.daysUntilExpiry !== 1 ? 's' : ''} left
                        </span>
                      </div>
                      
                      <div className="mt-1 text-sm text-gray-600">
                        <span>SKU: {product.sku}</span>
                        <span className="mx-2">•</span>
                        <span>Stock: {product.stockLevel}</span>
                        <span className="mx-2">•</span>
                        <span>Expires: {formatDate(product.expiryDate)}</span>
                        {product.batchNumber && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Batch: {product.batchNumber}</span>
                          </>
                        )}
                      </div>
                      
                      {product.description && (
                        <p className="mt-1 text-sm text-gray-500">{product.description}</p>
                      )}
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(product.price)}
                      </div>
                      <button
                        onClick={() => onViewProduct(product)}
                        className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Alerts */}
      {((alertSettings.showExpired && expiredProducts.length === 0) || 
        (alertSettings.showExpiringSoon && expiringProducts.length === 0)) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
          <h3 className="text-lg font-medium text-green-800 mb-1">No Expiry Alerts</h3>
          <p className="text-green-700">
            All perishable products are within acceptable expiry dates.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpiryAlertSystem; 
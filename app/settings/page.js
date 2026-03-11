"use client";

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download
} from 'lucide-react';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    // Business Information
    name: '',
    logoUrl: '',
    primaryColor: '#4f46e5',
    secondaryColor: '#7c3aed',
    
    // Business Address for Receipts
    buildingName: '',
    businessAddress: '',
    businessCity: '',
    businessPhone: '',
    businessEmail: '',
    
    // Receipt Customization
    receiptFooter: '',
    
    // Other Settings
    emailFooter: '',
    currencyCode: 'MWK',
    taxEnabled: true,
    defaultTaxRate: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tenant/settings');
      
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSaveStatus(null);
        setSettings({
          name: data.name || '',
          logoUrl: data.logoUrl || '',
          primaryColor: data.primaryColor || '#4f46e5',
          secondaryColor: data.secondaryColor || '#7c3aed',
          buildingName: data.buildingName || '',
          businessAddress: data.businessAddress || '',
          businessCity: data.businessCity || '',
          businessPhone: data.businessPhone || '',
          businessEmail: data.businessEmail || '',
          receiptFooter: data.receiptFooter || '',
          emailFooter: data.emailFooter || '',
          currencyCode: data.currencyCode || 'MWK',
          taxEnabled: data.taxEnabled !== undefined ? data.taxEnabled : true,
          defaultTaxRate: data.defaultTaxRate || 0,
        });
      } else {
        const msg = data?.error || `Failed to load settings (${response.status})`;
        setSaveStatus({ type: 'error', message: msg });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setSaveStatus({ type: 'error', message: error.message || 'Could not load settings. Check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!settings.name.trim()) {
      newErrors.name = 'Business name is required';
    }
    
    if (settings.businessEmail && !isValidEmail(settings.businessEmail)) {
      newErrors.businessEmail = 'Please enter a valid email address';
    }
    
    if (settings.defaultTaxRate < 0 || settings.defaultTaxRate > 100) {
      newErrors.defaultTaxRate = 'Tax rate must be between 0 and 100';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSaving(true);
      setSaveStatus(null);
      
      const response = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      const responseData = await response.json().catch(() => ({}));
      
      if (response.ok) {
        setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        const message = responseData?.error
          || (response.status === 401 ? 'You must be signed in to save settings.'
            : response.status === 403 ? 'You do not have permission to change these settings.'
              : response.status === 404 ? 'Settings could not be found.'
                : `Settings could not be saved (${response.status}). Please try again.`);
        setSaveStatus({ type: 'error', message });
      }
    } catch (error) {
      const message = error.message || 'Network or server error. Check your connection and try again.';
      setSaveStatus({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDataExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus(null);
      const response = await fetch('/api/data-export');
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `insight-data-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      setExportStatus('success');
      setTimeout(() => setExportStatus(null), 4000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setExportStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Settings className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
          </div>
          <p className="text-gray-600">
            Configure your business information, receipt settings, and other preferences.
          </p>
        </div>

        {/* Save Status */}
        {saveStatus && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            saveStatus.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {saveStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            )}
            <span>{saveStatus.type === 'success' ? (saveStatus.message || 'Settings saved successfully!') : (saveStatus.message || 'Failed to save settings. Please try again.')}</span>
          </div>
        )}

        {exportStatus && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            exportStatus === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {exportStatus === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {exportStatus === 'success' 
              ? 'Data export prepared. Check your downloads for the ZIP archive.' 
              : 'Failed to export data. Please try again.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Business Information Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <Building className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Business Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Your Business Name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={settings.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="w-full h-12 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <input
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="w-full h-12 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Receipt Address Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <MapPin className="w-6 h-6 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Receipt Business Address</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This information will appear on your receipts and invoices.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Building/Location Name
                </label>
                <input
                  type="text"
                  value={settings.buildingName}
                  onChange={(e) => handleChange('buildingName', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Main Office, Downtown Branch"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={settings.businessAddress}
                  onChange={(e) => handleChange('businessAddress', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Main Street"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City/Town
                </label>
                <input
                  type="text"
                  value={settings.businessCity}
                  onChange={(e) => handleChange('businessCity', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Lilongwe, Malawi"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Numbers
                </label>
                <input
                  type="tel"
                  value={settings.businessPhone}
                  onChange={(e) => handleChange('businessPhone', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+265 888 123 456"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={settings.businessEmail}
                  onChange={(e) => handleChange('businessEmail', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.businessEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="info@yourbusiness.com"
                />
                {errors.businessEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.businessEmail}</p>
                )}
              </div>
            </div>
          </div>

          {/* Receipt Customization Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <FileText className="w-6 h-6 text-purple-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Receipt Customization</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Customize the footer message that appears on your receipts.
            </p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Footer Message
              </label>
              <textarea
                value={settings.receiptFooter}
                onChange={(e) => handleChange('receiptFooter', e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Thank you for your business! We appreciate your support."
              />
              <p className="mt-1 text-xs text-gray-500">
                This message will appear at the bottom of all receipts. Leave empty to use the default message.
              </p>
            </div>
          </div>

          {/* Other Settings Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <Settings className="w-6 h-6 text-gray-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Other Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency Code
                </label>
                <select
                  value={settings.currencyCode}
                  onChange={(e) => handleChange('currencyCode', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MWK">MWK - Malawian Kwacha</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="ZAR">ZAR - South African Rand</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={settings.defaultTaxRate}
                  onChange={(e) => handleChange('defaultTaxRate', parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.01"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.defaultTaxRate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.defaultTaxRate && (
                  <p className="mt-1 text-sm text-red-600">{errors.defaultTaxRate}</p>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Footer
                </label>
                <textarea
                  value={settings.emailFooter}
                  onChange={(e) => handleChange('emailFooter', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Custom footer for email communications..."
                />
              </div>
            </div>
          </div>

          {/* Data Export Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Download className="w-6 h-6 text-indigo-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Data Export</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Download a ZIP archive containing CSV files for your key modules (clients, products, inventory, sales, invoices, liabilities, assets, expenses, payments, and accounting). Purchase module data is excluded.
            </p>
            <button
              type="button"
              onClick={handleDataExport}
              disabled={isExporting}
              className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-white ${isExporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Preparing export...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Data (ZIP)
                </>
              )}
            </button>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage; 
"use client";
import { tt } from '@/lib/i18n/runtime';

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
  Download,
  Hash
} from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import LanguageSettingsCard from '@/components/i18n/LanguageSettingsCard';
import { useI18n } from '@/components/i18n/I18nProvider';


const DOC_SEQ_TYPES = ['PO', 'GR', 'INV', 'QUO'];
const DOC_SEQ_LABELS = {
  PO: 'Purchase orders',
  GR: 'Goods receipts',
  INV: 'Invoices',
  QUO: 'Quotations',
};

const SettingsPage = () => {
  const { t } = useI18n();
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
    receiptPaperWidthMm: 80,
    
    // Other Settings
    emailFooter: '',
    currencyCode: 'MWK',
    taxEnabled: true,
    defaultTaxRate: 17.5,
    fiscalYearStartMonth: 1,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [docSeqRows, setDocSeqRows] = useState([]);
  const [docSeqLoadErr, setDocSeqLoadErr] = useState(null);
  const [docSeqSelected, setDocSeqSelected] = useState({
    PO: true,
    GR: true,
    INV: true,
    QUO: true,
  });
  const [docSeqResetting, setDocSeqResetting] = useState(false);
  const [docSeqMsg, setDocSeqMsg] = useState(null);

  const loadDocSequences = async () => {
    try {
      const res = await fetch('/api/tenant/document-sequences');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to load (${res.status})`);
      setDocSeqRows(data.sequences || []);
      setDocSeqLoadErr(null);
    } catch (e) {
      setDocSeqLoadErr(e.message || 'Could not load document counters.');
    }
  };

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
    loadDocSequences();
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
          receiptPaperWidthMm: data.receiptPaperWidthMm ?? 80,
          emailFooter: data.emailFooter || '',
          currencyCode: data.currencyCode || 'MWK',
          taxEnabled: data.taxEnabled !== undefined ? data.taxEnabled : true,
          defaultTaxRate: data.defaultTaxRate || 0,
          fiscalYearStartMonth: Number(data.fiscalYearStartMonth) || 1,
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

  const handleResetDocSequences = async () => {
    const types = DOC_SEQ_TYPES.filter((t) => docSeqSelected[t]);
    if (types.length === 0) {
      setDocSeqMsg({ type: 'error', text: 'Select at least one document type.' });
      return;
    }
    const labelList = types.map((t) => DOC_SEQ_LABELS[t]).join(', ');
    if (
      !window.confirm(
        `Reset document number counters for: ${labelList}?\n\nThe next new document of each selected type will use sequence 00001. If those numbers already exist, you may get conflicts until you adjust or delete old records.`
      )
    ) {
      return;
    }
    try {
      setDocSeqResetting(true);
      setDocSeqMsg(null);
      const res = await fetch('/api/tenant/document-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types, lastIssued: 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Reset failed (${res.status})`);
      }
      setDocSeqMsg({ type: 'success', text: data.message || 'Counters updated.' });
      await loadDocSequences();
    } catch (e) {
      setDocSeqMsg({ type: 'error', text: e.message || 'Reset failed.' });
    } finally {
      setDocSeqResetting(false);
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
      <div className="flex w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">{tt('Loading settings...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-secondary)]">
      <div className="mx-auto max-w-4xl py-8">
        <PageHeader
          title={t('settings.title')}
          description={t('settings.languageHelp')}
          breadcrumb={
            <span className="inline-flex items-center gap-2">
              <Settings className="h-4 w-4 text-[var(--action-primary)]" aria-hidden="true" />
              {t('navigation.settings')}
            </span>
          }
        />

        <div className="mb-6">
          <LanguageSettingsCard />
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
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center mb-6">
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Building className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{tt('Business Information')}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Business Name *')}
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={tt('Your Business Name')}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Logo URL')}
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
                  Invoice &amp; brand colour
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
                  {tt('Secondary Color')}
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
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center mb-6">
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <MapPin className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{tt('Receipt Business Address')}</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {tt('This information will appear on your receipts and invoices.')}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Building/Location Name')}
                </label>
                <input
                  type="text"
                  value={settings.buildingName}
                  onChange={(e) => handleChange('buildingName', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={tt('e.g., Main Office, Downtown Branch')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Street Address')}
                </label>
                <input
                  type="text"
                  value={settings.businessAddress}
                  onChange={(e) => handleChange('businessAddress', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={tt('123 Main Street')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('City/Town')}
                </label>
                <input
                  type="text"
                  value={settings.businessCity}
                  onChange={(e) => handleChange('businessCity', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={tt('Lilongwe, Malawi')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Contact Numbers')}
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
                  {tt('Email Address')}
                </label>
                <input
                  type="email"
                  value={settings.businessEmail}
                  onChange={(e) => handleChange('businessEmail', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.businessEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={tt('info@yourbusiness.com')}
                />
                {errors.businessEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.businessEmail}</p>
                )}
              </div>
            </div>
          </div>

          {/* Receipt Customization Section */}
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center mb-6">
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{tt('Receipt Customization')}</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {tt('Customize receipt footer text and preferred thermal paper width for POS printing.')}
            </p>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Thermal paper width')}
                </label>
                <select
                  value={settings.receiptPaperWidthMm ?? 80}
                  onChange={(e) =>
                    handleChange('receiptPaperWidthMm', Number(e.target.value))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {[58, 70, 72, 76, 80, 88, 90].map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} mm{mm === 80 ? ' (most common)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Default size for POS thermal printing (58–90 mm). You can still change it when printing.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Receipt Footer Message')}
                </label>
                <textarea
                  value={settings.receiptFooter}
                  onChange={(e) => handleChange('receiptFooter', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={tt('Thank you for your business! We appreciate your support.')}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {tt('This message will appear at the bottom of all receipts. Leave empty to use the default message.')}
                </p>
              </div>
            </div>
          </div>

          {/* Other Settings Section */}
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center mb-6">
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Settings className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{tt('Other Settings')}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Currency Code')}
                </label>
                <select
                  value={settings.currencyCode}
                  onChange={(e) => handleChange('currencyCode', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MWK">{tt('MWK - Malawian Kwacha')}</option>
                  <option value="USD">{tt('USD - US Dollar')}</option>
                  <option value="EUR">{tt('EUR - Euro')}</option>
                  <option value="GBP">{tt('GBP - British Pound')}</option>
                  <option value="ZAR">{tt('ZAR - South African Rand')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Financial year starts')}
                </label>
                <select
                  value={settings.fiscalYearStartMonth || 1}
                  onChange={(e) => handleChange('fiscalYearStartMonth', parseInt(e.target.value, 10))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>January (calendar year)</option>
                  <option value={2}>{tt('February')}</option>
                  <option value={3}>{tt('March')}</option>
                  <option value={4}>{tt('April')}</option>
                  <option value={5}>{tt('May')}</option>
                  <option value={6}>{tt('June')}</option>
                  <option value={7}>{tt('July')}</option>
                  <option value={8}>{tt('August')}</option>
                  <option value={9}>{tt('September')}</option>
                  <option value={10}>{tt('October')}</option>
                  <option value={11}>{tt('November')}</option>
                  <option value={12}>{tt('December')}</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {tt('Default is January–December. Change this if your business uses a different financial year. Existing years are not rewritten automatically.')}
                </p>
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
                  {tt('Email Footer')}
                </label>
                <textarea
                  value={settings.emailFooter}
                  onChange={(e) => handleChange('emailFooter', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={tt('Custom footer for email communications...')}
                />
              </div>
            </div>
          </div>

          {/* Data Export Section */}
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center mb-4">
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Download className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{tt('Data Export')}</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Download a ZIP archive containing CSV files for your key modules (clients, products, inventory, sales, invoices, liabilities, assets, expenses, payments, and accounting). Purchase module data is excluded.
            </p>
            <button
              type="button"
              onClick={handleDataExport}
              disabled={isExporting}
              className={`inline-flex items-center rounded-2xl px-4 py-2 font-medium text-white transition-all ${
                isExporting
                  ? 'cursor-not-allowed bg-gray-400'
                  : 'bg-gradient-to-r from-blue-600 to-sky-600 shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-sky-700'
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {tt('Preparing export...')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Data (ZIP)
                </>
              )}
            </button>
          </div>

          {/* Document number counters */}
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center mb-4">
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Hash className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{tt('Document numbers')}</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Purchase orders, goods receipts, invoices, and quotations each use a sequential number for this business only. Use reset only if you understand duplicate risks with existing documents.
            </p>
            {docSeqLoadErr && (
              <p className="text-sm text-red-600 mb-3">{docSeqLoadErr}</p>
            )}
            {docSeqMsg && (
              <p
                className={`text-sm mb-3 ${docSeqMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
              >
                {docSeqMsg.text}
              </p>
            )}
            <ul className="text-sm text-gray-700 space-y-1 mb-4">
              {DOC_SEQ_TYPES.map((t) => {
                const row = docSeqRows.find((r) => r.documentType === t);
                return (
                  <li key={t}>
                    <span className="font-medium">{DOC_SEQ_LABELS[t]}:</span>{' '}
                    {row != null
                      ? `last issued suffix ${row.lastIssued}`
                      : 'no counter row yet (next follows highest existing document or starts at 1)'}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              Reset sets the internal counter so the next document uses 00001. Existing PDFs and records keep their old numbers; avoid reset if you already have PO-00001-style numbers you must keep unique.
            </p>
            <div className="flex flex-wrap gap-4 mb-4">
              {DOC_SEQ_TYPES.map((t) => (
                <label key={t} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={docSeqSelected[t]}
                    onChange={(e) =>
                      setDocSeqSelected((prev) => ({ ...prev, [t]: e.target.checked }))
                    }
                  />
                  {DOC_SEQ_LABELS[t]}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleResetDocSequences}
              disabled={docSeqResetting}
              className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-white ${
                docSeqResetting ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {docSeqResetting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {tt('Resetting…')}
                </>
              ) : (
                'Reset selected counters (next = 00001)'
              )}
            </button>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-3 font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {tt('Saving...')}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  {tt('Save Settings')}
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
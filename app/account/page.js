"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  User, 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Settings, 
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Bell,
  Shield,
  Image,
  FileImage,
  Landmark
} from "lucide-react";

const VALID_TABS = ["business", "receipt", "account", "notifications", "legal"];

function AccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [settings, setSettings] = useState({
    // Account Information
    name: "",
    subdomain: "",
    subscriptionPlan: "",
    
    // Business Information
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "#4f46e5",
    secondaryColor: "#7c3aed",
    
    // MRA EIS
    tpin: "",

    // Default branch is managed internally per business — not user-configurable.

    // Business Address for Receipts
    buildingName: "",
    businessAddress: "",
    businessCity: "",
    businessPhone: "",
    businessEmail: "",
    
    // Receipt Customization
    receiptFooter: "",
    
    // Banking Details (from customization) - single string as on /customization?tab=business
    defaultBankDetails: "",
    
    // Default tax accounts (inflow = collected from sales/invoices; outflow = paid on expenses/purchases)
    taxInflowAccountId: "",
    taxOutflowAccountId: "",
    
    // Other Settings
    emailFooter: "",
    currencyCode: "MWK",
    taxEnabled: true,
    defaultTaxRate: 16.5,
    customDomain: "",
    
    // Notifications
    emailNotifications: true,
    smsNotifications: false,
    inAppNotifications: true
  });

  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("business");
  // For tax outflow account selection
  const [taxOutflowAccountOptions, setTaxOutflowAccountOptions] = useState([]);

  // Keep activeTab in sync with URL (e.g. /account?tab=business)
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && VALID_TABS.includes(t)) setActiveTab(t);
  }, [searchParams]);

  useEffect(() => {
    loadSettings();
    loadTaxAccountOptions();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      // Load account settings
      const accountResponse = await fetch('/api/account');
      const accountData = accountResponse.ok ? await accountResponse.json() : {};
      
      console.log('🔍 LoadSettings - Account API response:', accountData);
      
      // Load tenant settings
      const tenantResponse = await fetch('/api/tenant/settings');
      const tenantData = tenantResponse.ok ? await tenantResponse.json() : {};

      let taxDefaults = {};
      try {
        const tdRes = await fetch('/api/settings/tax-defaults');
        if (tdRes.ok) taxDefaults = await tdRes.json();
      } catch (_) {
        /* non-fatal */
      }

      console.log('🔍 LoadSettings - Tenant Settings API response:', tenantData);
      
      // Clean up blob URLs - they won't work across the system
      const cleanLogoUrl = (url) => {
        if (!url) return "";
        if (url.startsWith('blob:') || url.includes('localhost:3000')) {
          return ""; // Clear blob URLs
        }
        return url;
      };
      
      // Prioritize accountData.logoUrl over tenantData.logoUrl
      const finalLogoUrl = cleanLogoUrl(accountData.logoUrl || tenantData.logoUrl);
      console.log('🔍 LoadSettings - Final logo URL:', finalLogoUrl);
      console.log('🔍 LoadSettings - Account logo URL:', accountData.logoUrl);
      console.log('🔍 LoadSettings - Tenant logo URL:', tenantData.logoUrl);
      
      setSettings({
        name: accountData.name || tenantData.name || "",
        subdomain: accountData.subdomain || "",
        subscriptionPlan: accountData.subscriptionPlan || "",
        logoUrl: finalLogoUrl,
        faviconUrl: cleanLogoUrl(accountData.faviconUrl),
        primaryColor: accountData.primaryColor || tenantData.primaryColor || "#4f46e5",
        secondaryColor: accountData.secondaryColor || tenantData.secondaryColor || "#7c3aed",
        tpin: accountData.tpin || tenantData.tpin || "",
        buildingName: tenantData.buildingName || "",
        businessAddress: tenantData.businessAddress || "",
        businessCity: tenantData.businessCity || "",
        businessPhone: tenantData.businessPhone || "",
        businessEmail: tenantData.businessEmail || "",
        receiptFooter: tenantData.receiptFooter || "",
        // NEW: Load banking details and tax outflow account (string, like customization)
        defaultBankDetails: (typeof tenantData.defaultBankDetails === 'string')
          ? tenantData.defaultBankDetails
          : (tenantData.defaultBankDetails && typeof tenantData.defaultBankDetails === 'object')
            ? [tenantData.defaultBankDetails.bankName && `Bank: ${tenantData.defaultBankDetails.bankName}`, tenantData.defaultBankDetails.accountNumber && `Account number: ${tenantData.defaultBankDetails.accountNumber}`, tenantData.defaultBankDetails.accountName && `Account name: ${tenantData.defaultBankDetails.accountName}`].filter(Boolean).join('\n')
            : "",
        taxInflowAccountId:
          tenantData.taxInflowAccountId || taxDefaults.taxInflowAccountId || "",
        taxOutflowAccountId:
          tenantData.taxOutflowAccountId || taxDefaults.taxOutflowAccountId || "",
        emailFooter: accountData.emailFooter || tenantData.emailFooter || "",
        currencyCode: tenantData.currencyCode || "MWK",
        taxEnabled: tenantData.taxEnabled !== undefined ? tenantData.taxEnabled : true,
        defaultTaxRate: tenantData.defaultTaxRate || 16.5,
        customDomain: accountData.customDomain || "",
        emailNotifications: accountData.emailNotifications !== undefined ? accountData.emailNotifications : true,
        smsNotifications: accountData.smsNotifications || false,
        inAppNotifications: accountData.inAppNotifications !== undefined ? accountData.inAppNotifications : true
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };

  // Load chart-of-accounts for default tax inflow/outflow dropdowns
  const loadTaxAccountOptions = async () => {
    try {
      const accRes = await fetch('/api/chart-of-accounts?limit=500');
      if (accRes.ok) {
        const accData = await accRes.json();
        setTaxOutflowAccountOptions(accData.accounts || []);
      }
    } catch (_) {
      setTaxOutflowAccountOptions([]);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };


  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      console.log(`📁 File selected for ${type}:`, file.name, file.size, file.type);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setSaveStatus({ type: 'error', message: 'Please select an image file (JPEG, PNG, GIF, etc.)' });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setSaveStatus({ type: 'error', message: 'File size must be less than 5MB' });
        return;
      }
      
      if (type === "logo") {
        setLogoFile(file);
        console.log('📁 Logo file set in state:', file.name);
        console.log('📁 Current logoFile state after set:', file);
      } else if (type === "favicon") {
        setFaviconFile(file);
        console.log('📁 Favicon file set in state:', file.name);
      }
      
      // Clear any previous error messages
      setSaveStatus(null);
    } else {
      console.log(`📁 No file selected for ${type}`);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!settings.name.trim()) {
      newErrors.name = 'Business name is required';
    }

    if (settings.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.businessEmail)) {
      newErrors.businessEmail = 'Please enter a valid email address';
    }

    if (settings.defaultTaxRate < 0 || settings.defaultTaxRate > 100) {
      newErrors.defaultTaxRate = 'Tax rate must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setSaveStatus({ type: 'error', message: 'Please fix the errors above' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      console.log('Starting file upload process...');
      
      // Save account settings
      const accountFormData = new FormData();
      accountFormData.append("name", settings.name || "");
      accountFormData.append("primaryColor", settings.primaryColor || "");
      accountFormData.append("secondaryColor", settings.secondaryColor || "");
      accountFormData.append("emailFooter", settings.emailFooter || "");
      accountFormData.append("customDomain", settings.customDomain || "");
      accountFormData.append("emailNotifications", settings.emailNotifications);
      accountFormData.append("smsNotifications", settings.smsNotifications);
      accountFormData.append("inAppNotifications", settings.inAppNotifications);
      
      if (logoFile) {
        console.log('📁 Adding logo file to form data:', logoFile.name);
        console.log('📁 Logo file details:', { name: logoFile.name, size: logoFile.size, type: logoFile.type });
        accountFormData.append("logoUrl", logoFile);
      } else {
        console.log('📁 No logo file to add to form data');
      }
      if (faviconFile) {
        console.log('📁 Adding favicon file to form data:', faviconFile.name);
        accountFormData.append("faviconUrl", faviconFile);
      } else {
        console.log('📁 No favicon file to add to form data');
      }

      console.log('Sending account settings to server...');
      const accountResponse = await fetch("/api/account", {
        method: "POST",
        body: accountFormData
      });

      const accountErrorData = await accountResponse.json().catch(() => ({}));
      if (!accountResponse.ok) {
        const msg = accountErrorData?.error
          || (accountResponse.status === 401 ? 'You must be signed in to save account settings.'
            : `Account settings could not be saved (${accountResponse.status}). Please try again.`);
        throw new Error(msg);
      }

      console.log('Account settings saved successfully');

      // Save tenant settings
      const tenantResponse = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: settings.name,
          tpin: settings.tpin || null,
          // Remove logoUrl - it's already handled by the POST request above
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          buildingName: settings.buildingName,
          businessAddress: settings.businessAddress,
          businessCity: settings.businessCity,
          businessPhone: settings.businessPhone,
          businessEmail: settings.businessEmail,
          receiptFooter: settings.receiptFooter,
          // Default bank details (tax accounts 2041/2045 are fixed and not editable)
          defaultBankDetails: settings.defaultBankDetails,
          emailFooter: settings.emailFooter,
          currencyCode: settings.currencyCode,
          taxEnabled: settings.taxEnabled,
          defaultTaxRate: settings.defaultTaxRate,
        }),
      });

      const tenantErrorData = await tenantResponse.json().catch(() => ({}));
      if (!tenantResponse.ok) {
        const msg = tenantErrorData?.error
          || (tenantResponse.status === 401 ? 'You must be signed in to save tenant settings.'
            : `Tenant settings could not be saved (${tenantResponse.status}). Please try again.`);
        throw new Error(msg);
      }

      console.log('Tenant settings saved successfully');

      // If files were uploaded, reload settings to get the new URLs
      if (logoFile || faviconFile) {
        console.log('🔄 Reloading settings to get new file URLs...');
        console.log('🔄 Before reload - logoFile:', logoFile?.name);
        console.log('🔄 Before reload - faviconFile:', faviconFile?.name);
        
        // Add a small delay to ensure database transaction is committed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await loadSettings();
        console.log('🔄 After reload - settings.logoUrl:', settings.logoUrl);
        
        // If logo URL is still empty, try the direct fix
        if (!settings.logoUrl && logoFile) {
          console.log('🔄 Logo URL still empty, trying direct fix...');
          try {
            const directFixResponse = await fetch('/api/direct-fix-logo', { method: 'POST' });
            if (directFixResponse.ok) {
              console.log('🔄 Direct fix successful, reloading settings again...');
              await loadSettings();
            }
          } catch (error) {
            console.error('🔄 Direct fix failed:', error);
          }
        }
      }

      setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });
      setLogoFile(null);
      setFaviconFile(null);
      
      console.log('All settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      const message = error.message || 'Network or server error. Check your connection and try again.';
      setSaveStatus({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: "business", label: "Business Info", icon: Building },
    { id: "receipt", label: "Receipt Settings", icon: FileText },
    { id: "account", label: "Account", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "legal", label: "Legal", icon: Shield }
  ];

  // Normalize logo URL to avoid broken relative paths on server
  // Use API route for serving uploads in production (works with nginx)
  const normalizedLogoUrl = settings.logoUrl
    ? (() => {
        let url = settings.logoUrl;
        
        // If it's already a full URL, use it
        if (url.startsWith('http')) {
          return url;
        }
        
        // Remove leading slash if present
        url = url.replace(/^\/+/, '');
        
        // If it starts with 'uploads/', convert to API route
        if (url.startsWith('uploads/')) {
          // Remove 'uploads/' prefix and use API route
          const pathWithoutUploads = url.replace(/^uploads\//, '');
          return `/api/uploads/${pathWithoutUploads}`;
        }
        
        // If it doesn't start with uploads, assume it's a relative path
        return `/api/uploads/${url}`;
      })()
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header - always visible */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your business information, receipt settings, and account preferences.</p>
        </div>

        {/* Status Messages */}
        {saveStatus && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            saveStatus.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {saveStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-3" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-3" />
            )}
            {saveStatus.message}
          </div>
        )}

        {/* Tab Navigation - always visible so users can see and switch tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/80" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(tab.id);
                    router.replace(`/account?tab=${tab.id}`, { scroll: false });
                  }}
                  className={`flex items-center px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-w-0 ${
                    isActive
                      ? 'border-blue-500 text-blue-700 bg-white shadow-sm -mb-px'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 flex items-center justify-center min-h-[320px]">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading account settings...</p>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          {/* Business Information Tab */}
          {activeTab === "business" && (
            <div className="space-y-6">
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
                      Subdomain
                    </label>
                    <input
                      type="text"
                      value={settings.subdomain}
                      disabled
                      className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      placeholder="your-business"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Logo
                    </label>
                    <div className="flex items-center gap-4 border border-gray-300 rounded-lg p-3">
                      <div className="flex-shrink-0">
                        {logoFile ? (
                          // Show preview of selected file
                          <img
                            src={URL.createObjectURL(logoFile)}
                            alt="Logo Preview"
                            className="max-h-32 max-w-48 h-auto w-auto object-contain rounded border p-2 bg-white"
                            style={{ maxHeight: '128px', maxWidth: '192px' }}
                            onError={(e) => {
                              console.error('Error loading logo preview:', e);
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : settings.logoUrl ? (
                          // Show actual uploaded logo
                          <img
                            src={normalizedLogoUrl}
                            alt="Logo"
                            className="max-h-32 max-w-48 h-auto w-auto object-contain rounded border p-2 bg-white"
                            style={{ maxHeight: '128px', maxWidth: '192px' }}
                            onError={(e) => {
                              console.error('Error loading logo:', e);
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        {(!logoFile && !settings.logoUrl) && (
                          <div className="h-32 w-48 flex items-center justify-center bg-gray-100 text-gray-400 rounded border">
                            <Image className="w-12 h-12" />
                          </div>
                        )}
                        {(logoFile || settings.logoUrl) && (
                          <div className="h-32 w-48 flex items-center justify-center bg-gray-100 text-gray-400 rounded border" style={{ display: 'none' }}>
                            <Image className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, "logo")}
                          className="block w-full text-sm text-gray-500
                                     file:mr-4 file:py-2 file:px-4
                                     file:rounded file:border-0
                                     file:text-sm file:font-semibold
                                     file:bg-blue-50 file:text-blue-700
                                     hover:file:bg-blue-100"
                        />
                        {logoFile && (
                          <p className="mt-1 text-xs text-blue-600">
                            New logo selected: {logoFile.name}. Click "Save Settings" to upload.
                          </p>
                        )}
                        {settings.logoUrl && !logoFile && (
                          <p className="mt-1 text-xs text-gray-500">
                            Current logo: {settings.logoUrl.split('/').pop()}
                          </p>
                        )}
                      </div>
                    </div>
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

              {/* Business Address Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <MapPin className="w-6 h-6 text-green-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Business Address</h2>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Taxpayer Identification Number (TPIN)
                    </label>
                    <input
                      type="text"
                      value={settings.tpin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        handleChange('tpin', val);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="12345678"
                      maxLength={8}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      8-digit TPIN from Malawi Revenue Authority (required for MRA EIS integration)
                    </p>
                  </div>
                </div>
              </div>

              {/* Banking & tax - exactly as /customization?tab=business */}
              <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Banking & tax</h3>
                      <p className="text-xs text-gray-500">Default bank details and default tax accounts (inflow & outflow). These defaults are used in Tax types, Tax accounts, and for tracking tax on invoices, expenses and purchases.</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="defaultBankDetails" className="block text-sm font-medium text-gray-700 mb-1.5">Default bank account details</label>
                      <p className="text-xs text-gray-500 mb-2">Shown in invoice, quotation and receipt footers. Override per document when needed.</p>
                      <textarea
                        id="defaultBankDetails"
                        name="defaultBankDetails"
                        rows={5}
                        placeholder={`Bank: Standard Bank\nAccount name: Your Company Ltd\nAccount number: 1234567890\nBranch: Blantyre`}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y min-h-[120px]"
                        value={settings.defaultBankDetails || ""}
                        onChange={(e) => handleChange('defaultBankDetails', e.target.value)}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-3">Default tax accounts (fixed)</h4>
                      <p className="text-xs text-gray-500 mb-4">Tax is always recorded to these system accounts. They cannot be changed by tenants.</p>
                      <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax inflow (collected)</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">2041 – Tax Inflow (Collected)</p>
                          <p className="text-xs text-gray-500 mt-0.5">Tax from sales, invoices and POS</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax outflow (paid)</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">2045 – Tax Outflow (Paid)</p>
                          <p className="text-xs text-gray-500 mt-0.5">Tax on expenses and supplier bills</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Receipt Settings Tab */}
          {activeTab === "receipt" && (
            <div className="space-y-6">
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

              {/* Business Settings Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <Settings className="w-6 h-6 text-gray-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Business Settings</h2>
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
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <User className="w-6 h-6 text-blue-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subscription Plan
                    </label>
                    <input
                      type="text"
                      value={settings.subscriptionPlan}
                      disabled
                      className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      placeholder="Free Plan"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Domain
                    </label>
                    <input
                      type="text"
                      value={settings.customDomain}
                      onChange={(e) => handleChange('customDomain', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="yourbusiness.com"
                    />
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
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <Bell className="w-6 h-6 text-orange-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  Choose how you want to receive notifications about your business.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <Mail className="w-5 h-5 text-blue-600 mr-3" />
                      <div>
                        <h3 className="font-medium text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-600">Receive important updates via email</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.emailNotifications}
                        onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <Phone className="w-5 h-5 text-green-600 mr-3" />
                      <div>
                        <h3 className="font-medium text-gray-900">SMS Notifications</h3>
                        <p className="text-sm text-gray-600">Receive urgent alerts via SMS</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.smsNotifications}
                        onChange={(e) => handleChange('smsNotifications', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <Bell className="w-5 h-5 text-purple-600 mr-3" />
                      <div>
                        <h3 className="font-medium text-gray-900">In-App Notifications</h3>
                        <p className="text-sm text-gray-600">Receive notifications within the application</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.inAppNotifications}
                        onChange={(e) => handleChange('inAppNotifications', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legal Tab */}
          {activeTab === "legal" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-gray-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Legal Information</h2>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  Important legal documents and policies for your business.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link 
                    href="/terms" 
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-blue-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">Terms of Service</h3>
                      <p className="text-sm text-gray-600">Read our terms and conditions</p>
                    </div>
                  </Link>
                  
                  <Link 
                    href="/privacy" 
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Shield className="w-5 h-5 text-green-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">Privacy Policy</h3>
                      <p className="text-sm text-gray-600">Learn about data protection</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Save Button - Only show for non-legal tabs */}
          {activeTab !== "legal" && (
            <div className="flex justify-end pt-6">
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
          )}
        </form>
        )}
      </div>
    </div>
  );
}

export default function Account() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading account...</p>
        </div>
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}

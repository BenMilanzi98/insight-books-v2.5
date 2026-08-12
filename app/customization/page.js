"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Paintbrush, 
  Bell, 
  FileText, 
  Settings, 
  Copy, 
  Check, 
  Upload, 
  AlertCircle,
  Info,
  Save,
  Plus,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  Edit,
  X,
  Download,
  ExternalLink,
  Trash2,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Building2,
  MapPin,
  Phone,
  Mail,
  Landmark,
  Receipt
} from "lucide-react";
import InvoiceTemplatePreview from '@/components/InvoiceTemplatePreview';
import { validateBrandingSettings, validateFileUpload, logoValidationOptions, faviconValidationOptions } from '@/lib/validation';
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

// Toast component
const Toast = ({ toast, closeToast }) => {
  if (!toast.show) return null;
  
  return (
    <div 
      className={`fixed top-6 right-6 p-4 rounded shadow-lg z-50 flex items-center animate-fadeIn max-w-md
        ${toast.type === 'success' ? 'bg-green-100 border-l-4 border-green-500 text-green-700' : 
          toast.type === 'error' ? 'bg-red-100 border-l-4 border-red-500 text-red-700' : 
          toast.type === 'warning' ? 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700' : 
          'bg-blue-100 border-l-4 border-blue-500 text-blue-700'}`}
    >
      {toast.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" /> : 
       toast.type === 'error' ? <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" /> : 
       toast.type === 'warning' ? <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" /> : 
       <Info className="w-5 h-5 mr-2 flex-shrink-0" />}
      <div className="mr-2 flex-grow">
        <p className="font-medium">{toast.message}</p>
        {toast.detail && <p className="text-sm">{toast.detail}</p>}
      </div>
      <button 
        className="text-current hover:opacity-75 flex-shrink-0"
        onClick={closeToast}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Default settings values
const defaultBrandSettings = {
  companyName: "",
  primaryColor: "#4f46e5",
  secondaryColor: "#10b981",
  logoUrl: null,
  faviconUrl: null,
  subdomain: "",
  customDomain: "",
  emailFooter: "",
};

const defaultNotificationSettings = {
  emailNotifications: true,
  smsNotifications: false,
  inAppNotifications: true,
  dailyReports: false,
  weeklyReports: true,
  monthlyReports: true,
  invoiceReminders: true,
  lowStockAlerts: true,
  paymentReceipts: true,
};

// Default business settings for receipts
const defaultBusinessSettings = {
  businessAddress: "",
  businessCity: "",
  businessPhone: "",
  businessEmail: "",
  buildingName: "",
  receiptFooter: "Thank you for your business!",
  receiptPaperWidthMm: 80,
  defaultBankDetails: "", // Shown in invoice, quotation and receipt footers
  taxOutflowAccountId: "", // Account where tax from expenses/supplier bills accumulates (for offset vs collected tax)
};

function CustomizationContent() {
  // Toast state
  const [toast, setToast] = useState({
    show: false,
    type: "success",
    message: "",
    detail: "",
    duration: 3000
  });
  
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "";
  const [activeTab, setActiveTab] = useState("branding");
  useEffect(() => {
    if (tabFromUrl === "business" || tabFromUrl === "invoices" || tabFromUrl === "notifications") {
      setActiveTab((prev) => (prev === tabFromUrl ? prev : tabFromUrl));
    }
  }, [tabFromUrl]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState({});
  
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);
  
  // Preview images
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  
  // Actual file objects for upload
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  
  // State for settings
  const [brandSettings, setBrandSettings] = useState(defaultBrandSettings);
  const [notificationSettings, setNotificationSettings] = useState(defaultNotificationSettings);
  const [businessSettings, setBusinessSettings] = useState(defaultBusinessSettings);
  const [invoiceTemplates, setInvoiceTemplates] = useState([]);
  const [taxOutflowAccountOptions, setTaxOutflowAccountOptions] = useState([]);
  const [originalSettings, setOriginalSettings] = useState({
    brand: defaultBrandSettings,
    notifications: defaultNotificationSettings,
    business: defaultBusinessSettings,
    templates: []
  });
  
  // Track template being edited/previewed
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [canUpdateSettings,setCanUpdateSettings] = useState(false)

  useEffect(() => { 
    const fetchPermissions = async () => {
      const canupdateSettings = await getPermission("system.update");   
      setCanUpdateSettings(canupdateSettings); 
    }
    fetchPermissions();
  }, []);
  // Toast functions
  const showToast = useCallback((type, message, detail = null, duration = 3000) => {
    setToast({
      show: true,
      type,
      message,
      detail,
      duration
    });
    
    if (duration !== Infinity) {
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, duration);
    }
  }, []);
  
  const closeToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);
  
  // Load settings on component mount
  useEffect(() => {
    loadAllSettings();
  }, []);
  
  // Check for changes — only call setHasChanges when the computed value actually changes to avoid update loops
  const hasChangesRef = useRef(false);
  useEffect(() => {
    const brandChanged = JSON.stringify(brandSettings) !== JSON.stringify(originalSettings.brand);
    const notificationsChanged = JSON.stringify(notificationSettings) !== JSON.stringify(originalSettings.notifications);
    const businessChanged = JSON.stringify(businessSettings) !== JSON.stringify(originalSettings.business);
    const templatesChanged = JSON.stringify(invoiceTemplates) !== JSON.stringify(originalSettings.templates);
    const next = !!(brandChanged || notificationsChanged || businessChanged || templatesChanged || logoFile || faviconFile);
    if (hasChangesRef.current !== next) {
      hasChangesRef.current = next;
      setHasChanges(next);
    }
  }, [brandSettings, notificationSettings, businessSettings, invoiceTemplates, logoFile, faviconFile, originalSettings]);
  
  // API service for settings
  const fetchTenantSettings = async () => {
    try {
      const response = await fetch('/api/tenant/settings');
      if (!response.ok) throw new Error('Failed to fetch tenant settings');
      return await response.json();
    } catch (error) {
      console.error('Error fetching tenant settings:', error);
      throw error;
    }
  };

  const saveTenantSettings = async (settings) => {
    const response = await fetch('/api/tenant/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || `Failed to save tenant settings (${response.status})`;
      throw new Error(msg);
    }
    return data;
  };

  const uploadFile = async (file, type) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type); // 'logo' or 'favicon'

      const response = await fetch('/api/tenant/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to upload file');
      return await response.json();
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      throw error;
    }
  };

  // Get invoice templates
  const fetchInvoiceTemplates = async () => {
    try {
      const response = await fetch('/api/invoice/templates');
      if (!response.ok) throw new Error('Failed to fetch invoice templates');
      return await response.json();
    } catch (error) {
      console.error('Error fetching invoice templates:', error);
      throw error;
    }
  };
  
  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      // Load tenant settings
      const tenantData = await fetchTenantSettings();
      
      // Set branding settings
      const brandData = {
        companyName: tenantData.name || defaultBrandSettings.companyName,
        primaryColor: tenantData.primaryColor || defaultBrandSettings.primaryColor,
        secondaryColor: tenantData.secondaryColor || defaultBrandSettings.secondaryColor,
        logoUrl: tenantData.logoUrl || null,
        faviconUrl: tenantData.faviconUrl || null,
        subdomain: tenantData.subdomain || "",
        customDomain: tenantData.customDomain || "",
        emailFooter: tenantData.emailFooter || defaultBrandSettings.emailFooter,
      };
      
      setBrandSettings(brandData);
      
      // Set logo and favicon previews
      if (brandData.logoUrl) {
        setLogoPreview(brandData.logoUrl);
      }
      
      if (brandData.faviconUrl) {
        setFaviconPreview(brandData.faviconUrl);
      }
      
      // Load notification settings
      const notificationData = {
        emailNotifications: tenantData.emailNotifications !== undefined ? tenantData.emailNotifications : defaultNotificationSettings.emailNotifications,
        smsNotifications: tenantData.smsNotifications !== undefined ? tenantData.smsNotifications : defaultNotificationSettings.smsNotifications,
        inAppNotifications: tenantData.inAppNotifications !== undefined ? tenantData.inAppNotifications : defaultNotificationSettings.inAppNotifications,
        dailyReports: tenantData.dailyReports !== undefined ? tenantData.dailyReports : defaultNotificationSettings.dailyReports,
        weeklyReports: tenantData.weeklyReports !== undefined ? tenantData.weeklyReports : defaultNotificationSettings.weeklyReports,
        monthlyReports: tenantData.monthlyReports !== undefined ? tenantData.monthlyReports : defaultNotificationSettings.monthlyReports,
        invoiceReminders: tenantData.invoiceReminders !== undefined ? tenantData.invoiceReminders : defaultNotificationSettings.invoiceReminders,
        lowStockAlerts: tenantData.lowStockAlerts !== undefined ? tenantData.lowStockAlerts : defaultNotificationSettings.lowStockAlerts,
        paymentReceipts: tenantData.paymentReceipts !== undefined ? tenantData.paymentReceipts : defaultNotificationSettings.paymentReceipts,
      };
      
      setNotificationSettings(notificationData);

      // Load business settings
      const businessData = {
        businessAddress: tenantData.businessAddress || defaultBusinessSettings.businessAddress,
        businessCity: tenantData.businessCity || defaultBusinessSettings.businessCity,
        businessPhone: tenantData.businessPhone || defaultBusinessSettings.businessPhone,
        businessEmail: tenantData.businessEmail || defaultBusinessSettings.businessEmail,
        buildingName: tenantData.buildingName || defaultBusinessSettings.buildingName,
        receiptFooter: tenantData.receiptFooter || defaultBusinessSettings.receiptFooter,
        receiptPaperWidthMm:
          tenantData.receiptPaperWidthMm ?? defaultBusinessSettings.receiptPaperWidthMm,
        defaultBankDetails: tenantData.defaultBankDetails ?? defaultBusinessSettings.defaultBankDetails,
        taxOutflowAccountId: tenantData.taxOutflowAccountId ?? defaultBusinessSettings.taxOutflowAccountId,
      };
      setBusinessSettings(businessData);
      
      // Load invoice templates
      const templatesData = await fetchInvoiceTemplates();
      setInvoiceTemplates(templatesData.templates || []);

      // Load accounts for tax outflow dropdown (optional; may 403 if user lacks finance role)
      try {
        const accRes = await fetch('/api/chart-of-accounts?limit=500');
        if (accRes.ok) {
          const accData = await accRes.json();
          setTaxOutflowAccountOptions(accData.accounts || []);
        }
      } catch (_) {
        setTaxOutflowAccountOptions([]);
      }
      
      // Set original data for change detection
      setOriginalSettings({
        brand: brandData,
        notifications: notificationData,
        business: businessData,
        templates: templatesData.templates || []
      });
      
      showToast("success", "Settings loaded successfully", "Your system customization settings have been loaded.");
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast("error", "Error loading settings", "There was an error loading your settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBrandChange = (field, value) => {
    setBrandSettings({
      ...brandSettings,
      [field]: value
    });
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  const handleNotificationChange = (field, value) => {
    setNotificationSettings({
      ...notificationSettings,
      [field]: value
    });
  };

  const handleBusinessChange = (field, value) => {
    setBusinessSettings({
      ...businessSettings,
      [field]: value
    });
  };
  
  const validateForm = () => {
    const validationErrors = validateBrandingSettings(brandSettings);
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      // Show only the first error as a toast
      const firstError = Object.values(validationErrors)[0];
      showToast("error", "Validation Error", firstError);
      return false;
    }
    
    return true;
  };
  
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    const validationError = validateFileUpload(file, logoValidationOptions);
    if (validationError) {
      showToast("error", "Invalid logo file", validationError.message);
      return;
    }
    
    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    showToast("info", "Logo selected", `${file.name} (${formatFileSize(file.size)})`);
  };
  
  const handleFaviconUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    const validationError = validateFileUpload(file, faviconValidationOptions);
    if (validationError) {
      showToast("error", "Invalid favicon file", validationError.message);
      return;
    }
    
    setFaviconFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFaviconPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    showToast("info", "Favicon selected", `${file.name} (${formatFileSize(file.size)})`);
  };
  
  // Format file size helper
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  };
  
  // Function to add a new invoice template
  const addInvoiceTemplate = () => {
    const newId = `temp-${Date.now()}`; // Temporary ID until saved to backend
    const newTemplate = { 
      id: newId, 
      name: "New Template", 
      isDefault: false,
      content: JSON.stringify({
        style: 'standard',
        showLogo: true,
        showFooter: true,
        primaryColor: brandSettings.primaryColor
      }),
      isNew: true // Flag to indicate this is a new template
    };
    
    setInvoiceTemplates([...invoiceTemplates, newTemplate]);
    setActiveTemplate(newTemplate);
    showToast("success", "Template created", "New template added");
  };

  // Function to set default invoice template
  const setDefaultInvoiceTemplate = async (id) => {
    try {
      setIsSaving(true);
      
      // Update local state first for UI responsiveness
      const updatedTemplates = invoiceTemplates.map(template => 
        ({ ...template, isDefault: template.id === id })
      );
      setInvoiceTemplates(updatedTemplates);
      
      // Update on the backend
      await fetch(`/api/invoice/templates/${id}/set-default`, {
        method: 'PUT'
      });
      
      showToast("success", "Default template updated", "Your default invoice template has been updated.");
    } catch (error) {
      console.error('Error setting default template:', error);
      
      // Revert the UI state
      setInvoiceTemplates(originalSettings.templates);
      
      showToast("error", "Error updating default template", "There was an error updating your default template. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Function to delete an invoice template
  const handleDeleteTemplate = async (id) => {
    if (invoiceTemplates.length <= 1) {
      showToast("error", "Cannot delete template", "You must have at least one invoice template.");
      return;
    }
    
    const templateToDelete = invoiceTemplates.find(t => t.id === id);
    if (templateToDelete && templateToDelete.isDefault) {
      showToast("error", "Cannot delete default template", "You cannot delete the default template. Please set another template as default first.");
      return;
    }
    
    try {
      setIsSaving(true);
      
      // If it's a new template that hasn't been saved yet
      if (templateToDelete.isNew) {
        setInvoiceTemplates(invoiceTemplates.filter(template => template.id !== id));
        showToast("success", "Template removed", "The template has been removed.");
        setIsSaving(false);
        return;
      }
      
      // Otherwise delete from the backend
      await fetch(`/api/invoice/templates/${id}`, {
        method: 'DELETE'
      });
      
      // Update local state
      setInvoiceTemplates(invoiceTemplates.filter(template => template.id !== id));
      
      showToast("success", "Template deleted", "Your invoice template has been deleted.");
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast("error", "Error deleting template", "There was an error deleting your template. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Function to update invoice template name
  const updateTemplateName = (id, name) => {
    setInvoiceTemplates(invoiceTemplates.map(template => 
      template.id === id ? { ...template, name } : template
    ));
    if (activeTemplate?.id === id) {
      setActiveTemplate({ ...activeTemplate, name });
    }
  };

  const parseTemplateContent = (template) => {
    try {
      return typeof template?.content === 'string'
        ? JSON.parse(template.content || '{}')
        : { ...(template?.content || {}) };
    } catch {
      return {};
    }
  };

  const patchActiveTemplateContent = (patch) => {
    setActiveTemplate((prev) => {
      if (!prev) return prev;
      const next = { ...parseTemplateContent(prev), ...patch };
      return { ...prev, content: JSON.stringify(next) };
    });
  };
  
  const handlePreviewTemplate = (template) => {
    setActiveTemplate(template);
    setIsPreviewMode(true);
  };
  
  const handleEditTemplate = (template) => {
    setActiveTemplate(template);
    setIsPreviewMode(false);
  };
  
  const saveSettings = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Upload logo if changed
      let logoUrl = brandSettings.logoUrl;
      if (logoFile) {
        // Show uploading toast
        showToast("info", "Uploading logo...", null, Infinity);
        
        try {
          const logoUploadResult = await uploadFile(logoFile, 'logo');
          logoUrl = logoUploadResult.url;
          
          // Close the infinite duration toast
          closeToast();
          showToast("success", "Logo uploaded successfully");
        } catch (error) {
          closeToast();
          showToast("error", "Failed to upload logo", error.message);
          setIsSaving(false);
          return;
        }
      }
      
      // Upload favicon if changed
      let faviconUrl = brandSettings.faviconUrl;
      if (faviconFile) {
        // Show uploading toast
        showToast("info", "Uploading favicon...", null, Infinity);
        
        try {
          const faviconUploadResult = await uploadFile(faviconFile, 'favicon');
          faviconUrl = faviconUploadResult.url;
          
          // Close the infinite duration toast
          closeToast();
          showToast("success", "Favicon uploaded successfully");
        } catch (error) {
          closeToast();
          showToast("error", "Failed to upload favicon", error.message);
          setIsSaving(false);
          return;
        }
      }
      
      // Show saving toast
      showToast("info", "Saving settings...", null, Infinity);
      
      // Prepare the settings data
      const settingsData = {
        // Branding settings
        name: brandSettings.companyName,
        primaryColor: brandSettings.primaryColor,
        secondaryColor: brandSettings.secondaryColor,
        logoUrl,
        faviconUrl,
        emailFooter: brandSettings.emailFooter,
        
        // Notification settings
        ...notificationSettings,

        // Business settings
        businessAddress: businessSettings.businessAddress,
        businessCity: businessSettings.businessCity,
        businessPhone: businessSettings.businessPhone,
        businessEmail: businessSettings.businessEmail,
        buildingName: businessSettings.buildingName,
        receiptFooter: businessSettings.receiptFooter,
        receiptPaperWidthMm: businessSettings.receiptPaperWidthMm ?? 80,
        defaultBankDetails: businessSettings.defaultBankDetails,
        taxOutflowAccountId: businessSettings.taxOutflowAccountId || undefined,
      };
      
      // Save tenant settings
      await saveTenantSettings(settingsData);
      
      // Save invoice templates that have changed
      for (const template of invoiceTemplates) {
        // Find the original template
        const originalTemplate = originalSettings.templates.find(t => t.id === template.id);
        
        // If it's new or has changed
        if (template.isNew || !originalTemplate || JSON.stringify(template) !== JSON.stringify(originalTemplate)) {
          // Handle template data
          const templateData = {
            ...template,
            isNew: undefined // Remove the isNew property before sending to API
          };
          
          if (template.isNew) {
            // Create new template
            await fetch('/api/invoice/templates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(templateData)
            });
          } else {
            // Update existing template
            await fetch(`/api/invoice/templates/${template.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(templateData)
            });
          }
        }
      }
      
      // Close the infinite toast
      closeToast();
      
      // Update the original settings to reflect the new state
      setOriginalSettings({
        brand: {
          ...brandSettings,
          logoUrl,
          faviconUrl
        },
        notifications: notificationSettings,
        business: businessSettings,
        templates: [...invoiceTemplates.map(t => ({ ...t, isNew: undefined }))]
      });
      
      // Clear file upload states
      setLogoFile(null);
      setFaviconFile(null);
      
      showToast("success", "Settings saved successfully", "Your system customization settings have been updated.");
    } catch (error) {
      console.error('Error saving settings:', error);
      
      // Close any infinite toast
      closeToast();
      
      showToast("error", "Error saving settings", error.message || "There was an error saving your settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const discardChanges = () => {
    // Reset to original settings
    setBrandSettings(originalSettings.brand);
    setNotificationSettings(originalSettings.notifications);
    setInvoiceTemplates(originalSettings.templates);
    setBusinessSettings(originalSettings.business);
    
    // Reset file uploads
    setLogoFile(null);
    setFaviconFile(null);
    
    // Reset previews
    setLogoPreview(originalSettings.brand.logoUrl);
    setFaviconPreview(originalSettings.brand.faviconUrl);
    
    // Reset errors
    setErrors({});
    
    showToast("info", "Changes discarded", "Your changes have been discarded.");
  };
  
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto bg-white shadow-sm rounded-lg p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Loading settings...</h2>
          <p className="text-gray-500 mt-2">Please wait while we load your customization settings.</p>
        </div>
      </div>
    );
  }
  
  return (
    <PermissionGuard permission="system.view">   
    <div className="max-w-7xl mx-auto bg-white shadow-sm rounded-lg">
      {/* Toast notification */}
      <Toast toast={toast} closeToast={closeToast} />
      
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">System Customization</h1>
            <p className="mt-1 text-sm text-gray-600">Customize your InsightBooks tenant to match your business needs</p>
          </div>
          <div className="flex space-x-3">
            {hasChanges && (
              <button 
                onClick={discardChanges}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" />
                Discard Changes
              </button>
            )}
            {canUpdateSettings &&( <button 
              onClick={saveSettings}
              disabled={!hasChanges || isSaving}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                (!hasChanges || isSaving) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>)}
          </div>
        </div>
      </div>
      
      {/* Setup Progress */}
      <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-500" />
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-blue-800">Setup Progress: 3/5 Completed</h3>
              <p className="text-sm text-blue-700">60% Complete</p>
            </div>
            <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
            </div>
            <p className="mt-2 text-xs text-blue-700">Complete all configuration steps to ensure optimal system functionality.</p>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="px-6 pt-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('branding')}
              className={`${
                activeTab === 'branding'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Paintbrush className="mr-2 h-5 w-5" />
              Branding
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`${
                activeTab === 'invoices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <FileText className="mr-2 h-5 w-5" />
              Invoice Templates
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Bell className="mr-2 h-5 w-5" />
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('business')}
              className={`${
                activeTab === 'business'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Building2 className="mr-2 h-5 w-5" />
              Business
            </button>
          </nav>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Company Branding</h2>
            </div>
            
            <div className="bg-white shadow-sm overflow-hidden border border-gray-200 sm:rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                        errors.companyName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''
                      }`}
                      value={brandSettings.companyName}
                      onChange={(e) => handleBrandChange('companyName', e.target.value)}
                    />
                    {errors.companyName && (
                      <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="primaryColorPicker"
                        type="color"
                        value={brandSettings.primaryColor}
                        onChange={(e) => handleBrandChange('primaryColor', e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer border border-gray-300 rounded"
                      />
                      <input
                        id="primaryColor"
                        type="text"
                        value={brandSettings.primaryColor}
                        onChange={(e) => handleBrandChange('primaryColor', e.target.value)}
                        className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                          errors.primaryColor ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''
                        }`}
                      />
                    </div>
                    {errors.primaryColor && (
                      <p className="mt-1 text-sm text-red-600">{errors.primaryColor}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="secondaryColorPicker"
                        type="color"
                        value={brandSettings.secondaryColor}
                        onChange={(e) => handleBrandChange('secondaryColor', e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer border border-gray-300 rounded"
                      />
                      <input
                        id="secondaryColor"
                        type="text"
                        value={brandSettings.secondaryColor}
                        onChange={(e) => handleBrandChange('secondaryColor', e.target.value)}
                        className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                          errors.secondaryColor ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''
                        }`}
                      />
                    </div>
                    {errors.secondaryColor && (
                      <p className="mt-1 text-sm text-red-600">{errors.secondaryColor}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="emailFooter" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Footer Text
                    </label>
                    <textarea
                      id="emailFooter"
                      value={brandSettings.emailFooter}
                      onChange={(e) => handleBrandChange('emailFooter', e.target.value)}
                      rows={3}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Logo
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="border border-gray-200 rounded-lg p-3 w-24 h-24 flex items-center justify-center bg-gray-50">
                        {logoPreview ? (
                          <img 
                            src={logoPreview} 
                            alt="Company Logo" 
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <Upload className="h-10 w-10 text-gray-300" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="file"
                          id="logo-upload"
                          ref={logoInputRef}
                          className="hidden"
                          accept="image/jpeg,image/png,image/svg+xml"
                          onChange={handleLogoUpload}
                        />
                        <label 
                          htmlFor="logo-upload"
                          className="inline-flex px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Logo
                        </label>
                        <p className="text-xs text-gray-500">
                          Recommended size: 200x50 pixels (PNG, JPG, SVG)
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Favicon
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="border border-gray-200 rounded-lg p-2 w-14 h-14 flex items-center justify-center bg-gray-50">
                        {faviconPreview ? (
                          <img 
                            src={faviconPreview} 
                            alt="Favicon" 
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <Upload className="h-6 w-6 text-gray-300" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="file"
                          id="favicon-upload"
                          ref={faviconInputRef}
                          className="hidden"
                          accept="image/x-icon,image/png"
                          onChange={handleFaviconUpload}
                        />
                        <label 
                          htmlFor="favicon-upload"
                          className="inline-flex px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Favicon
                        </label>
                        <p className="text-xs text-gray-500">
                          Square image, 32x32 pixels (ICO, PNG)
                        </p>
                      </div>
                    </div>
                  </div>
            
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-md border border-gray-200">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">About Branding</p>
                <p className="mt-1">Your branding settings determine the appearance of your tenant across the platform. These settings will be applied to invoices, user interface elements, emails, and other customer-facing materials.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Invoice Templates Tab */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Invoice Template Management</h2>
              <button 
                onClick={addInvoiceTemplate}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isSaving}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Template
              </button>
            </div>
            
            {/* Template preview/edit modal */}
            {activeTemplate && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-fadeInUp">
                  <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium">
                      {isPreviewMode ? 'Preview Template' : 'Edit Template'}: {activeTemplate.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setIsPreviewMode(!isPreviewMode)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        {isPreviewMode ? (
                          <>
                            <Edit className="inline-block w-4 h-4 mr-1" />
                            Edit
                          </>
                        ) : (
                          <>
                            <Eye className="inline-block w-4 h-4 mr-1" />
                            Preview
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTemplate(null)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-6">
                    {isPreviewMode ? (
                      <InvoiceTemplatePreview 
                        template={activeTemplate} 
                        branding={brandSettings} 
                      />
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">
                            Template Name
                          </label>
                          <input
                            id="templateName"
                            type="text"
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            value={activeTemplate.name}
                            onChange={(e) => updateTemplateName(activeTemplate.id, e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Layout
                          </label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              { id: 'classic', label: 'Classic', style: 'standard' },
                              { id: 'modern', label: 'Modern', style: 'professional' },
                              { id: 'compact', label: 'Compact', style: 'minimal' },
                              { id: 'bold', label: 'Bold', style: 'bold' },
                            ].map((layout) => {
                              const content = parseTemplateContent(activeTemplate);
                              const active = String(content.style || 'standard') === layout.style;
                              return (
                                <button
                                  key={layout.id}
                                  type="button"
                                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-700'}`}
                                  onClick={() => patchActiveTemplateContent({ style: layout.style })}
                                >
                                  {layout.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Invoice colour
                          </label>
                          <input
                            type="color"
                            className="h-10 w-16 cursor-pointer rounded border border-gray-300"
                            value={parseTemplateContent(activeTemplate).primaryColor || brandSettings.primaryColor || '#0075be'}
                            onChange={(e) => patchActiveTemplateContent({ primaryColor: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Template Settings
                          </label>
                          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                            <div className="space-y-3">
                              <div className="flex items-center">
                                <input
                                  id="showLogo"
                                  type="checkbox"
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  checked={parseTemplateContent(activeTemplate).showLogo !== false}
                                  onChange={(e) => patchActiveTemplateContent({ showLogo: e.target.checked })}
                                />
                                <label htmlFor="showLogo" className="ml-2 block text-sm text-gray-700">
                                  Show company logo
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="showFooter"
                                  type="checkbox"
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  checked={parseTemplateContent(activeTemplate).showFooter !== false}
                                  onChange={(e) => patchActiveTemplateContent({ showFooter: e.target.checked })}
                                />
                                <label htmlFor="showFooter" className="ml-2 block text-sm text-gray-700">
                                  Show email footer text
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                      onClick={() => setActiveTemplate(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // Save changes to the template
                        setInvoiceTemplates(invoiceTemplates.map(template => 
                          template.id === activeTemplate.id ? { ...activeTemplate } : template
                        ));
                        setActiveTemplate(null);
                        showToast("success", "Template updated", "Changes to template saved");
                      }}
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Save Template
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invoiceTemplates.map((template) => (
                <div key={template.id} className={`overflow-hidden shadow-sm rounded-lg border ${template.isDefault ? 'border-blue-300 ring-1 ring-blue-500' : 'border-gray-200'}`}>
                  <div className={`px-4 py-3 flex justify-between items-center ${template.isDefault ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <input
                      type="text"
                      value={template.name}
                      onChange={(e) => updateTemplateName(template.id, e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-sm font-medium max-w-[150px]"
                    />
                    {template.isDefault ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Check className="mr-1 h-3 w-3" />
                        Default
                      </span>
                    ) : (
                      <button 
                        onClick={() => setDefaultInvoiceTemplate(template.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        disabled={isSaving}
                      >
                        Set as Default
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="aspect-w-8 aspect-h-11 bg-gray-100 mb-3 rounded border border-gray-200 flex items-center justify-center">
                      <FileText className="h-12 w-12 text-gray-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => handlePreviewTemplate(template)}
                        disabled={isSaving}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </button>
                      <button 
                        className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => handleEditTemplate(template)}
                        disabled={isSaving}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </button>
                      {!template.isDefault && (
                        <button 
                          className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-red-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          onClick={() => handleDeleteTemplate(template.id)}
                          disabled={isSaving}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={addInvoiceTemplate}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:border-gray-400 hover:bg-gray-50 focus:outline-none"
                disabled={isSaving}
              >
                <Plus className="h-8 w-8 mb-2" />
                <span className="text-sm font-medium">Add New Template</span>
              </button>
            </div>
            
            <div className="flex items-start space-x-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-md border border-gray-200">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">About Invoice Templates</p>
                <p className="mt-1">Templates determine how your invoices appear to clients. The default template will be used for new invoices unless another is selected during invoice creation.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Notification Preferences</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white shadow-sm overflow-hidden border border-gray-200 sm:rounded-lg p-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">System Notifications</h3>
                <div className="space-y-4">
                  {Object.entries({
                    emailNotifications: "Email Notifications",
                    smsNotifications: "SMS Notifications",
                    inAppNotifications: "In-App Notifications",
                    invoiceReminders: "Invoice Reminders",
                    lowStockAlerts: "Low Stock Alerts",
                    paymentReceipts: "Payment Receipts"
                  }).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <label htmlFor={`toggle-${key}`} className="text-sm font-medium text-gray-700">
                        {label}
                      </label>
                      <label className="relative inline-flex items-center">
                        <input 
                          type="checkbox"
                          id={`toggle-${key}`}
                          className="sr-only peer" 
                          checked={notificationSettings[key]}
                          onChange={(e) => handleNotificationChange(key, e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white shadow-sm overflow-hidden border border-gray-200 sm:rounded-lg p-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">Automated Reports</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="toggle-dailyReports" className="text-sm font-medium text-gray-700">
                        Daily Reports
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Sent every evening at 6 PM</p>
                    </div>
                    <label className="relative inline-flex items-center">
                      <input 
                        type="checkbox"
                        id="toggle-dailyReports"
                        className="sr-only peer" 
                        checked={notificationSettings.dailyReports}
                        onChange={(e) => handleNotificationChange("dailyReports", e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="toggle-weeklyReports" className="text-sm font-medium text-gray-700">
                        Weekly Reports
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Sent every Monday at 8 AM</p>
                    </div>
                    <label className="relative inline-flex items-center">
                      <input 
                        type="checkbox"
                        id="toggle-weeklyReports"
                        className="sr-only peer" 
                        checked={notificationSettings.weeklyReports}
                        onChange={(e) => handleNotificationChange("weeklyReports", e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="toggle-monthlyReports" className="text-sm font-medium text-gray-700">
                        Monthly Reports
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Sent on the 1st of each month</p>
                    </div>
                    <label className="relative inline-flex items-center">
                      <input 
                        type="checkbox"
                        id="toggle-monthlyReports"
                        className="sr-only peer" 
                        checked={notificationSettings.monthlyReports}
                        onChange={(e) => handleNotificationChange("monthlyReports", e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-md border border-gray-200">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">About Notifications</p>
                <p className="mt-1">Customize which notifications and reports you want to receive. Email notifications require a valid email address configured in your profile settings.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Business Tab */}
        {activeTab === 'business' && (
          <div className="space-y-8 pb-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Business & tax settings</h2>
                <p className="mt-1 text-sm text-gray-500 max-w-xl">Contact details, banking, and defaults for invoices, quotations, and receipts.</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            {/* Contact & location */}
            <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 text-amber-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Contact & location</h3>
                    <p className="text-xs text-gray-500">Address, phone, and email used in document footers</p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="sm:col-span-2">
                    <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700 mb-1.5">Business address</label>
                    <input
                      id="businessAddress"
                      type="text"
                      placeholder="Street, area, P.O. Box"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        errors.businessAddress ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                      }`}
                      value={businessSettings.businessAddress}
                      onChange={(e) => handleBusinessChange('businessAddress', e.target.value)}
                    />
                    {errors.businessAddress && <p className="mt-1.5 text-xs text-red-600">{errors.businessAddress}</p>}
                  </div>
                  <div>
                    <label htmlFor="businessCity" className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                    <input
                      id="businessCity"
                      type="text"
                      placeholder="e.g. Blantyre"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        errors.businessCity ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                      }`}
                      value={businessSettings.businessCity}
                      onChange={(e) => handleBusinessChange('businessCity', e.target.value)}
                    />
                    {errors.businessCity && <p className="mt-1.5 text-xs text-red-600">{errors.businessCity}</p>}
                  </div>
                  <div>
                    <label htmlFor="buildingName" className="block text-sm font-medium text-gray-700 mb-1.5">Building / premise (optional)</label>
                    <input
                      id="buildingName"
                      type="text"
                      placeholder="Building or floor"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        errors.buildingName ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                      }`}
                      value={businessSettings.buildingName}
                      onChange={(e) => handleBusinessChange('buildingName', e.target.value)}
                    />
                    {errors.buildingName && <p className="mt-1.5 text-xs text-red-600">{errors.buildingName}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:col-span-2">
                    <div className="flex-1 min-w-0">
                      <label htmlFor="businessPhone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          id="businessPhone"
                          type="tel"
                          placeholder="+265 ..."
                          className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                            errors.businessPhone ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                          }`}
                          value={businessSettings.businessPhone}
                          onChange={(e) => handleBusinessChange('businessPhone', e.target.value)}
                        />
                      </div>
                      {errors.businessPhone && <p className="mt-1.5 text-xs text-red-600">{errors.businessPhone}</p>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label htmlFor="businessEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          id="businessEmail"
                          type="email"
                          placeholder="contact@company.com"
                          className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                            errors.businessEmail ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                          }`}
                          value={businessSettings.businessEmail}
                          onChange={(e) => handleBusinessChange('businessEmail', e.target.value)}
                        />
                      </div>
                      {errors.businessEmail && <p className="mt-1.5 text-xs text-red-600">{errors.businessEmail}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Banking & tax */}
            <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Banking & tax</h3>
                    <p className="text-xs text-gray-500">Default bank details and purchase tax account</p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="defaultBankDetails" className="block text-sm font-medium text-gray-700 mb-1.5">Default bank account details</label>
                    <p className="text-xs text-gray-500 mb-2">Shown in invoice, quotation and receipt footers. Override per document when needed.</p>
                    <textarea
                      id="defaultBankDetails"
                      rows={5}
                      placeholder={`Bank: Standard Bank\nAccount name: Your Company Ltd\nAccount number: 1234567890\nBranch: Blantyre`}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y min-h-[120px]"
                      value={businessSettings.defaultBankDetails}
                      onChange={(e) => handleBusinessChange('defaultBankDetails', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="taxOutflowAccountId" className="block text-sm font-medium text-gray-700 mb-1.5">Tax outflow account (optional)</label>
                    <p className="text-xs text-gray-500 mb-2">Where tax from expenses and supplier bills is recorded. Leave empty to use the default tax account.</p>
                    <select
                      id="taxOutflowAccountId"
                      value={businessSettings.taxOutflowAccountId || ""}
                      onChange={(e) => handleBusinessChange('taxOutflowAccountId', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="">— Use default tax account —</option>
                      {taxOutflowAccountOptions.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.accountCode} – {acc.accountName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* Document defaults */}
            <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Document defaults</h3>
                    <p className="text-xs text-gray-500">Thermal paper size and footer text for receipts</p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label htmlFor="receiptPaperWidthMm" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Thermal paper width
                  </label>
                  <select
                    id="receiptPaperWidthMm"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={businessSettings.receiptPaperWidthMm ?? 80}
                    onChange={(e) =>
                      handleBusinessChange('receiptPaperWidthMm', Number(e.target.value))
                    }
                  >
                    {[58, 70, 72, 76, 80, 88, 90].map((mm) => (
                      <option key={mm} value={mm}>
                        {mm} mm{mm === 80 ? ' (most common)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Default for POS thermal printing on web and Android (58–90 mm).
                  </p>
                </div>
                <div>
                  <label htmlFor="receiptFooter" className="block text-sm font-medium text-gray-700 mb-1.5">Receipt footer text</label>
                  <textarea
                    id="receiptFooter"
                    rows={3}
                    placeholder="Thank you for your business!"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y min-h-[80px]"
                    value={businessSettings.receiptFooter}
                    onChange={(e) => handleBusinessChange('receiptFooter', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Info callout */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-4 sm:p-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-600 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">About business information</p>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">Contact and bank details appear in the footers of invoices, quotations, and receipts. You can override them per document when creating or editing.</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Sticky Footer with save button */}
      {hasChanges && (
        <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-6 py-3 flex justify-end space-x-3">
          <button 
            onClick={discardChanges}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            disabled={isSaving}
          >
            <X className="mr-2 h-4 w-4" />
            Discard Changes
          </button>
          {canUpdateSettings &&(  <button 
            onClick={saveSettings}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </button> )}
        </div>
      )}
      
      {/* CSS for animations */}
      <style jsx global>{`
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
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.3s ease-out;
        }
      `}</style>
    </div>
    </PermissionGuard>
  );
}

function CustomizationFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-gray-500">Loading customization...</p>
      </div>
    </div>
  );
}

export default function SystemCustomization() {
  const router = useRouter();
  useEffect(() => {
    // Customization has moved to Account (system configuration). Redirect so old links work.
    router.replace("/account?tab=business");
  }, [router]);
  return (
    <Suspense fallback={<CustomizationFallback />}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Redirecting to Account & business...</p>
      </div>
    </Suspense>
  );
}
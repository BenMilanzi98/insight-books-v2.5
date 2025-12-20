// lib/validation.js
/**
 * Validates branding settings form data
 * @param {Object} data - The branding settings data to validate
 * @returns {Object} Errors object, empty if validation passes
 */
export const validateBrandingSettings = (data) => {
    const errors = {};
  
    // Validate company name
    if (!data.companyName || data.companyName.trim() === '') {
      errors.companyName = 'Company name is required';
    } else if (data.companyName.length > 100) {
      errors.companyName = 'Company name must be 100 characters or less';
    }
  
    // Validate primary color
    const colorRegex = /^#([0-9A-F]{3}){1,2}$/i;
    if (!data.primaryColor) {
      errors.primaryColor = 'Primary color is required';
    } else if (!colorRegex.test(data.primaryColor)) {
      errors.primaryColor = 'Invalid hex color format (e.g. #FF0000)';
    }
  
    // Validate secondary color
    if (data.secondaryColor && !colorRegex.test(data.secondaryColor)) {
      errors.secondaryColor = 'Invalid hex color format (e.g. #00FF00)';
    }
  
    // Validate subdomain if present
    if (data.subdomain) {
      const subdomainRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
      if (!subdomainRegex.test(data.subdomain)) {
        errors.subdomain = 'Subdomain can only contain lowercase letters, numbers, and hyphens';
      }
    }
  
    // Validate custom domain if present
    if (data.customDomain) {
      const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
      if (!domainRegex.test(data.customDomain)) {
        errors.customDomain = 'Please enter a valid domain name';
      }
    }
  
    // Validate email footer
    if (data.emailFooter && data.emailFooter.length > 500) {
      errors.emailFooter = 'Email footer must be 500 characters or less';
    }
  
    return errors;
  };
  
  /**
   * Validates invoice template data
   * @param {Object} data - The invoice template data to validate
   * @returns {Object} Errors object, empty if validation passes
   */
  export const validateInvoiceTemplate = (data) => {
    const errors = {};
  
    // Validate template name
    if (!data.name || data.name.trim() === '') {
      errors.name = 'Template name is required';
    } else if (data.name.length > 50) {
      errors.name = 'Template name must be 50 characters or less';
    }
  
    // Validate template content
    if (data.content) {
      try {
        // Try to parse the content if it's a string
        if (typeof data.content === 'string') {
          JSON.parse(data.content);
        }
      } catch (e) {
        errors.content = 'Invalid template content format';
      }
    }
  
    return errors;
  };
  
  /**
   * Validates file uploads
   * @param {File} file - The file to validate
   * @param {Object} options - Validation options
   * @returns {Object|null} Error object or null if validation passes
   */
  export const validateFileUpload = (file, options = {}) => {
    const {
      allowedTypes = [],
      maxSizeInBytes = 2 * 1024 * 1024, // 2MB default
      type = 'file'
    } = options;
  
    // Check if file exists
    if (!file) {
      return { message: `No ${type} selected` };
    }
  
    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return { 
        message: `Invalid ${type} format. Allowed formats: ${allowedTypes.map(t => t.replace('image/', '').toUpperCase()).join(', ')}` 
      };
    }
  
    // Check file size
    if (file.size > maxSizeInBytes) {
      const maxSizeInMB = maxSizeInBytes / (1024 * 1024);
      return { message: `${type.charAt(0).toUpperCase() + type.slice(1)} size must be less than ${maxSizeInMB}MB` };
    }
  
    return null;
  };
  
  // File validation options
  export const logoValidationOptions = {
    allowedTypes: ['image/jpeg', 'image/png', 'image/svg+xml'],
    maxSizeInBytes: 2 * 1024 * 1024, // 2MB
    type: 'logo'
  };
  
  export const faviconValidationOptions = {
    allowedTypes: ['image/x-icon', 'image/png'],
    maxSizeInBytes: 1 * 1024 * 1024, // 1MB
    type: 'favicon'
  };
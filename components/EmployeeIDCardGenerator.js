"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Download, 
  Printer, 
  X, 
  Palette, 
  Image as ImageIcon,
  Building2,
  User,
  Settings,
  Save,
  Eye
} from 'lucide-react';

const EmployeeIDCardGenerator = ({ employees, onClose, tenantInfo }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeePhoto, setEmployeePhoto] = useState(null);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [idCardDesign, setIdCardDesign] = useState({
    theme: 'blue',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    showEmployeePhoto: true,
    showCompanyLogo: true,
    showQRCode: false,
    layout: 'horizontal', // horizontal or vertical
    cardSize: 'standard', // standard, compact, large
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderWidth: 2,
    showSignature: false,
    fontSize: 'medium',
    fontFamily: 'Arial'
  });
  const [previewMode, setPreviewMode] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const printRef = useRef(null);

  const themes = {
    blue: { primary: '#1e40af', secondary: '#3b82f6', name: 'Blue' },
    green: { primary: '#059669', secondary: '#10b981', name: 'Green' },
    purple: { primary: '#7c3aed', secondary: '#a855f7', name: 'Purple' },
    red: { primary: '#dc2626', secondary: '#ef4444', name: 'Red' },
    orange: { primary: '#ea580c', secondary: '#f97316', name: 'Orange' },
    teal: { primary: '#0d9488', secondary: '#14b8a6', name: 'Teal' },
    custom: { primary: idCardDesign.primaryColor, secondary: idCardDesign.secondaryColor, name: 'Custom' }
  };

  useEffect(() => {
    if (selectedEmployee) {
      // Load employee photo if exists - check multiple possible locations
      const contactDetails = selectedEmployee.contactDetails && typeof selectedEmployee.contactDetails === 'object' 
        ? selectedEmployee.contactDetails 
        : {};
      const photoUrl = selectedEmployee.photoUrl 
        || selectedEmployee.photo 
        || contactDetails.photoUrl 
        || contactDetails.photo
        || null;
      if (photoUrl) {
        setEmployeePhoto(photoUrl);
      } else {
        setEmployeePhoto(null);
      }
    }
  }, [selectedEmployee]);

  useEffect(() => {
    // Load company logo from tenant info
    if (tenantInfo?.logoUrl) {
      setCompanyLogo(tenantInfo.logoUrl);
    } else if (tenantInfo?.logo) {
      setCompanyLogo(tenantInfo.logo);
    }
  }, [tenantInfo]);

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    // Extract photo URL from multiple possible locations
    const contactDetails = employee.contactDetails && typeof employee.contactDetails === 'object' 
      ? employee.contactDetails 
      : {};
    const photoUrl = employee.photoUrl 
      || employee.photo 
      || contactDetails.photoUrl 
      || contactDetails.photo
      || null;
    if (photoUrl) {
      setEmployeePhoto(photoUrl);
    } else {
      setEmployeePhoto(null);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployee) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      alert('Please upload a JPEG or PNG image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', selectedEmployee.id);
      formData.append('type', 'photo');

      const response = await fetch('/api/employees/upload-photo', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload photo');
      }

      const data = await response.json();
      setEmployeePhoto(data.url);
      
      // Update selected employee with new photo URL
      setSelectedEmployee({
        ...selectedEmployee,
        photoUrl: data.url,
        photo: data.url
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png|svg\+xml)$/)) {
      alert('Please upload a JPEG, PNG, or SVG image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');

      const response = await fetch('/api/tenant/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }

      const data = await response.json();
      setCompanyLogo(data.logoUrl || data.url);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleThemeChange = (theme) => {
    if (theme === 'custom') {
      setIdCardDesign(prev => ({ ...prev, theme: 'custom' }));
    } else {
      const themeColors = themes[theme];
      setIdCardDesign(prev => ({
        ...prev,
        theme,
        primaryColor: themeColors.primary,
        secondaryColor: themeColors.secondary
      }));
    }
  };

  const handlePrint = () => {
    if (!selectedEmployee) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Build the HTML structure manually to match preview
      const photoHtml = idCardDesign.showEmployeePhoto ? `
        <div style="display: ${idCardDesign.layout === 'vertical' ? 'flex' : 'block'}; justify-content: center; margin-bottom: ${idCardDesign.layout === 'vertical' ? '20px' : '0'}; ${idCardDesign.layout === 'horizontal' ? 'flex-shrink: 0;' : ''}">
          ${employeePhoto ? `
            <img
              src="${employeePhoto}"
              alt="${selectedEmployee.name}"
              style="
                width: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                height: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                border-radius: 8px;
                object-fit: cover;
                border: 3px solid ${idCardDesign.primaryColor};
                display: block;
                margin: ${idCardDesign.layout === 'vertical' ? '0 auto' : '0'};
              "
            />
          ` : `
            <div style="
              width: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
              height: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
              border-radius: 8px;
              background: #e5e7eb;
              border: 3px solid ${idCardDesign.primaryColor};
              display: flex;
              align-items: center;
              justify-content: center;
              margin: ${idCardDesign.layout === 'vertical' ? '0 auto' : '0'};
            ">
              <svg width="${idCardDesign.cardSize === 'large' ? '60' : idCardDesign.cardSize === 'compact' ? '40' : '50'}" height="${idCardDesign.cardSize === 'large' ? '60' : idCardDesign.cardSize === 'compact' ? '40' : '50'}" fill="#9ca3af" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          `}
        </div>
      ` : '';

      const logoHtml = idCardDesign.showCompanyLogo && companyLogo ? `
        <img
          src="${companyLogo}"
          alt="Company Logo"
          style="max-width: 120px; max-height: 60px; object-fit: contain; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;"
        />
      ` : '';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Employee ID Card - ${selectedEmployee.name}</title>
            <style>
              @page {
                size: ${idCardDesign.cardSize === 'large' ? 'A4 landscape' : idCardDesign.cardSize === 'compact' ? 'A6' : 'A7'};
                margin: 0.5cm;
              }
              body {
                margin: 0;
                padding: 20px;
                font-family: ${idCardDesign.fontFamily}, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: #f5f5f5;
              }
              .id-card-print {
                background: ${idCardDesign.backgroundColor};
                border: ${idCardDesign.borderWidth}px ${idCardDesign.borderStyle} ${idCardDesign.borderColor};
                border-radius: 12px;
                padding: ${idCardDesign.cardSize === 'large' ? '30px' : idCardDesign.cardSize === 'compact' ? '15px' : '20px'};
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: ${idCardDesign.layout === 'horizontal' ? '600px' : '400px'};
                width: 100%;
              }
              .id-card-header {
                background: linear-gradient(135deg, ${idCardDesign.primaryColor} 0%, ${idCardDesign.secondaryColor} 100%);
                color: white;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
              }
              .id-card-body {
                display: ${idCardDesign.layout === 'horizontal' ? 'flex' : 'block'};
                gap: 20px;
                align-items: ${idCardDesign.layout === 'horizontal' ? 'center' : 'stretch'};
              }
              .id-card-photo-container {
                ${idCardDesign.layout === 'vertical' ? 'display: flex; justify-content: center; margin-bottom: 20px; width: 100%;' : 'flex-shrink: 0;'}
              }
              .id-card-photo {
                width: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                height: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                border-radius: 8px;
                object-fit: cover;
                border: 3px solid ${idCardDesign.primaryColor};
                ${idCardDesign.layout === 'vertical' ? 'display: block; margin: 0 auto;' : 'flex-shrink: 0;'}
              }
              .id-card-info {
                flex: 1;
                color: ${idCardDesign.textColor};
                ${idCardDesign.layout === 'vertical' ? 'text-align: center;' : ''}
              }
              .id-card-name {
                ${idCardDesign.layout === 'vertical' ? 'text-align: center;' : ''}
              }
              .id-card-name {
                font-size: ${idCardDesign.fontSize === 'large' ? '24px' : idCardDesign.fontSize === 'small' ? '18px' : '20px'};
                font-weight: bold;
                margin-bottom: 10px;
                color: ${idCardDesign.primaryColor};
              }
              .id-card-detail {
                margin: 8px 0;
                font-size: ${idCardDesign.fontSize === 'large' ? '14px' : idCardDesign.fontSize === 'small' ? '12px' : '13px'};
              }
              .id-card-label {
                font-weight: 600;
                color: ${idCardDesign.textColor};
                opacity: 0.7;
              }
              .id-card-value {
                color: ${idCardDesign.textColor};
              }
              .id-card-footer {
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid ${idCardDesign.borderColor};
                text-align: center;
                font-size: 12px;
                color: ${idCardDesign.textColor};
                opacity: 0.6;
              }
              .company-logo {
                max-width: 120px;
                max-height: 60px;
                object-fit: contain;
                margin-bottom: 10px;
              }
              @media print {
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                body {
                  background: white !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .id-card-print {
                  box-shadow: none !important;
                  page-break-inside: avoid;
                  margin: 0 auto !important;
                  max-width: 100% !important;
                }
                .id-card-header {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  background: linear-gradient(135deg, ${idCardDesign.primaryColor} 0%, ${idCardDesign.secondaryColor} 100%) !important;
                }
                .id-card-photo {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .id-card-body {
                  ${idCardDesign.layout === 'vertical' ? 'text-align: center;' : ''}
                }
              }
            </style>
          </head>
          <body>
            <div class="id-card-print" style="
              background: ${idCardDesign.backgroundColor};
              border: ${idCardDesign.borderWidth}px ${idCardDesign.borderStyle} ${idCardDesign.borderColor};
              border-radius: 12px;
              padding: ${idCardDesign.cardSize === 'large' ? '30px' : idCardDesign.cardSize === 'compact' ? '15px' : '20px'};
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              max-width: ${idCardDesign.layout === 'horizontal' ? '600px' : '400px'};
              width: 100%;
              font-family: ${idCardDesign.fontFamily || 'Arial'}, sans-serif;
            ">
              <!-- Header -->
              <div class="id-card-header" style="
                background: linear-gradient(135deg, ${idCardDesign.primaryColor} 0%, ${idCardDesign.secondaryColor} 100%);
                color: white;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
              ">
                ${idCardDesign.showCompanyLogo && companyLogo ? `
                  <img
                    src="${companyLogo}"
                    alt="Company Logo"
                    style="max-width: 120px; max-height: 60px; object-fit: contain; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;"
                  />
                ` : ''}
                <h2 style="font-size: 20px; font-weight: bold; margin: 0;">${tenantInfo?.name || 'Company Name'}</h2>
                <p style="font-size: 14px; opacity: 0.9; margin: 5px 0 0 0;">Employee Identification Card</p>
              </div>

              <!-- Body -->
              <div class="id-card-body" style="
                display: ${idCardDesign.layout === 'horizontal' ? 'flex' : 'block'};
                gap: ${idCardDesign.layout === 'horizontal' ? '20px' : '0'};
                align-items: ${idCardDesign.layout === 'horizontal' ? 'center' : 'stretch'};
              ">
                ${idCardDesign.showEmployeePhoto ? `
                  <div style="
                    display: ${idCardDesign.layout === 'vertical' ? 'flex' : 'block'};
                    justify-content: ${idCardDesign.layout === 'vertical' ? 'center' : 'flex-start'};
                    align-items: ${idCardDesign.layout === 'vertical' ? 'center' : 'flex-start'};
                    width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                    margin-bottom: ${idCardDesign.layout === 'vertical' ? '20px' : '0'};
                    ${idCardDesign.layout === 'horizontal' ? 'flex-shrink: 0;' : ''}
                  ">
                    ${employeePhoto ? `
                      <img
                        src="${employeePhoto}"
                        alt="${selectedEmployee.name}"
                        style="
                          width: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                          height: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                          border-radius: 8px;
                          object-fit: cover;
                          border: 3px solid ${idCardDesign.primaryColor};
                          display: block;
                          margin: ${idCardDesign.layout === 'vertical' ? '0 auto' : '0'};
                        "
                      />
                    ` : `
                      <div style="
                        width: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                        height: ${idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px'};
                        border-radius: 8px;
                        background: #e5e7eb;
                        border: 3px solid ${idCardDesign.primaryColor};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: ${idCardDesign.layout === 'vertical' ? '0 auto' : '0'};
                      ">
                        <svg width="${idCardDesign.cardSize === 'large' ? '60' : idCardDesign.cardSize === 'compact' ? '40' : '50'}" height="${idCardDesign.cardSize === 'large' ? '60' : idCardDesign.cardSize === 'compact' ? '40' : '50'}" fill="#9ca3af" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    `}
                  </div>
                ` : ''}
                
                <!-- Info -->
                <div class="id-card-info" style="
                  flex: ${idCardDesign.layout === 'horizontal' ? '1' : 'none'};
                  color: ${idCardDesign.textColor};
                  width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                  text-align: ${idCardDesign.layout === 'vertical' ? 'center' : 'left'};
                ">
                  <div class="id-card-name" style="
                    font-size: ${idCardDesign.fontSize === 'large' ? '24px' : idCardDesign.fontSize === 'small' ? '18px' : '20px'};
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: ${idCardDesign.primaryColor};
                    text-align: ${idCardDesign.layout === 'vertical' ? 'center' : 'left'};
                  ">
                    ${selectedEmployee.name}
                  </div>
                  <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    align-items: ${idCardDesign.layout === 'vertical' ? 'center' : 'flex-start'};
                    width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                  ">
                    <div class="id-card-detail" style="
                      margin: 0;
                      font-size: ${idCardDesign.fontSize === 'large' ? '14px' : idCardDesign.fontSize === 'small' ? '12px' : '13px'};
                      text-align: ${idCardDesign.layout === 'vertical' ? 'center' : 'left'};
                      width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                    ">
                      <span class="id-card-label" style="font-weight: 600; color: ${idCardDesign.textColor}; opacity: 0.7;">Employee ID: </span>
                      <span class="id-card-value" style="color: ${idCardDesign.textColor};">${selectedEmployee.employeeId || selectedEmployee.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <div class="id-card-detail" style="
                      margin: 0;
                      font-size: ${idCardDesign.fontSize === 'large' ? '14px' : idCardDesign.fontSize === 'small' ? '12px' : '13px'};
                      text-align: ${idCardDesign.layout === 'vertical' ? 'center' : 'left'};
                      width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                    ">
                      <span class="id-card-label" style="font-weight: 600; color: ${idCardDesign.textColor}; opacity: 0.7;">Position: </span>
                      <span class="id-card-value" style="color: ${idCardDesign.textColor};">${selectedEmployee.jobTitle || selectedEmployee.position || 'N/A'}</span>
                    </div>
                    <div class="id-card-detail" style="
                      margin: 0;
                      font-size: ${idCardDesign.fontSize === 'large' ? '14px' : idCardDesign.fontSize === 'small' ? '12px' : '13px'};
                      text-align: ${idCardDesign.layout === 'vertical' ? 'center' : 'left'};
                      width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                    ">
                      <span class="id-card-label" style="font-weight: 600; color: ${idCardDesign.textColor}; opacity: 0.7;">Department: </span>
                      <span class="id-card-value" style="color: ${idCardDesign.textColor};">${selectedEmployee.department || 'N/A'}</span>
                    </div>
                    <div class="id-card-detail" style="
                      margin: 0;
                      font-size: ${idCardDesign.fontSize === 'large' ? '14px' : idCardDesign.fontSize === 'small' ? '12px' : '13px'};
                      text-align: ${idCardDesign.layout === 'vertical' ? 'center' : 'left'};
                      width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                    ">
                      <span class="id-card-label" style="font-weight: 600; color: ${idCardDesign.textColor}; opacity: 0.7;">Start Date: </span>
                      <span class="id-card-value" style="color: ${idCardDesign.textColor};">${formatDate(selectedEmployee.startDate)}</span>
                    </div>
                    ${selectedEmployee.email ? `
                      <div class="id-card-detail" style="
                        margin: 0;
                        font-size: ${idCardDesign.fontSize === 'large' ? '14px' : idCardDesign.fontSize === 'small' ? '12px' : '13px'};
                        text-align: ${idCardDesign.layout === 'vertical' ? 'center' : 'left'};
                        width: ${idCardDesign.layout === 'vertical' ? '100%' : 'auto'};
                      ">
                        <span class="id-card-label" style="font-weight: 600; color: ${idCardDesign.textColor}; opacity: 0.7;">Email: </span>
                        <span class="id-card-value" style="color: ${idCardDesign.textColor};">${selectedEmployee.email}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="id-card-footer" style="
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid ${idCardDesign.borderColor};
                text-align: center;
                font-size: 12px;
                color: ${idCardDesign.textColor};
                opacity: 0.6;
              ">
                <p style="margin: 0;">This card is the property of ${tenantInfo?.name || 'Company'}</p>
                <p style="margin: 5px 0 0 0;">Issued: ${formatDate(new Date())}</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User size={24} />
            <h2 className="text-xl font-bold">Employee ID Card Generator</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Settings */}
            <div className="lg:col-span-1 space-y-6">
              {/* Employee Selection */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User size={18} />
                  Select Employee
                </h3>
                <select
                  value={selectedEmployee?.id || ''}
                  onChange={(e) => {
                    const employee = employees.find(emp => emp.id === e.target.value);
                    handleEmployeeSelect(employee);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose an employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {emp.employeeId || emp.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Upload */}
              {selectedEmployee && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ImageIcon size={18} />
                    Employee Photo
                  </h3>
                  <div className="space-y-3">
                    {employeePhoto ? (
                      <div className="relative">
                        <img
                          src={employeePhoto}
                          alt={selectedEmployee.name}
                          className="w-full h-48 object-cover rounded-md border-2 border-gray-300"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2 w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
                          disabled={isUploadingPhoto}
                        >
                          <Upload size={16} />
                          {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-3" />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
                          disabled={isUploadingPhoto}
                        >
                          <Upload size={16} />
                          {isUploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* Company Logo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 size={18} />
                  Company Logo
                </h3>
                <div className="space-y-3">
                  {companyLogo ? (
                    <div className="relative">
                      <img
                        src={companyLogo}
                        alt="Company Logo"
                        className="w-full max-h-32 object-contain rounded-md border-2 border-gray-300 bg-white p-2"
                      />
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="mt-2 w-full px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center justify-center gap-2"
                        disabled={isUploadingLogo}
                      >
                        <Upload size={16} />
                        {isUploadingLogo ? 'Uploading...' : 'Change Logo'}
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                      <Building2 size={32} className="mx-auto text-gray-400 mb-2" />
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2 mx-auto"
                        disabled={isUploadingLogo}
                      >
                        <Upload size={16} />
                        {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </button>
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Design Settings */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Palette size={18} />
                  Design Settings
                </h3>
                <div className="space-y-4">
                  {/* Theme Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(themes).filter(([key]) => key !== 'custom').map(([key, theme]) => (
                        <button
                          key={key}
                          onClick={() => handleThemeChange(key)}
                          className={`p-3 rounded-md border-2 transition-all ${
                            idCardDesign.theme === key
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          style={{
                            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`
                          }}
                          title={theme.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Custom Colors */}
                  {idCardDesign.theme === 'custom' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                        <input
                          type="color"
                          value={idCardDesign.primaryColor}
                          onChange={(e) => setIdCardDesign(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-full h-10 rounded border border-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                        <input
                          type="color"
                          value={idCardDesign.secondaryColor}
                          onChange={(e) => setIdCardDesign(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          className="w-full h-10 rounded border border-gray-300"
                        />
                      </div>
                    </div>
                  )}

                  {/* Layout */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Layout</label>
                    <select
                      value={idCardDesign.layout}
                      onChange={(e) => setIdCardDesign(prev => ({ ...prev, layout: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                  </div>

                  {/* Card Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Size</label>
                    <select
                      value={idCardDesign.cardSize}
                      onChange={(e) => setIdCardDesign(prev => ({ ...prev, cardSize: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="standard">Standard</option>
                      <option value="compact">Compact</option>
                      <option value="large">Large</option>
                    </select>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
                    <select
                      value={idCardDesign.fontSize}
                      onChange={(e) => setIdCardDesign(prev => ({ ...prev, fontSize: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={idCardDesign.showEmployeePhoto}
                        onChange={(e) => setIdCardDesign(prev => ({ ...prev, showEmployeePhoto: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show Employee Photo</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={idCardDesign.showCompanyLogo}
                        onChange={(e) => setIdCardDesign(prev => ({ ...prev, showCompanyLogo: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show Company Logo</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Eye size={18} />
                    Preview
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrint}
                      disabled={!selectedEmployee}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Printer size={18} />
                      Print
                    </button>
                  </div>
                </div>

                {selectedEmployee ? (
                  <div
                    ref={printRef}
                    className="id-card-print bg-white rounded-lg shadow-lg p-6 mx-auto"
                    style={{
                      maxWidth: idCardDesign.layout === 'horizontal' ? '600px' : '400px',
                      background: idCardDesign.backgroundColor,
                      border: `${idCardDesign.borderWidth}px ${idCardDesign.borderStyle} ${idCardDesign.borderColor}`,
                      fontFamily: idCardDesign.fontFamily
                    }}
                  >
                    {/* Header */}
                    <div
                      className="id-card-header text-white p-4 rounded-lg mb-4 text-center"
                      style={{
                        background: `linear-gradient(135deg, ${idCardDesign.primaryColor} 0%, ${idCardDesign.secondaryColor} 100%)`
                      }}
                    >
                      {idCardDesign.showCompanyLogo && companyLogo && (
                        <img
                          src={companyLogo}
                          alt="Company Logo"
                          className="company-logo mx-auto mb-2"
                        />
                      )}
                      <h2 className="text-xl font-bold">
                        {tenantInfo?.name || 'Company Name'}
                      </h2>
                      <p className="text-sm opacity-90">Employee Identification Card</p>
                    </div>

                    {/* Body */}
                    <div
                      className={`id-card-body ${idCardDesign.layout === 'horizontal' ? 'flex items-center gap-6' : 'block'}`}
                    >
                      {/* Photo */}
                      {idCardDesign.showEmployeePhoto && (
                        <div className={idCardDesign.layout === 'vertical' ? 'flex justify-center mb-5' : 'flex-shrink-0'}>
                          {employeePhoto ? (
                            <img
                              src={employeePhoto}
                              alt={selectedEmployee.name}
                              className="id-card-photo rounded-lg object-cover"
                              style={{
                                width: idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px',
                                height: idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px',
                                border: `3px solid ${idCardDesign.primaryColor}`,
                                display: idCardDesign.layout === 'vertical' ? 'block' : 'block',
                                margin: idCardDesign.layout === 'vertical' ? '0 auto' : '0'
                              }}
                            />
                          ) : (
                            <div
                              className="id-card-photo rounded-lg bg-gray-200 flex items-center justify-center text-gray-400"
                              style={{
                                width: idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px',
                                height: idCardDesign.cardSize === 'large' ? '150px' : idCardDesign.cardSize === 'compact' ? '80px' : '120px',
                                border: `3px solid ${idCardDesign.primaryColor}`,
                                display: idCardDesign.layout === 'vertical' ? 'block' : 'flex',
                                margin: idCardDesign.layout === 'vertical' ? '0 auto' : '0'
                              }}
                            >
                              <User size={idCardDesign.cardSize === 'large' ? 60 : idCardDesign.cardSize === 'compact' ? 40 : 50} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Info */}
                      <div className="id-card-info flex-1" style={{ color: idCardDesign.textColor }}>
                        <div
                          className="id-card-name mb-3"
                          style={{
                            fontSize: idCardDesign.fontSize === 'large' ? '24px' : idCardDesign.fontSize === 'small' ? '18px' : '20px',
                            color: idCardDesign.primaryColor
                          }}
                        >
                          {selectedEmployee.name}
                        </div>
                        <div className="space-y-2">
                          <div className="id-card-detail">
                            <span className="id-card-label" style={{ color: idCardDesign.textColor, opacity: 0.7 }}>
                              Employee ID: 
                            </span>
                            <span className="id-card-value ml-2" style={{ color: idCardDesign.textColor }}>
                              {selectedEmployee.employeeId || selectedEmployee.id.substring(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <div className="id-card-detail">
                            <span className="id-card-label" style={{ color: idCardDesign.textColor, opacity: 0.7 }}>
                              Position: 
                            </span>
                            <span className="id-card-value ml-2" style={{ color: idCardDesign.textColor }}>
                              {selectedEmployee.jobTitle || selectedEmployee.position || 'N/A'}
                            </span>
                          </div>
                          <div className="id-card-detail">
                            <span className="id-card-label" style={{ color: idCardDesign.textColor, opacity: 0.7 }}>
                              Department: 
                            </span>
                            <span className="id-card-value ml-2" style={{ color: idCardDesign.textColor }}>
                              {selectedEmployee.department || 'N/A'}
                            </span>
                          </div>
                          <div className="id-card-detail">
                            <span className="id-card-label" style={{ color: idCardDesign.textColor, opacity: 0.7 }}>
                              Start Date: 
                            </span>
                            <span className="id-card-value ml-2" style={{ color: idCardDesign.textColor }}>
                              {formatDate(selectedEmployee.startDate)}
                            </span>
                          </div>
                          {selectedEmployee.email && (
                            <div className="id-card-detail">
                              <span className="id-card-label" style={{ color: idCardDesign.textColor, opacity: 0.7 }}>
                                Email: 
                              </span>
                              <span className="id-card-value ml-2" style={{ color: idCardDesign.textColor }}>
                                {selectedEmployee.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div
                      className="id-card-footer mt-4 pt-4 text-center text-xs"
                      style={{
                        borderTop: `1px solid ${idCardDesign.borderColor}`,
                        color: idCardDesign.textColor,
                        opacity: 0.6
                      }}
                    >
                      <p>This card is the property of {tenantInfo?.name || 'Company'}</p>
                      <p className="mt-1">Issued: {formatDate(new Date())}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
                    <User size={64} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Please select an employee to generate an ID card</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeIDCardGenerator;


"use client";

import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';

const BulkInventoryOperations = ({ isOpen, onClose, onUpload, onExport, showToast }) => {
  const [uploadMode, setUploadMode] = useState('upload'); // 'upload' or 'export'
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  // Parse CSV content with proper handling of quoted fields
  const parseCSV = (csvContent) => {
    const lines = csvContent.split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    // Helper function to parse a CSV line properly handling quoted fields
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote inside quoted field
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Add the last field
      result.push(current.trim());
      
      return result;
    };

    // Parse header row
    const headers = parseCSVLine(lines[0]).map(header => 
      header.trim().replace(/^"|"$/g, '').toLowerCase()
    );

    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Parse CSV line properly
      const values = parseCSVLine(line).map(value => 
        value.replace(/^"|"$/g, '').trim()
      );

      // Handle cases where row has more or fewer columns than headers
      // Pad with empty strings if fewer, truncate if more
      const paddedValues = [...values];
      while (paddedValues.length < headers.length) {
        paddedValues.push('');
      }
      const finalValues = paddedValues.slice(0, headers.length);

      const row = {};
      headers.forEach((header, index) => {
        let value = finalValues[index] || '';
        
        // Convert numeric values based on field type
        if (['price', 'cost', 'weight', 'discountamount'].includes(header)) {
          value = parseFloat(value) || 0;
        }
        
        // Convert integer values
        if (['stocklevel', 'reorderpoint'].includes(header)) {
          value = parseInt(value) || 0;
        }
        
        // Convert boolean values
        if (header === 'isperishable') {
          value = value.toLowerCase() === 'true';
        }
        
        // Map header names to expected field names
        const fieldMap = {
          'product name*': 'name',
          'name': 'name',
          'sku*': 'sku',
          'sku': 'sku',
          'category*': 'category',
          'category': 'category',
          'description': 'description',
          'price*': 'price',
          'price': 'price',
          'cost': 'cost',
          'stock level*': 'stockLevel',
          'stocklevel': 'stockLevel',
          'reorder point': 'reorderPoint',
          'reorderpoint': 'reorderPoint',
          'location': 'location',
          'supplier': 'supplier',
          'is perishable (true/false)': 'isPerishable',
          'isperishable': 'isPerishable',
          'expiry date (yyyy-mm-dd)': 'expiryDate',
          'expirydate': 'expiryDate',
          'discount amount': 'discountAmount',
          'discountamount': 'discountAmount',
          'weight (kg)': 'weight',
          'weight': 'weight',
          'dimensions (lxwxh)': 'dimensions',
          'dimensions': 'dimensions',
          'barcode': 'barcode',
          'tags (comma-separated)': 'tags',
          'tags': 'tags'
        };

        const fieldName = fieldMap[header] || header;
        row[fieldName] = value;
      });

      data.push(row);
    }

    return data;
  };

  // Parse Excel file
  const parseExcel = async (file) => {
    try {
      const XLSX = await import('xlsx');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length < 2) {
              throw new Error('Excel file must have at least a header row and one data row');
            }

            // Convert to the same format as CSV parsing
            const headers = jsonData[0].map(header => 
              String(header).trim().toLowerCase()
            );

            const data = [];
            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.every(cell => !cell)) continue; // Skip empty rows

              const rowData = {};
              headers.forEach((header, index) => {
                let value = row[index] || '';
                
                // Convert numeric values based on field type
                if (['price', 'cost', 'weight', 'discountamount'].includes(header)) {
                  value = parseFloat(value) || 0;
                }
                
                // Convert integer values
                if (['stocklevel', 'reorderpoint'].includes(header)) {
                  value = parseInt(value) || 0;
                }
                
                // Convert boolean values
                if (header === 'isperishable') {
                  value = String(value).toLowerCase() === 'true';
                }
                
                // Map header names to expected field names
                const fieldMap = {
                  'product name*': 'name',
                  'name': 'name',
                  'sku*': 'sku',
                  'sku': 'sku',
                  'category*': 'category',
                  'category': 'category',
                  'description': 'description',
                  'price*': 'price',
                  'price': 'price',
                  'cost': 'cost',
                  'stock level*': 'stockLevel',
                  'stocklevel': 'stockLevel',
                  'reorder point': 'reorderPoint',
                  'reorderpoint': 'reorderPoint',
                  'location': 'location',
                  'supplier': 'supplier',
                  'is perishable (true/false)': 'isPerishable',
                  'isperishable': 'isPerishable',
                  'expiry date (yyyy-mm-dd)': 'expiryDate',
                  'expirydate': 'expiryDate',
                  'discount amount': 'discountAmount',
                  'discountamount': 'discountAmount',
                  'weight (kg)': 'weight',
                  'weight': 'weight',
                  'dimensions (lxwxh)': 'dimensions',
                  'dimensions': 'dimensions',
                  'barcode': 'barcode',
                  'tags (comma-separated)': 'tags',
                  'tags': 'tags'
                };

                const fieldName = fieldMap[header] || header;
                rowData[fieldName] = value;
              });

              data.push(rowData);
            }

            resolve(data);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
      });

      return data;
    } catch (error) {
      throw new Error(`Error parsing Excel file: ${error.message}`);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    if (!validTypes.includes(file.type)) {
      showToast('error', 'Invalid file type', 'Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'File too large', 'Please upload a file smaller than 5MB');
      return;
    }

    setUploadedFile(file);
    processFile(file);
  };

  // Process uploaded file
  const processFile = async (file) => {
    try {
      setIsProcessing(true);
      setErrors([]);

      let parsedData = [];

      if (file.type === 'text/csv') {
        // Parse CSV file
        const text = await file.text();
        parsedData = parseCSV(text);
      } else {
        // Parse Excel file
        parsedData = await parseExcel(file);
      }

      // Validate parsed data
      const validationErrors = [];
      parsedData.forEach((row, index) => {
        if (!row.name || !row.sku || !row.category || !row.price) {
          validationErrors.push(`Row ${index + 2}: Missing required fields (name, sku, category, price)`);
        }
        
        if (row.price && (isNaN(row.price) || row.price <= 0)) {
          validationErrors.push(`Row ${index + 2}: Invalid price value`);
        }
        
        if (row.stockLevel && (isNaN(row.stockLevel) || row.stockLevel < 0)) {
          validationErrors.push(`Row ${index + 2}: Invalid stock level value`);
        }
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        showToast('error', 'Validation errors found', `Found ${validationErrors.length} errors in the file`);
      } else {
        setPreviewData(parsedData);
        showToast('success', 'File processed successfully', `Found ${parsedData.length} products`);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      showToast('error', 'Error processing file', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (!uploadedFile || previewData.length === 0) {
      showToast('error', 'No data to upload', 'Please upload a valid file first');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Products apply to the whole business (all locations); no per-location assignment in bulk upload.
      await onUpload(previewData);
      
      showToast('success', 'Bulk upload completed', `${previewData.length} products uploaded successfully`);
      onClose();
      // Reset form
      setUploadedFile(null);
      setPreviewData([]);
      setErrors([]);
    } catch (error) {
      console.error('Error during bulk upload:', error);
      showToast('error', 'Upload failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      setIsProcessing(true);
      
      // Call the parent component's export handler
      await onExport();
      
      showToast('success', 'Export completed', 'Inventory data exported successfully');
      onClose();
    } catch (error) {
      console.error('Error during export:', error);
      showToast('error', 'Export failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const templateData = [
      {
        name: 'Product Name*',
        sku: 'SKU*',
        category: 'Category*',
        description: 'Description',
        price: 'Price*',
        cost: 'Cost',
        stockLevel: 'Stock Level*',
        reorderPoint: 'Reorder Point',
        location: 'Location',
        supplier: 'Supplier',
        isPerishable: 'Is Perishable (true/false)',
        expiryDate: 'Expiry Date (YYYY-MM-DD)',
        discountAmount: 'Discount Amount',
        weight: 'Weight (kg)',
        dimensions: 'Dimensions (LxWxH)',
        barcode: 'Barcode',
        tags: 'Tags (comma-separated)'
      }
    ];

    // Convert to CSV
    const csvContent = templateData.map(row => 
      Object.values(row).map(value => `"${value}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeInUp">
        <div className="p-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Bulk Inventory Operations</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              onClick={onClose}
              type="button"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {/* Mode Selection */}
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setUploadMode('upload')}
              className={`px-4 py-2 rounded-md transition-colors ${
                uploadMode === 'upload' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Upload size={16} className="inline mr-2" />
              Bulk Upload
            </button>
            <button
              onClick={() => setUploadMode('export')}
              className={`px-4 py-2 rounded-md transition-colors ${
                uploadMode === 'export' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Download size={16} className="inline mr-2" />
              Export Data
            </button>
          </div>

          {uploadMode === 'upload' ? (
            /* Upload Mode */
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Bulk Upload Instructions</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Upload Excel (.xlsx, .xls) or CSV files</li>
                  <li>• Maximum file size: 5MB</li>
                  <li>• Required fields: Name, SKU, Category, Price, Stock Level</li>
                  <li>• Download the template below for the correct format</li>
                  <li>• New products apply across your whole business (all locations)</li>
                </ul>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <FileSpreadsheet size={16} className="mr-2" />
                  Download Template
                </button>
              </div>

              {/* File Upload Area */}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-gray-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadedFile ? (
                  <div>
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                    <p className="text-lg font-medium text-gray-800">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-800">Click to upload file</p>
                    <p className="text-sm text-gray-500">Excel or CSV files only</p>
                  </div>
                )}
                
                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Preview Data */}
              {previewData.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-3">Preview ({previewData.length} products)</h3>
                  <div className="bg-gray-50 rounded-lg p-4 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2">Name</th>
                          <th className="text-left py-2">SKU</th>
                          <th className="text-left py-2">Category</th>
                          <th className="text-left py-2">Price</th>
                          <th className="text-left py-2">Cost</th>
                          <th className="text-left py-2">Stock</th>
                          <th className="text-left py-2">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2 font-medium">{item.name || 'N/A'}</td>
                            <td className="py-2 text-gray-600">{item.sku || 'N/A'}</td>
                            <td className="py-2 text-gray-600">{item.category || 'N/A'}</td>
                            <td className="py-2 font-medium">${item.price ? Number(item.price).toFixed(2) : 'N/A'}</td>
                            <td className="py-2 text-gray-600">${item.cost ? Number(item.cost).toFixed(2) : 'N/A'}</td>
                            <td className="py-2 text-gray-600">{item.stockLevel || 'N/A'}</td>
                            <td className="py-2 text-gray-600">{item.location || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-medium text-red-800 mb-2 flex items-center">
                    <AlertCircle size={16} className="mr-2" />
                    Validation Errors ({errors.length})
                  </h3>
                  <div className="text-sm text-red-700 space-y-1 overflow-y-auto">
                    {errors.map((error, index) => (
                      <div key={index} className="flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Export Mode */
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2">Export Options</h3>
                <p className="text-sm text-green-700">
                  Export your current inventory data to Excel or CSV format for backup or analysis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={isProcessing}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet size={32} className="mx-auto mb-2 text-green-600" />
                  <p className="font-medium">Export to Excel</p>
                  <p className="text-sm text-gray-500">.xlsx format</p>
                </button>

                <button
                  onClick={() => handleExport('csv')}
                  disabled={isProcessing}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Download size={32} className="mx-auto mb-2 text-blue-600" />
                  <p className="font-medium">Export to CSV</p>
                  <p className="text-sm text-gray-500">.csv format</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          
          {uploadMode === 'upload' && uploadedFile && (
            <button
              type="button"
              onClick={handleBulkUpload}
              disabled={isProcessing || errors.length > 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-1" />
                  Upload {previewData.length} Products
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkInventoryOperations; 
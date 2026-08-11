const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, 'components', 'BulkStockOperations.js');
const content = `'use client';

import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  DocumentArrowUpIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

/**
 * Bulk Stock Operations Component
 * Handles CSV import/export for stock items
 */

const TEMPLATE_HEADERS = [
  'Product Name*',
  'Category*',
  'Order Price',
  'Selling Price*',
  'Quantity*'
];

export default function BulkStockOperations({ isOpen, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('import');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  const downloadTemplate = () => {
    const sampleData = [
      ['Wireless Mouse', 'Electronics', '15.00', '25.00', '50'],
      ['Office Chair', 'Furniture', '120.00', '199.99', '10'],
      ['Notebook A5', 'Stationery', '2.50', '5.00', '100']
    ];

    const csvContent = [
      TEMPLATE_HEADERS.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    setImportResults(null);

    try {
      const text = await selectedFile.text();
      const lines = text.split('\\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('File is empty or has no data rows');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = [];
      const validationErrors = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        const item = {
          row: i + 1,
          name: (values[0] || '').trim(),
          category: (values[1] || '').trim(),
          cost: (values[2] || '').trim(),
          price: (values[3] || '').trim(),
          stockLevel: (values[4] || '').trim()
        };

        const rowErrors = [];
        if (!item.name) rowErrors.push('Product Name is required');
        if (!item.category) rowErrors.push('Category is required');
        if (!item.price || isNaN(parseFloat(item.price))) rowErrors.push('Valid Selling Price is required');
        if (item.cost !== '' && isNaN(parseFloat(item.cost))) rowErrors.push('Order Price must be a valid number');
        if (item.stockLevel === '' || isNaN(parseInt(item.stockLevel, 10))) {
          rowErrors.push('Valid Quantity is required');
        }

        if (rowErrors.length > 0) {
          validationErrors.push({ row: item.row, errors: rowErrors, data: item });
        } else {
          data.push(item);
        }
      }

      setPreview(data.slice(0, 10));
      setErrors(validationErrors);
      
      if (validationErrors.length > 0) {
        toast.error(\`Found \${validationErrors.length} rows with errors\`);
      } else {
        toast.success(\`Ready to import \${data.length} items\`);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Failed to parse CSV file');
    }
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleImport = async () => {
    if (!file || errors.length > 0) {
      toast.error('Please fix all errors before importing');
      return;
    }

    setIsProcessing(true);
    const results = { success: 0, failed: 0, errors: [] };

    try {
      const text = await file.text();
      const lines = text.split('\\n').filter(line => line.trim());
      const items = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        const name = (values[0] || '').trim();
        const category = (values[1] || '').trim();
        const cost = (values[2] || '').trim();
        const price = (values[3] || '').trim();
        const stockLevel = (values[4] || '').trim();

        if (!name || !category || !price || stockLevel === '') continue;

        items.push({
          name,
          category,
          cost: cost !== '' && !isNaN(parseFloat(cost)) ? parseFloat(cost) : null,
          price: parseFloat(price),
          stockLevel: parseInt(stockLevel, 10) || 0,
          lowStockThreshold: 10,
          description: '',
          unit: 'pcs',
          location: '',
          supplier: '',
          barcode: ''
        });
      }

      for (const item of items) {
        try {
          const response = await fetch('/api/stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(item)
          });

          if (response.ok) {
            results.success++;
          } else {
            const error = await response.json();
            results.failed++;
            results.errors.push({ name: item.name, error: error.error || 'Failed to create' });
          }
        } catch (err) {
          results.failed++;
          results.errors.push({ name: item.name, error: err.message });
        }
      }

      setImportResults(results);
      
      if (results.success > 0) {
        toast.success(\`Successfully imported \${results.success} items\`);
        if (onSuccess) onSuccess();
      }
      if (results.failed > 0) {
        toast.error(\`Failed to import \${results.failed} items\`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/stock?limit=1000', {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to fetch stock');
      
      const data = await response.json();
      const items = data.items || [];

      if (items.length === 0) {
        toast.error('No stock items to export');
        return;
      }

      const headers = ['Product Name', 'Category', 'Order Price', 'Selling Price', 'Quantity', 'SKU', 'Status'];
      const rows = items.map(item => [
        \`"\${item.name || ''}"\`,
        \`"\${item.category || ''}"\`,
        item.cost || '',
        item.price || '',
        item.stockLevel || 0,
        \`"\${item.sku || ''}"\`,
        item.isActive ? 'Active' : 'Inactive'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`stock_export_\${new Date().toISOString().split('T')[0]}.csv\`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(\`Exported \${items.length} items\`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export stock');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Bulk Stock Operations</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('import')}
                className={\`px-6 py-3 text-sm font-medium border-b-2 \${
                  activeTab === 'import'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }\`}
              >
                <DocumentArrowUpIcon className="inline w-5 h-5 mr-2" />
                Import
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={\`px-6 py-3 text-sm font-medium border-b-2 \${
                  activeTab === 'export'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }\`}
              >
                <DocumentArrowDownIcon className="inline w-5 h-5 mr-2" />
                Export
              </button>
            </nav>
          </div>

          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {activeTab === 'import' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Import Instructions</h4>
                  <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                    <li>Download the CSV template below</li>
                    <li>Fill in your stock data (required fields marked with *)</li>
                    <li>Upload the completed CSV file</li>
                    <li>Review the preview and fix any errors</li>
                    <li>Click Import to add the items</li>
                  </ol>
                  <p className="mt-3 text-sm text-blue-800">
                    Columns: Product Name*, Category*, Order Price, Selling Price*, Quantity*
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                    Download Template
                  </button>
                  
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                    >
                      <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
                      Select CSV File
                    </label>
                  </div>

                  {file && (
                    <button
                      onClick={resetForm}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {file && (
                  <div className="text-sm text-gray-600">
                    Selected: <span className="font-medium">{file.name}</span>
                  </div>
                )}

                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
                      <h4 className="font-medium text-red-900">Validation Errors ({errors.length})</h4>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {errors.slice(0, 10).map((error, idx) => (
                        <div key={idx} className="text-sm text-red-700 mb-1">
                          Row {error.row}: {error.errors.join(', ')}
                        </div>
                      ))}
                      {errors.length > 10 && (
                        <div className="text-sm text-red-600">...and {errors.length - 10} more errors</div>
                      )}
                    </div>
                  </div>
                )}

                {preview.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Preview (first 10 rows)</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Order Price</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Selling Price</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {preview.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-sm text-gray-900">{item.name}</td>
                              <td className="px-3 py-2 text-sm text-gray-500">{item.category}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{item.cost || '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{item.price}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{item.stockLevel}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importResults && (
                  <div className={\`border rounded-lg p-4 \${
                    importResults.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                  }\`}>
                    <div className="flex items-center mb-2">
                      <CheckCircleIcon className={\`w-5 h-5 mr-2 \${
                        importResults.failed === 0 ? 'text-green-500' : 'text-yellow-500'
                      }\`} />
                      <h4 className="font-medium">Import Complete</h4>
                    </div>
                    <p className="text-sm">
                      Successfully imported: {importResults.success} | Failed: {importResults.failed}
                    </p>
                    {importResults.errors.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {importResults.errors.map((err, idx) => (
                          <div key={idx} className="text-sm text-red-600">
                            {err.name}: {err.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'export' && (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Export Stock Data</h4>
                  <p className="text-sm text-green-800">
                    Download all your stock items as a CSV file. This can be used as a backup
                    or to make bulk edits and re-import.
                  </p>
                </div>

                <button
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                      Export All Stock Items
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
            {activeTab === 'import' && preview.length > 0 && !importResults && (
              <button
                onClick={handleImport}
                disabled={isProcessing || errors.length > 0}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
                    Import {preview.length > 0 ? 'Items' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
\`;

fs.writeFileSync(out, content, 'utf8');
console.log('Wrote', out, 'bytes', Buffer.byteLength(content));

"use client";

import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Calendar, DollarSign, Tag, Building, Plus, History } from 'lucide-react';

const HistoricalExpenseUpload = ({ onUploadComplete, onSingleExpenseClick }) => {
  const [file, setFile] = useState(null);
  const [migrationBatch, setMigrationBatch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Generate default migration batch name
  const generateBatchName = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return `Historical-Expenses-${dateStr}-${timeStr}`;
  };

  // Parse CSV content for preview
  const parseCSVPreview = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;

    // Parse header
    const header = lines[0].split(',').map(col => col.replace(/"/g, '').trim());
    
    // Parse first few data rows for preview
    const previewRows = lines.slice(1, 6).map((line, index) => {
      const values = line.split(',').map(val => val.replace(/"/g, '').trim());
      return {
        rowNumber: index + 2,
        values: values
      };
    });

    return {
      headers: header,
      previewRows: previewRows,
      totalRows: lines.length - 1
    };
  };

  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
      if (!migrationBatch) {
        setMigrationBatch(generateBatchName());
      }
      setUploadResults(null);
      setValidationErrors([]);
      setUploadError(null);
      setCsvPreview(null);

      // Read and preview CSV content
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target.result;
        const preview = parseCSVPreview(csvText);
        setCsvPreview(preview);
      };
      reader.readAsText(selectedFile);
    } else {
      setUploadError('Please select a valid CSV file.');
    }
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Download CSV template
  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/historical-expenses/template');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'historical-expenses-template.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to download template');
      }
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!file || !migrationBatch.trim()) {
      alert('Please select a file and enter a migration batch name.');
      return;
    }

    setIsUploading(true);
    setUploadResults(null);
    setValidationErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('migrationBatch', migrationBatch.trim());

      const response = await fetch('/api/historical-expenses/batch-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUploadResults(result);
        setFile(null);
        setMigrationBatch('');
        if (onUploadComplete) {
          onUploadComplete(result);
        }
      } else {
        if (result.errors) {
          setValidationErrors(result.errors);
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Upload failed. Please check your file and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFile(null);
    setMigrationBatch('');
    setUploadResults(null);
    setValidationErrors([]);
    setCsvPreview(null);
    setUploadError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            Historical Expense Import
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Import historical expenses from CSV file or add individual historical expenses
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onSingleExpenseClick}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Single Expense
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-amber-800">Historical Data Entry</h4>
            <p className="text-sm text-amber-700 mt-1">
              This feature is for importing historical expenses that occurred in the past. 
              All imported expenses will be marked as historical and will affect account balances.
            </p>
            <div className="mt-2 text-xs text-amber-600">
              <strong>Supported date formats:</strong> YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {uploadError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-red-800">Upload Error</h4>
              <p className="text-sm text-red-700 mt-1">{uploadError}</p>
            </div>
            <button
              onClick={() => setUploadError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {!uploadResults && (
        <div className="space-y-6">
          {/* Migration Batch Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Migration Batch Name
            </label>
            <input
              type="text"
              value={migrationBatch}
              onChange={(e) => setMigrationBatch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter a name to identify this import batch"
            />
            <p className="text-xs text-gray-500 mt-1">
              This helps you track and identify different import batches
            </p>
          </div>

          {/* File Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {file ? (
              <div className="space-y-2">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-green-600">
                  {(file.size / 1024).toFixed(1)} KB • Ready to upload
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="text-sm font-medium text-gray-700">
                  Drop your CSV file here, or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  Supports CSV files up to 10MB
                </p>
              </div>
            )}
          </div>

          {/* CSV Preview */}
          {csvPreview && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2 text-blue-600" />
                CSV Preview ({csvPreview.totalRows} rows)
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1 text-left font-medium text-gray-700 border-b">#</th>
                      {csvPreview.headers.map((header, index) => (
                        <th key={index} className="px-2 py-1 text-left font-medium text-gray-700 border-b">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-gray-200">
                        <td className="px-2 py-1 text-gray-500">{row.rowNumber}</td>
                        {row.values.map((value, colIndex) => (
                          <td key={colIndex} className="px-2 py-1 text-gray-900 max-w-32 truncate">
                            {value || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvPreview.totalRows > 5 && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing first 5 rows of {csvPreview.totalRows} total rows
                </p>
              )}
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || !migrationBatch.trim() || isUploading}
              className={`px-6 py-2 rounded-md text-white font-medium transition-colors flex items-center ${
                !file || !migrationBatch.trim() || isUploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Expenses
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="ml-3 w-full">
              <h4 className="text-sm font-medium text-red-800">Validation Errors Found</h4>
              <p className="text-sm text-red-700 mt-1 mb-3">
                Please fix the following errors and try again:
              </p>
              <div className="max-h-60 overflow-y-auto">
                {validationErrors.map((error, index) => (
                  <div key={index} className="bg-white rounded border border-red-200 p-3 mb-2">
                    <p className="text-sm font-medium text-red-800">Row {error.row}:</p>
                    <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
                      {error.errors.map((err, errIndex) => (
                        <li key={errIndex}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setValidationErrors([])}
                className="mt-3 text-sm text-red-600 hover:text-red-700"
              >
                Dismiss errors
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Results */}
      {uploadResults && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="ml-3 w-full">
              <h4 className="text-sm font-medium text-green-800">Import Successful!</h4>
              <p className="text-sm text-green-700 mt-1">
                {uploadResults.message}
              </p>
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded border border-green-200 p-3">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-800">Total Processed</span>
                  </div>
                  <p className="text-lg font-bold text-green-900 mt-1">
                    {uploadResults.totalProcessed}
                  </p>
                </div>
                
                <div className="bg-white rounded border border-green-200 p-3">
                  <div className="flex items-center">
                    <Tag className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-800">Batch ID</span>
                  </div>
                  <p className="text-sm font-mono text-green-900 mt-1 truncate">
                    {uploadResults.migrationBatch}
                  </p>
                </div>
                
                <div className="bg-white rounded border border-green-200 p-3">
                  <div className="flex items-center">
                    <Building className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-800">Status</span>
                  </div>
                  <p className="text-sm font-medium text-green-900 mt-1">
                    Completed
                  </p>
                </div>
              </div>

              <div className="mt-4 flex space-x-3">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  Import More Expenses
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalExpenseUpload;

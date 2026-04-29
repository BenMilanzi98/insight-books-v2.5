// components/ExportMenu.jsx
import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import { downloadCSV, downloadPDF, downloadExcel, prepareExportData } from '@/lib/exportUtils';

/**
 * Export Menu Component for Reports
 * 
 * @param {Object} props
 * @param {string} props.reportType - Type of report
 * @param {Object} props.data - Report data
 * @param {function} props.onExport - Export callback function
 */
export const ExportMenu = ({ reportType, data, onExport }) => {
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Handle export action
  const handleExport = async (format) => {
    if (!data) return;
    
    setExporting(true);
    setExportSuccess(false);
    setExportError(null);
    
    try {
      // If the parent component provided an onExport callback, use it
      if (typeof onExport === 'function') {
        await onExport(format, reportType);
        setExportSuccess(true);
        return;
      }
      
      // Otherwise, handle the export here
      const { data: exportData, headers, title, subtitle, summaryData } = prepareExportData(reportType, data);
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${reportType}-${timestamp}`;
      
      if (format === 'csv') {
        downloadCSV(exportData, headers, `${filename}.csv`);
      } else if (format === 'xlsx') {
        downloadExcel(exportData, headers, 'Report Data', `${filename}.xlsx`);
      } else if (format === 'pdf') {
        downloadPDF({
          title,
          subtitle,
          data: exportData,
          headers,
          summaryData
        }, `${filename}.pdf`);
      }
      
      setExportSuccess(true);
    } catch (error) {
      console.error('Export error:', error);
      setExportError(error.message || 'Failed to export report');
    } finally {
      setExporting(false);
      
      // Clear success message after 2 seconds
      if (exportSuccess) {
        setTimeout(() => {
          setExportSuccess(false);
        }, 2000);
      }
    }
  };

  return (
    <div className="relative">
      <div className="dropdown">
        <button 
          className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center shadow-sm hover:bg-gray-50 text-gray-700 transition-all disabled:opacity-50"
          disabled={exporting || !data}
        >
          <Download size={16} className="mr-2" />
          Export
        </button>
        
        <div className="dropdown-menu hidden group-hover:block absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
          <div className="py-1">
            <button 
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              onClick={() => handleExport('pdf')}
              disabled={exporting}
            >
              <FileText size={16} className="mr-2 text-red-500" />
              Export as PDF
            </button>
            <button 
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              <FileText size={16} className="mr-2 text-green-500" />
              Export as CSV
            </button>
            <button 
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              onClick={() => handleExport('xlsx')}
              disabled={exporting}
            >
              <FileSpreadsheet size={16} className="mr-2 text-blue-500" />
              Export as Excel
            </button>
          </div>
        </div>
      </div>
      
      {exportSuccess && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-green-100 text-green-800 rounded-md text-sm flex items-center">
          <Check size={16} className="mr-1" />
          Export successful!
        </div>
      )}
      
      {exportError && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-red-100 text-red-800 rounded-md text-sm flex items-center">
          <AlertCircle size={16} className="mr-1" />
          {exportError}
        </div>
      )}
    </div>
  );
};

/**
 * Export a report with the specified format
 * @param {string} reportType - Type of report
 * @param {Object} data - Report data
 * @param {string} format - Export format (pdf, csv, xlsx)
 * @returns {Promise} Promise that resolves when export is complete
 */
export const exportReport = async (reportType, data, format) => {
  try {
    const { data: exportData, headers, title, subtitle, summaryData } = prepareExportData(reportType, data);
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}-${timestamp}`;
    
    if (format === 'csv') {
      downloadCSV(exportData, headers, `${filename}.csv`);
    } else if (format === 'xlsx') {
      downloadExcel(exportData, headers, 'Report Data', `${filename}.xlsx`);
    } else if (format === 'pdf') {
      downloadPDF({
        title,
        subtitle,
        data: exportData,
        headers,
        summaryData
      }, `${filename}.pdf`);
    }
    
    return true;
  } catch (error) {
    console.error('Export error:', error);
    throw new Error('Failed to export report');
  }
};

// Enhanced version of FinancialReport.jsx with export functionality
import { 
  RefreshCw, 
  Calendar,
  ChevronDown,
  Loader2
} from 'lucide-react';

/**
 * Generic FinancialReport component that displays a report with a header and content
 */
export const EnhancedFinancialReport = ({ 
  title, 
  subtitle, 
  timeframe, 
  onTimeframeChange, 
  onRefresh, 
  onExport,
  loading,
  error,
  children,
  reportType,
  data
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="mb-4 sm:mb-0">
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {timeframe && onTimeframeChange && (
              <div className="relative">
                <select 
                  className="appearance-none px-3 py-2 border border-gray-300 rounded-md bg-white pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={timeframe}
                  onChange={(e) => onTimeframeChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="thisQuarter">This Quarter</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="thisYear">This Year</option>
                  <option value="lastYear">Last Year</option>
                  <option value="custom">Custom Range...</option>
                </select>
                <div className="absolute right-2 top-2.5 pointer-events-none">
                  <ChevronDown size={15} className="text-gray-500" />
                </div>
              </div>
            )}
            
            {onRefresh && (
              <button 
                className="px-3 py-2 border border-gray-300 bg-white rounded-md flex items-center text-sm shadow-sm hover:bg-gray-50 text-gray-700 transition-all disabled:opacity-50"
                onClick={onRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={15} className="mr-1 animate-spin" />
                ) : (
                  <RefreshCw size={15} className="mr-1" />
                )}
                Refresh
              </button>
            )}
            
            {/* Export functionality */}
            <ExportMenu 
              reportType={reportType} 
              data={data}
              onExport={onExport}
            />
            
          </div>
        </div>
      </div>
      
      {error ? (
        <div className="p-6 text-center">
          <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-md">
            <p>{error}</p>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
            onClick={onRefresh}
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="p-8 text-center">
          <Loader2 size={36} className="mx-auto animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500">Loading report data...</p>
        </div>
      ) : (
        <div className="p-6">
          {children}
        </div>
      )}
    </div>
  );
};
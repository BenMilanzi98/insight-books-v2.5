'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';

export default function AgingReportDisplay({
  data,
  title,
  type,
  loading,
  error,
  onRefresh,
  onExport
}) {
  const [expandedVendor, setExpandedVendor] = useState(null);
  
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading {type === 'receivable' ? 'accounts receivable' : 'accounts payable'} data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-lg">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={onRefresh}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }
  
  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">No {type === 'receivable' ? 'accounts receivable' : 'accounts payable'} data available.</p>
        <button 
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>
    );
  }
  
  // Group items by vendor/client
  const groupedItems = data.items.reduce((acc, item) => {
    const entityId = type === 'receivable' ? item.clientId : item.vendorId;
    const entityName = type === 'receivable' ? item.client?.name : item.vendor?.name;
    
    if (!acc[entityId]) {
      acc[entityId] = {
        id: entityId,
        name: entityName || 'Unknown',
        items: [],
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        daysOver90: 0,
        total: 0
      };
    }
    
    acc[entityId].items.push(item);
    
    // Calculate aging buckets based on due date
    const dueDate = new Date(item.dueDate);
    const asOfDate = new Date(data.asOfDate);
    const daysPastDue = Math.floor((asOfDate - dueDate) / (1000 * 60 * 60 * 24));
    
    if (daysPastDue <= 0) {
      acc[entityId].current += item.amount;
    } else if (daysPastDue <= 30) {
      acc[entityId].days1to30 += item.amount;
    } else if (daysPastDue <= 60) {
      acc[entityId].days31to60 += item.amount;
    } else if (daysPastDue <= 90) {
      acc[entityId].days61to90 += item.amount;
    } else {
      acc[entityId].daysOver90 += item.amount;
    }
    
    acc[entityId].total += item.amount;
    
    return acc;
  }, {});
  
  // Convert to array and sort by total amount
  const entities = Object.values(groupedItems).sort((a, b) => b.total - a.total);
  
  // Calculate totals
  const totals = entities.reduce(
    (acc, entity) => {
      acc.current += entity.current;
      acc.days1to30 += entity.days1to30;
      acc.days31to60 += entity.days31to60;
      acc.days61to90 += entity.days61to90;
      acc.daysOver90 += entity.daysOver90;
      acc.total += entity.total;
      return acc;
    },
    { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, daysOver90: 0, total: 0 }
  );
  
  const toggleVendorExpand = (vendorId) => {
    if (expandedVendor === vendorId) {
      setExpandedVendor(null);
    } else {
      setExpandedVendor(vendorId);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return 'Invalid Date';
    }
  };
  
  const calculateDaysPastDue = (dueDate) => {
    if (!dueDate) return 0;
    try {
      const due = new Date(dueDate);
      const asOf = new Date(data.asOfDate);
      const diff = asOf - due;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 0;
    } catch (e) {
      return 0;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-500">As of {formatDate(data.asOfDate)}</p>
      </div>
      
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          {type === 'receivable' ? 'Outstanding Invoices' : 'Outstanding Bills'}
        </h3>
        <p className="text-sm text-gray-500">As of {formatDate(data.asOfDate)}</p>
      </div>
      
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-3">Total {type === 'receivable' ? 'Receivables' : 'Payables'}</h3>
        <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
      </div>
      
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          {type === 'receivable' ? 'Customers' : 'Vendors'} with Outstanding Balances
        </h3>
        <p className="text-sm text-gray-500 mb-4">{entities.length} {entities.length === 1 ? 'entity' : 'entities'}</p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {type === 'receivable' ? 'Customer' : 'Vendor'}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  1-30 Days
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  31-60 Days
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  61-90 Days
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Over 90 Days
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entities.map((entity) => (
                <tr 
                  key={entity.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleVendorExpand(entity.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entity.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatCurrency(entity.current)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatCurrency(entity.days1to30)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatCurrency(entity.days31to60)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatCurrency(entity.days61to90)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatCurrency(entity.daysOver90)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {formatCurrency(entity.total)}
                  </td>
                </tr>
              ))}
              
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(totals.current)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(totals.days1to30)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(totals.days31to60)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(totals.days61to90)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(totals.daysOver90)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {formatCurrency(totals.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Detail section */}
      <div className="px-6 py-4">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          {type === 'receivable' ? 'Outstanding Invoices Detail' : 'Outstanding Bills Detail'}
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {type === 'receivable' ? 'Invoice #' : 'Bill #'}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {type === 'receivable' ? 'Customer' : 'Vendor'}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Past Due
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {type === 'receivable' ? item.invoiceNumber || 'N/A' : item.billNumber || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {type === 'receivable' ? item.client?.name || 'Unknown' : item.vendor?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(type === 'receivable' ? item.issueDate : item.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(item.dueDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {calculateDaysPastDue(item.dueDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
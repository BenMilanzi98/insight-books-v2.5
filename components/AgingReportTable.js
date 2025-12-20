'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

// This component adapts between your existing API data formats and the AgingReportTable component
export default function AgingReportsAdapter() {
  const [arData, setArData] = useState(null);
  const [apData, setApData] = useState(null);
  const [arLoading, setArLoading] = useState(false);
  const [apLoading, setApLoading] = useState(false);
  const [arError, setArError] = useState(null);
  const [apError, setApError] = useState(null);
  const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Fetch accounts receivable data (you'll need to implement this endpoint)
  const fetchArData = async () => {
    try {
      setArLoading(true);
      setArError(null);
      
      const response = await fetch(`/api/reports/accounts-receivable-aging?asOfDate=${asOfDate}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching accounts receivable data: ${response.statusText}`);
      }
      
      const originalData = await response.json();
      
      // Convert API data to format expected by AgingReportTable component
      const adaptedData = adaptArData(originalData);
      setArData(adaptedData);
    } catch (err) {
      console.error('Error fetching accounts receivable data:', err);
      setArError(err.message || 'Failed to load accounts receivable data');
    } finally {
      setArLoading(false);
    }
  };
  
  // Fetch accounts payable data from your existing API
  const fetchApData = async () => {
    try {
      setApLoading(true);
      setApError(null);
      
      const response = await fetch(`/api/reports/accounts-payable-aging?asOfDate=${asOfDate}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching accounts payable data: ${response.statusText}`);
      }
      
      const originalData = await response.json();
      
      // Convert API data to format expected by AgingReportTable component
      const adaptedData = adaptApData(originalData);
      setApData(adaptedData);
    } catch (err) {
      console.error('Error fetching accounts payable data:', err);
      setApError(err.message || 'Failed to load accounts payable data');
    } finally {
      setApLoading(false);
    }
  };
  
  // Adapter function for accounts receivable data
  const adaptArData = (originalData) => {
    // This is a placeholder - implement based on your AR API structure
    // Create a structure that matches what AgingReportTable expects
    
    // Generate fake invoice details from summary data
    const items = [];
    
    if (originalData && originalData.items) {
      originalData.items.forEach(customer => {
        // Create invoices for current bucket
        if (customer.current > 0) {
          items.push(createInvoiceItem(customer, 'current', asOfDate));
        }
        
        // Create invoices for days1to30 bucket
        if (customer.days1to30 > 0) {
          items.push(createInvoiceItem(customer, 'days1to30', asOfDate));
        }
        
        // Create invoices for days31to60 bucket
        if (customer.days31to60 > 0) {
          items.push(createInvoiceItem(customer, 'days31to60', asOfDate));
        }
        
        // Create invoices for days61to90 bucket
        if (customer.days61to90 > 0) {
          items.push(createInvoiceItem(customer, 'days61to90', asOfDate));
        }
        
        // Create invoices for daysOver90 bucket
        if (customer.daysOver90 > 0) {
          items.push(createInvoiceItem(customer, 'daysOver90', asOfDate));
        }
      });
    }
    
    return {
      asOfDate: originalData?.asOfDate || asOfDate,
      items: items,
      totalOutstanding: originalData?.totals?.total || 0
    };
  };
  
  // Adapter function for accounts payable data
  const adaptApData = (originalData) => {
    // Convert the summary data format to individual bill items
    // that AgingReportTable can work with
    
    const items = [];
    
    if (originalData && originalData.items) {
      originalData.items.forEach(vendor => {
        // Create bills for current bucket
        if (vendor.current > 0) {
          items.push(createBillItem(vendor, 'current', asOfDate));
        }
        
        // Create bills for days1to30 bucket
        if (vendor.days1to30 > 0) {
          items.push(createBillItem(vendor, 'days1to30', asOfDate));
        }
        
        // Create bills for days31to60 bucket
        if (vendor.days31to60 > 0) {
          items.push(createBillItem(vendor, 'days31to60', asOfDate));
        }
        
        // Create bills for days61to90 bucket
        if (vendor.days61to90 > 0) {
          items.push(createBillItem(vendor, 'days61to90', asOfDate));
        }
        
        // Create bills for daysOver90 bucket
        if (vendor.daysOver90 > 0) {
          items.push(createBillItem(vendor, 'daysOver90', asOfDate));
        }
      });
    }
    
    return {
      asOfDate: originalData?.asOfDate || asOfDate,
      items: items,
      totalOutstanding: originalData?.totals?.total || 0
    };
  };
  
  // Helper function to create invoice items from summary data
  const createInvoiceItem = (customer, agingBucket, asOfDate) => {
    const amount = customer[agingBucket];
    const dueDate = calculateDueDateFromBucket(agingBucket, asOfDate);
    const invoiceDate = calculateInvoiceDate(dueDate);
    
    return {
      id: `${customer.id}-${agingBucket}`,
      invoiceNumber: `INV-${customer.id}-${agingBucket.substring(0, 3)}-${Math.floor(Math.random() * 10000)}`,
      clientId: customer.id,
      client: {
        id: customer.id,
        name: customer.name,
        email: customer.email
      },
      issueDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      amount: amount,
      status: 'Pending'
    };
  };
  
  // Helper function to create bill items from summary data
  const createBillItem = (vendor, agingBucket, asOfDate) => {
    const amount = vendor[agingBucket];
    const dueDate = calculateDueDateFromBucket(agingBucket, asOfDate);
    const billDate = calculateInvoiceDate(dueDate);
    
    return {
      id: `${vendor.id}-${agingBucket}`,
      billNumber: `BILL-${vendor.id}-${agingBucket.substring(0, 3)}-${Math.floor(Math.random() * 10000)}`,
      vendorId: vendor.id,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email
      },
      date: billDate.toISOString(),
      dueDate: dueDate.toISOString(),
      amount: amount,
      status: 'pending',
      description: `Payment to ${vendor.name}`
    };
  };
  
  // Helper function to calculate a due date based on aging bucket
  const calculateDueDateFromBucket = (bucket, asOfDate) => {
    const today = new Date(asOfDate);
    const dueDate = new Date(today);
    
    switch(bucket) {
      case 'current':
        // Current bills are due in the future (0-30 days from now)
        dueDate.setDate(today.getDate() + Math.floor(Math.random() * 30));
        break;
      case 'days1to30':
        // 1-30 days past due
        dueDate.setDate(today.getDate() - Math.floor(Math.random() * 30) - 1);
        break;
      case 'days31to60':
        // 31-60 days past due
        dueDate.setDate(today.getDate() - Math.floor(Math.random() * 30) - 31);
        break;
      case 'days61to90':
        // 61-90 days past due
        dueDate.setDate(today.getDate() - Math.floor(Math.random() * 30) - 61);
        break;
      case 'daysOver90':
        // Over 90 days past due (91-180 days)
        dueDate.setDate(today.getDate() - Math.floor(Math.random() * 90) - 91);
        break;
      default:
        // Default case - due today
        break;
    }
    
    return dueDate;
  };
  
  // Helper function to calculate an invoice/bill date based on due date
  const calculateInvoiceDate = (dueDate) => {
    const date = new Date(dueDate);
    // Typically, invoices are due 30 days after they're issued
    date.setDate(date.getDate() - 30);
    return date;
  };
  
  // Fetch data when component mounts or asOfDate changes
  useEffect(() => {
    fetchArData();
    fetchApData();
  }, [asOfDate]);
  
  // Handle date change
  const handleDateChange = (e) => {
    setAsOfDate(e.target.value);
  };
  
  // Handle export (placeholder function)
  const handleExport = (type, format) => {
    console.log(`Exporting ${type} aging report as ${format}`);
    // Implement export functionality
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Aging Reports</h1>
        
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">As of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={handleDateChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3"
            />
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="receivable" className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="receivable">Accounts Receivable</TabsTrigger>
          <TabsTrigger value="payable">Accounts Payable</TabsTrigger>
        </TabsList>
        
        <TabsContent value="receivable" className="mt-4">
          <AgingReportDisplay
            data={arData}
            title="Accounts Receivable Aging"
            type="receivable"
            loading={arLoading}
            error={arError}
            onRefresh={fetchArData}
            onExport={(format) => handleExport('ar', format)}
          />
        </TabsContent>
        
        <TabsContent value="payable" className="mt-4">
          <AgingReportDisplay
            data={apData}
            title="Accounts Payable Aging"
            type="payable"
            loading={apLoading}
            error={apError}
            onRefresh={fetchApData}
            onExport={(format) => handleExport('ap', format)}
          />
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-3">Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Accounts Receivable</h4>
            <p className="text-2xl font-semibold">
              {arData ? 
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'MWK',
                  minimumFractionDigits: 2
                }).format(arData.totalOutstanding || 0) : 
                'Loading...'
              }
            </p>
            {arData && arData.items && (
              <p className="text-sm text-gray-500 mt-1">
                {arData.items.length} outstanding {arData.items.length === 1 ? 'invoice' : 'invoices'}
              </p>
            )}
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Accounts Payable</h4>
            <p className="text-2xl font-semibold">
              {apData ? 
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'MWK',
                  minimumFractionDigits: 2
                }).format(apData.totalOutstanding || 0) : 
                'Loading...'
              }
            </p>
            {apData && apData.items && (
              <p className="text-sm text-gray-500 mt-1">
                {apData.items.length} outstanding {apData.items.length === 1 ? 'bill' : 'bills'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
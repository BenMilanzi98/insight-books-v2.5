// components/InvoiceTemplatePreview.jsx
import React from 'react';
import { FileText, CheckCircle, Paperclip } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/invoiceCalculations';

// Generate payment breakdown for Partial status invoices
const renderPaymentBreakdown = (displayData) => {
  if (displayData.status !== 'Partial' || !displayData.paymentInfo || displayData.paymentInfo.paymentCount === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <h4 className="font-medium text-blue-800 mb-2">Payment Breakdown:</h4>
      <div className="space-y-1">
        {displayData.payments.map((payment, index) => (
          <div key={payment.id || index} className="flex justify-between text-blue-700">
            <span>{formatDate(payment.paymentDate)} - {payment.paymentMethod}</span>
            <span className="font-medium">{formatCurrency(payment.amount)}</span>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-blue-200">
          <div className="flex justify-between font-medium text-blue-800">
            <span>Total Paid:</span>
            <span>{formatCurrency(displayData.paymentInfo.totalPaid)}</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>Outstanding:</span>
            <span>{formatCurrency(displayData.paymentInfo.outstandingAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Component to preview an invoice template
 * 
 * @param {Object} props
 * @param {Object} props.template - The template object
 * @param {Object} props.branding - Branding settings
 * @param {Object} props.invoice - The actual invoice data (optional, if not provided sample data is used)
 * @param {boolean} props.isPrint - Whether this is for print preview
 */
const InvoiceTemplatePreview = ({ template, branding, invoice, isPrint = false }) => {
  // Parse template content
  const content = typeof template?.content === 'string' 
    ? JSON.parse(template.content) 
    : template?.content || {};
    
  const { 
    style = 'standard', 
    showLogo = true, 
    showFooter = true 
  } = content;
  
  // Use the primary color from template content or branding settings
  const primaryColor = content.primaryColor || branding?.primaryColor || '#4f46e5';
  
  // Sample invoice data for template preview (used when no invoice is provided)
  const sampleData = {
    invoiceNumber: 'INV-0001',
    issueDate: new Date().toLocaleDateString(),
    dueDate: new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString(),
    status: 'Draft',
    client: {
      name: 'Sample Client',
      contactPerson: 'John Doe',
      address: '123 Client Street',
      city: 'City, State 12345',
      email: 'client@example.com',
      phone: '123-456-7890'
    },
    items: [
      { description: 'Service Item 1', quantity: 1, unitPrice: 100, taxRate: 10, amount: 100 },
      { description: 'Product Item 2', quantity: 2, unitPrice: 50, taxRate: 10, amount: 100 }
    ],
    subtotal: 200,
    taxAmount: 20,
    total: 220,
    notes: 'Thank you for your business!'
  };
  
  // Use actual invoice data if provided, otherwise use sample data
  const invoiceData = invoice || sampleData;
  
  // Debug: Log client data structure when in development
  if (invoice && process.env.NODE_ENV !== 'production') {
    console.log('Invoice client data:', invoice.client);
    console.log('Invoice discount data:', {
      discount: invoice.discount,
      totalDiscountAmount: invoice.totalDiscountAmount,
      items: invoice.items?.map(item => ({
        description: item.description,
        discountAmount: item.discountAmount,
        discountRate: item.discountRate
      }))
    });
  }
  
  // If using real invoice, calculate display values
  const displayData = invoice ? {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    status: invoice.status,
    client: invoice.client,
    items: invoice.items?.map(item => ({
      ...item,
      amount: item.quantity * item.unitPrice,
      // Include line item discount information
      lineTotal: item.quantity * item.unitPrice,
      discountAmount: item.discountAmount || 0,
      netAmount: (item.quantity * item.unitPrice) - (item.discountAmount || 0)
    })),
    // Use the stored discount values from the database
    discount: invoice.discount || 0, // Global discount
    totalDiscountAmount: invoice.totalDiscountAmount || 0, // Total of line item discounts
    subtotal: invoice.subtotal || invoice.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0,
    taxAmount: invoice.taxAmount || invoice.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate / 100), 0) || 0,
    total: invoice.total || 0,
    notes: invoice.notes,
    // Payment information
    payments: invoice.payments || [],
    paymentInfo: invoice.paymentInfo || {
      totalPaid: 0,
      outstandingAmount: invoice.total || 0,
      isFullyPaid: false,
      isPartiallyPaid: false,
      paymentCount: 0
    }
  } : sampleData;
  
  // Debug: Log display data when in development
  if (invoice && process.env.NODE_ENV !== 'production') {
    console.log('Display data after processing:', {
      discount: displayData.discount,
      totalDiscountAmount: displayData.totalDiscountAmount,
      subtotal: displayData.subtotal,
      taxAmount: displayData.taxAmount,
      total: displayData.total,
      status: displayData.status,
      paymentInfo: displayData.paymentInfo,
      payments: displayData.payments
    });
  }
  
  // Generate template preview based on style
  const renderStandardTemplate = () => (
    <div className={`bg-white ${isPrint ? '' : 'border border-gray-200 rounded-lg'} p-4 sm:p-6 lg:p-8 mx-auto max-w-3xl text-xs sm:text-sm md:text-base lg:text-lg`}>
      <div className="flex justify-between mb-4 sm:mb-6 lg:mb-8">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold" style={{ color: primaryColor }}>INVOICE</h2>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">#{displayData.invoiceNumber}</p>
        </div>
        <div>
          {showLogo && branding?.logoUrl && (
            <img 
              src={branding.logoUrl?.startsWith('/uploads/')
                ? `/api/uploads/${branding.logoUrl.replace(/^\/+uploads\//, '')}`
                : branding.logoUrl} 
              alt="Company Logo" 
              className="h-12 sm:h-16 lg:h-20 object-contain"
            />
          )}
          {(!showLogo || !branding?.logoUrl) && branding?.companyName && (
            <div className="text-base sm:text-lg lg:text-xl font-bold">{branding.companyName}</div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-6 lg:mb-8">
        <div>
          <h3 className="text-gray-500 font-medium mb-2 text-xs sm:text-sm">Bill To:</h3>
          <p className="font-medium text-xs sm:text-sm">{displayData.client?.name}</p>
          {displayData.client?.contactPerson && (
            <p className="text-xs sm:text-sm">Attn: {displayData.client.contactPerson}</p>
          )}
          {displayData.client?.address && displayData.client.address !== '' && (
            <p className="text-xs sm:text-sm">{displayData.client.address}</p>
          )}
          <p className="text-xs sm:text-sm">{displayData.client?.email}</p>
          {displayData.client?.phone && displayData.client.phone !== '' && (
            <p className="text-xs sm:text-sm">Phone: {displayData.client.phone}</p>
          )}
        </div>
        <div>
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div>
              <h3 className="text-gray-500 font-medium mb-2 text-xs sm:text-sm">Invoice Date:</h3>
              <p className="text-xs sm:text-sm">{displayData.issueDate}</p>
            </div>
            <div>
              <h3 className="text-gray-500 font-medium mb-2 text-xs sm:text-sm">Due Date:</h3>
              <p className="text-xs sm:text-sm">{displayData.dueDate}</p>
            </div>
            <div className="col-span-2">
              <h3 className="text-gray-500 font-medium mb-2 text-xs sm:text-sm">Status:</h3>
              <p className="text-xs sm:text-sm">{displayData.status}</p>
            </div>
          </div>
        </div>
      </div>
      
      <table className="min-w-full border-separate" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="border-b-2 border-gray-200 bg-gray-50 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
            <th className="border-b-2 border-gray-200 bg-gray-50 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
            <th className="border-b-2 border-gray-200 bg-gray-50 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
            <th className="border-b-2 border-gray-200 bg-gray-50 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
            <th className="border-b-2 border-gray-200 bg-gray-50 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Rate</th>
            <th className="border-b-2 border-gray-200 bg-gray-50 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {displayData.items?.map((item, index) => (
            <tr key={index}>
              <td className="px-3 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">{item.description}</td>
              <td className="px-3 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 text-right">{item.quantity}</td>
              <td className="px-3 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 text-right">{formatCurrency(item.unitPrice)}</td>
              <td className="px-3 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 text-right">
                {item.discountAmount > 0 ? (
                  <span className="text-red-600">-{formatCurrency(item.discountAmount)}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-3 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 text-right">{item.taxRate}%</td>
              <td className="px-3 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 text-right">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="mt-4 sm:mt-6 lg:mt-8 flex justify-end">
        <div className="w-48 sm:w-56 lg:w-64 text-right">
          {/* Show line item discounts if any */}
          {displayData.totalDiscountAmount > 0 && (
            <div className="flex justify-between py-1 sm:py-2 text-xs sm:text-sm">
              <span className="text-gray-600">Line Item Discounts:</span>
              <span className="font-medium text-red-600">-{formatCurrency(displayData.totalDiscountAmount)}</span>
            </div>
          )}
          {/* Show global discount if any */}
          {displayData.discount > 0 && (
            <div className="flex justify-between py-1 sm:py-2 text-xs sm:text-sm">
              <span className="text-gray-600">Global Discount:</span>
              <span className="font-medium text-red-600">-{formatCurrency(displayData.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 sm:py-2 text-xs sm:text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(displayData.subtotal)}</span>
          </div>
          <div className="flex justify-between py-1 sm:py-2 text-xs sm:text-sm">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">{formatCurrency(displayData.taxAmount)}</span>
          </div>
          <div className="flex justify-between py-2 sm:py-3 text-sm sm:text-base lg:text-lg border-t border-gray-200" style={{ color: primaryColor }}>
            <span>Total</span>
            <span>{formatCurrency(displayData.total)}</span>
          </div>
          
          {/* Payment Information */}
          {displayData.paymentInfo && displayData.paymentInfo.paymentCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Information</h4>
              
              {/* Total Paid */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(displayData.paymentInfo.totalPaid)}</span>
              </div>
              
              {/* Outstanding Amount */}
              {displayData.paymentInfo.outstandingAmount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Outstanding:</span>
                  <span className="font-medium text-red-600">{formatCurrency(displayData.paymentInfo.outstandingAmount)}</span>
                </div>
              )}
              
              {/* Payment Status */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${
                  displayData.paymentInfo.isFullyPaid ? 'text-green-600' : 
                  displayData.paymentInfo.isPartiallyPaid ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {displayData.paymentInfo.isFullyPaid ? 'Fully Paid' : 
                   displayData.paymentInfo.isPartiallyPaid ? 'Partially Paid' : 
                   'Unpaid'}
                </span>
              </div>
              
              {/* Payment History */}
              {displayData.payments && displayData.payments.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Payment History:</h5>
                  <div className="space-y-1">
                    {displayData.payments.map((payment, index) => (
                      <div key={payment.id || index} className="flex justify-between text-xs text-gray-600">
                        <span>{formatDate(payment.paymentDate)} - {payment.paymentMethod}</span>
                        <span>{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-6 sm:mt-8 lg:mt-12 pt-4 sm:pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div>
            <h3 className="text-gray-500 font-medium mb-2 text-xs sm:text-sm">Notes:</h3>
            <div className="text-xs sm:text-sm text-gray-700">
              <p>{displayData.notes || "Thank you for your business!"}</p>
              {renderPaymentBreakdown(displayData)}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs sm:text-sm text-green-600">Invoice Generated</span>
            </div>
            {showFooter && branding?.emailFooter && (
              <p className="mt-2 text-xs text-gray-500">{branding.emailFooter}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderProfessionalTemplate = () => (
    <div className={`bg-white ${isPrint ? '' : 'border border-gray-200 rounded-lg'} p-8 mx-auto max-w-3xl`} style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header with background color */}
      <div className="p-6 mb-6 rounded-md" style={{ backgroundColor: primaryColor }}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white">INVOICE</h2>
            <p className="text-white opacity-80 mt-1">#{displayData.invoiceNumber}</p>
          </div>
          {showLogo && branding?.logoUrl && (
            <img 
              src={branding.logoUrl?.startsWith('/uploads/')
                ? `/api/uploads/${branding.logoUrl.replace(/^\/+uploads\//, '')}`
                : branding.logoUrl} 
              alt="Company Logo" 
              className="h-16 object-contain bg-white p-2 rounded"
            />
          )}
          {(!showLogo || !branding?.logoUrl) && branding?.companyName && (
            <div className="text-2xl font-bold text-white">{branding.companyName}</div>
          )}
        </div>
      </div>
      
      {/* Client and Invoice Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="p-4 bg-gray-50 rounded-md">
          <h3 className="font-medium mb-3 pb-2 border-b" style={{ color: primaryColor }}>BILL TO</h3>
          <p className="font-medium">{displayData.client?.name || ''}</p>
          {displayData.client?.contactPerson && displayData.client.contactPerson !== '' && (
            <p>Attn: {displayData.client.contactPerson}</p>
          )}
          {displayData.client?.address && displayData.client.address !== '' && (
            <p>{displayData.client.address}</p>
          )}
          <p>{displayData.client?.email || ''}</p>
          {displayData.client?.phone && displayData.client.phone !== '' && (
            <p>Phone: {displayData.client.phone}</p>
          )}
        </div>
        <div className="p-4 bg-gray-50 rounded-md">
          <h3 className="font-medium mb-3 pb-2 border-b" style={{ color: primaryColor }}>INVOICE DETAILS</h3>
          <div className="grid grid-cols-2 gap-2">
            <p className="font-medium">Issue Date:</p>
            <p>{displayData.issueDate}</p>
            <p className="font-medium">Due Date:</p>
            <p>{displayData.dueDate}</p>
            <p className="font-medium">Status:</p>
            <p className="flex items-center">
              {displayData.status === 'Paid' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> Paid
                </>
              ) : displayData.status}
            </p>
          </div>
        </div>
      </div>
      
      {/* Line Items */}
      <div className="mb-8">
        <h3 className="font-medium mb-3 pb-2 border-b" style={{ color: primaryColor }}>LINE ITEMS</h3>
        <table className="min-w-full">
          <thead>
            <tr style={{ backgroundColor: primaryColor + '15' }}>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Rate</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Discount</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Tax Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {displayData.items?.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.description}</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.quantity}</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-center">
                  {item.discountAmount > 0 ? (
                    <span className="text-red-600">-{formatCurrency(item.discountAmount)}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.taxRate}%</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 p-4 rounded-md" style={{ backgroundColor: primaryColor + '15' }}>
          {/* Show line item discounts if any */}
          {displayData.totalDiscountAmount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Line Item Discounts:</span>
              <span className="font-medium text-red-600">-{formatCurrency(displayData.totalDiscountAmount)}</span>
            </div>
          )}
          {/* Show global discount if any */}
          {displayData.discount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Global Discount:</span>
              <span className="font-medium text-red-600">-{formatCurrency(displayData.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{formatCurrency(displayData.subtotal)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Tax:</span>
            <span className="font-medium">{formatCurrency(displayData.taxAmount)}</span>
          </div>
          <div className="flex justify-between py-2 text-lg font-bold mt-2 pt-2 border-t border-gray-300" style={{ color: primaryColor }}>
            <span>Total:</span>
            <span>{formatCurrency(displayData.total)}</span>
          </div>
          
          {/* Payment Information */}
          {displayData.paymentInfo && displayData.paymentInfo.paymentCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Information</h4>
              
              {/* Total Paid */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(displayData.paymentInfo.totalPaid)}</span>
              </div>
              
              {/* Outstanding Amount */}
              {displayData.paymentInfo.outstandingAmount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Outstanding:</span>
                  <span className="font-medium text-red-600">{formatCurrency(displayData.paymentInfo.outstandingAmount)}</span>
                </div>
              )}
              
              {/* Payment Status */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${
                  displayData.paymentInfo.isFullyPaid ? 'text-green-600' : 
                  displayData.paymentInfo.isPartiallyPaid ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {displayData.paymentInfo.isFullyPaid ? 'Fully Paid' : 
                   displayData.paymentInfo.isPartiallyPaid ? 'Partially Paid' : 
                   'Unpaid'}
                </span>
              </div>
              
              {/* Payment History */}
              {displayData.payments && displayData.payments.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Payment History:</h5>
                  <div className="space-y-1">
                    {displayData.payments.map((payment, index) => (
                      <div key={payment.id || index} className="flex justify-between text-xs text-gray-600">
                        <span>{formatDate(payment.paymentDate)} - {payment.paymentMethod}</span>
                        <span>{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-6 sm:mt-8 lg:mt-12 pt-4 sm:pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div>
            <h3 className="text-gray-500 font-medium mb-2 text-xs sm:text-sm">Notes:</h3>
            <div className="text-xs sm:text-sm text-gray-700">
              <p>{displayData.notes || "Thank you for your business!"}</p>
              {renderPaymentBreakdown(displayData)}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs sm:text-sm text-green-600">Invoice Generated</span>
            </div>
            {showFooter && branding?.emailFooter && (
              <p className="mt-2 text-xs text-gray-500">{branding.emailFooter}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderMinimalTemplate = () => (
    <div className={`bg-white ${isPrint ? '' : 'border border-gray-200 rounded-lg'} p-8 mx-auto max-w-3xl`} style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Simple Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-normal" style={{ color: primaryColor }}>Invoice #{displayData.invoiceNumber}</h2>
            <p className="text-gray-500 mt-1">Issued: {displayData.issueDate}</p>
          </div>
          {showLogo && branding?.logoUrl && (
            <img 
              src={branding.logoUrl?.startsWith('/uploads/')
                ? `/api/uploads/${branding.logoUrl.replace(/^\/+uploads\//, '')}`
                : branding.logoUrl} 
              alt="Company Logo" 
              className="h-10 object-contain"
            />
          )}
        </div>
        
        <hr className="my-6 border-t border-gray-200" />
      </div>
      
      {/* Client and Invoice Info - Simple 2 column layout */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-sm text-gray-500 mb-1">Bill To</p>
          <p className="font-medium">{displayData.client?.name || ''}</p>
          {displayData.client?.contactPerson && displayData.client.contactPerson !== '' && (
            <p className="text-sm">Attn: {displayData.client.contactPerson}</p>
          )}
          {displayData.client?.address && displayData.client.address !== '' && (
            <p className="text-sm">{displayData.client.address}</p>
          )}
          <p className="text-sm">{displayData.client?.email || ''}</p>
          {displayData.client?.phone && displayData.client.phone !== '' && (
            <p className="text-sm">Phone: {displayData.client.phone}</p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">Payment Details</p>
          <p className="font-medium">Due Date: {displayData.dueDate}</p>
          <p className="text-sm">Amount Due: {formatCurrency(displayData.total)}</p>
          <p className="text-sm">Status: {displayData.status}</p>
        </div>
      </div>
      
      {/* Line Items - Simplified table */}
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="pb-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Description</th>
            <th className="pb-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">Qty</th>
            <th className="pb-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">Rate</th>
            <th className="pb-3 text-center text-xs font-normal text-gray-500 uppercase tracking-wider">Discount</th>
            <th className="pb-3 text-center text-xs font-normal text-gray-500 uppercase tracking-wider">Tax</th>
            <th className="pb-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {displayData.items?.map((item, index) => (
            <tr key={index}>
              <td className="py-4 text-sm text-gray-900">{item.description}</td>
              <td className="py-4 text-sm text-gray-500 text-right">{item.quantity}</td>
              <td className="py-4 text-sm text-gray-500 text-right">{formatCurrency(item.unitPrice)}</td>
              <td className="py-4 text-sm text-gray-500 text-center">
                {item.discountAmount > 0 ? (
                  <span className="text-red-600">-{formatCurrency(item.discountAmount)}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="py-4 text-sm text-gray-500 text-center">{item.taxRate}%</td>
              <td className="py-4 text-sm text-gray-500 text-right">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Totals - Right aligned */}
      <div className="mt-8 flex justify-end">
        <div className="w-64">
          {/* Show line item discounts if any */}
          {displayData.totalDiscountAmount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Line Item Discounts</span>
              <span className="font-medium text-red-600">-{formatCurrency(displayData.totalDiscountAmount)}</span>
            </div>
          )}
          {/* Show global discount if any */}
          {displayData.discount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Global Discount</span>
              <span className="font-medium text-red-600">-{formatCurrency(displayData.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(displayData.subtotal)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">{formatCurrency(displayData.taxAmount)}</span>
          </div>
          <div className="flex justify-between py-2 text-lg" style={{ color: primaryColor }}>
            <span>Total</span>
            <span>{formatCurrency(displayData.total)}</span>
          </div>
          
          {/* Payment Information */}
          {displayData.paymentInfo && displayData.paymentInfo.paymentCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Information</h4>
              
              {/* Total Paid */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(displayData.paymentInfo.totalPaid)}</span>
              </div>
              
              {/* Outstanding Amount */}
              {displayData.paymentInfo.outstandingAmount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Outstanding:</span>
                  <span className="font-medium text-red-600">{formatCurrency(displayData.paymentInfo.outstandingAmount)}</span>
                </div>
              )}
              
              {/* Payment Status */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${
                  displayData.paymentInfo.isFullyPaid ? 'text-green-600' : 
                  displayData.paymentInfo.isPartiallyPaid ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {displayData.paymentInfo.isFullyPaid ? 'Fully Paid' : 
                   displayData.paymentInfo.isPartiallyPaid ? 'Partially Paid' : 
                   'Unpaid'}
                </span>
              </div>
              
              {/* Payment History */}
              {displayData.payments && displayData.payments.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Payment History:</h5>
                  <div className="space-y-1">
                    {displayData.payments.map((payment, index) => (
                      <div key={payment.id || index} className="flex justify-between text-xs text-gray-600">
                        <span>{formatDate(payment.paymentDate)} - {payment.paymentMethod}</span>
                        <span>{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Simple Footer with less content */}
      <div className="mt-12 pt-6 border-t border-gray-100 text-sm">
        <p>{displayData.notes || "Thank you for your business."}</p>
        {renderPaymentBreakdown(displayData)}
        {showFooter && branding?.emailFooter && (
          <p className="mt-2 text-xs text-gray-500">{branding.emailFooter}</p>
        )}
      </div>
    </div>
  );
  
  // Return the appropriate template based on style
  switch (style) {
    case 'professional':
      return renderProfessionalTemplate();
    case 'minimal':
      return renderMinimalTemplate();
    case 'standard':
    default:
      return renderStandardTemplate();
  }
};

export default InvoiceTemplatePreview;
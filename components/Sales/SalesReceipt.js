"use client";

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Printer, 
  Download,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import { getPaymentMethodIcon, getPaymentMethodName } from '@/lib/paymentMethods';

const SaleReceipt = ({ sale, onPrint, onClose, companyInfo = null, businessSettings = null }) => {
  const receiptRef = useRef(null);
  
  // Default company info if not provided
  const company = companyInfo || {
    name: "InsightBooks",
    address: "123 Business St., Lilongwe, Malawi",
    phone: "+265 123 4567",
    email: "info@insightbooks.com",
    website: "www.insightbooks.com",
    logo: null // URL to logo
  };
  
  // Enhanced business information with full address support
  const business = businessSettings || {
    buildingName: "",
    address: company.address,
    city: "",
    phone: company.phone,
    email: company.email,
    footer: "Thank you for your business!"
  };
  
  // Format currency
  const formatCurrency = (amount, currencyCode = 'MWK') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Enhanced date formatting - DD/MM/YYYY format
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Format as DD/MM/YYYY
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return 'Invalid Date';
    }
  };
  
  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return 'Invalid Time';
    }
  };
  
  // Handle print with thermal printer settings
  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    pageStyle: `
      @page {
        size: 80mm auto;
        margin: 2mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
    onAfterPrint: () => {
      if (onPrint) onPrint();
    }
  });
  
  // Fallback if sale is not provided
  if (!sale) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <p className="text-center text-gray-500">No sale data available</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Sale Receipt</h2>
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm"
            >
              <Printer className="w-4 h-4 mr-1" />
              Print
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Thermal Receipt Content */}
        <div className="p-4">
          <div
            ref={receiptRef}
            className="receipt-container"
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '11px',
              lineHeight: '1.3',
              color: '#000',
              background: '#fff',
              width: '80mm',
              maxWidth: '80mm',
              margin: '0 auto',
              padding: '4mm',
              boxSizing: 'border-box',
              fontWeight: 'bold'
            }}
          >
            {/* Enhanced Header with Full Business Information */}
            <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
              {company.logo && (
                <img src={company.logo} alt="Logo" style={{ maxWidth: '50px', maxHeight: '50px', marginBottom: '4px' }} />
              )}
              <div style={{ fontSize: '14px', fontWeight: 'bold', margin: '2px 0', textTransform: 'uppercase' }}>
                {company.name}
              </div>
              
              {/* Enhanced Business Address Section */}
              {business.buildingName && (
                <div style={{ fontSize: '9px', lineHeight: '1.2', margin: '1px 0', fontWeight: 'bold' }}>
                  {business.buildingName}
                </div>
              )}
              {business.address && (
                <div style={{ fontSize: '9px', lineHeight: '1.2', margin: '1px 0', fontWeight: 'bold' }}>
                  {business.address}
                </div>
              )}
              {business.city && (
                <div style={{ fontSize: '9px', lineHeight: '1.2', margin: '1px 0', fontWeight: 'bold' }}>
                  {business.city}
                </div>
              )}
              {business.phone && (
                <div style={{ fontSize: '9px', lineHeight: '1.2', margin: '1px 0', fontWeight: 'bold' }}>
                  Tel: {business.phone}
                </div>
              )}
              {business.email && (
                <div style={{ fontSize: '9px', lineHeight: '1.2', margin: '1px 0', fontWeight: 'bold' }}>
                  Email: {business.email}
                </div>
              )}
            </div>

            {/* Receipt Title */}
            <div style={{
              fontSize: '12px',
              fontWeight: 'bold',
              margin: '8px 0',
              textAlign: 'center',
              borderTop: '1px dashed #000',
              borderBottom: '1px dashed #000',
              padding: '4px 0',
              textTransform: 'uppercase'
            }}>
              SALES RECEIPT
            </div>

            {/* Sale Information */}
            <div style={{ margin: '6px 0', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span style={{ fontWeight: 'bold', minWidth: '30%' }}>Receipt #:</span>
                <span style={{ textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>{sale.saleNumber || sale.id}</span>
              </div>
              
              {/* Historical Sale Date Section */}
              {sale.isHistorical && sale.historicalDate ? (
                <>
                  <div style={{
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '4px',
                    padding: '6px',
                    margin: '6px 0',
                    fontSize: '9px',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#856404', fontWeight: 'bold', marginBottom: '4px' }}>
                      📅 HISTORICAL TRANSACTION
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ color: '#856404', fontWeight: 'bold', minWidth: '30%' }}>Sale Date:</span>
                      <span style={{ color: '#856404', textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>
                        {formatDate(sale.historicalDate)} {formatTime(sale.historicalDate)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span style={{ color: '#6c757d', fontWeight: 'bold', minWidth: '30%' }}>Receipt Generated:</span>
                      <span style={{ color: '#6c757d', textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>
                        {formatDate(sale.saleDate || sale.createdAt)} {formatTime(sale.saleDate || sale.createdAt)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '30%' }}>Date:</span>
                    <span style={{ textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>{formatDate(sale.saleDate || sale.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '30%' }}>Time:</span>
                    <span style={{ textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>{formatTime(sale.saleDate || sale.createdAt)}</span>
                  </div>
                </>
              )}
              
              {sale.client?.name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '30%' }}>Customer:</span>
                  <span style={{ textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>{sale.client.name}</span>
                </div>
              )}
              {/* Payment Method - Show split payments if available */}
              {sale.payments && sale.payments.length > 0 && sale.payments[0].allocations && sale.payments[0].allocations.length > 1 ? (
                <div style={{ margin: '4px 0' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Payment (Split):</div>
                  {sale.payments[0].allocations.map((alloc, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '1px 0', fontSize: '9px' }}>
                      <span style={{ minWidth: '30%' }}>{alloc.paymentAccount?.name || 'N/A'}:</span>
                      <span style={{ textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>
                        MK {Number(alloc.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', borderTop: '1px dashed #ccc', paddingTop: '2px', fontWeight: 'bold' }}>
                    <span>Total:</span>
                    <span style={{ textAlign: 'right' }}>MK {Number(sale.payments[0].amount || sale.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span style={{ fontWeight: 'bold', minWidth: '30%' }}>Payment:</span>
                  <span style={{ textAlign: 'right', maxWidth: '65%', fontWeight: 'bold' }}>
                    {sale.payments && sale.payments.length > 0 && sale.payments[0].allocations && sale.payments[0].allocations.length > 0
                      ? sale.payments[0].allocations.map(alloc => alloc.paymentAccount?.name || 'N/A').join(', ')
                      : getPaymentMethodName(sale.paymentMethod)}
                  </span>
                </div>
              )}
            </div>

            {/* Items */}
            <div style={{ margin: '6px 0', fontSize: '9px' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '2px', fontWeight: 'bold' }}>
                ITEMS
              </div>
              {sale.items?.map((item, index) => (
                <div key={index} style={{ margin: '2px 0', borderBottom: '1px dotted #ccc', paddingBottom: '2px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>
                    {item.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>{item.quantity} x MK {Number(item.unitPrice).toFixed(2)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      MK {(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span style={{ fontWeight: 'bold' }}>Subtotal:</span>
                <span style={{ textAlign: 'right', fontWeight: 'bold' }}>MK {Number(sale.subtotal || 0).toFixed(2)}</span>
              </div>
              {(() => {
                const taxBuckets = {};
                let hasAnyTaxes = false;
                
                // Check both taxBreakdown (from frontend) and itemTaxes (from database)
                (sale.items || []).forEach(item => {
                  // Try taxBreakdown first (frontend data)
                  if (item.taxBreakdown && item.taxBreakdown.length > 0) {
                    hasAnyTaxes = true;
                    item.taxBreakdown.forEach(tax => {
                      const taxKey = tax.taxName || tax.taxId || 'Tax';
                      if (!taxBuckets[taxKey]) {
                        taxBuckets[taxKey] = {
                          name: tax.taxName || tax.taxId || 'Tax',
                          code: tax.taxCode || null,
                          total: 0
                        };
                      }
                      taxBuckets[taxKey].total += Number(tax.taxAmount || 0);
                    });
                  }
                  // Also check itemTaxes (database data)
                  if (item.itemTaxes && item.itemTaxes.length > 0) {
                    hasAnyTaxes = true;
                    item.itemTaxes.forEach(tax => {
                      const taxKey = tax.taxName || 'Tax';
                      if (!taxBuckets[taxKey]) {
                        taxBuckets[taxKey] = {
                          name: tax.taxName || 'Tax',
                          code: tax.taxCode || null,
                          total: 0
                        };
                      }
                      taxBuckets[taxKey].total += Number(tax.taxAmount || 0);
                    });
                  }
                });

                const detailedTaxes = Object.values(taxBuckets)
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                const calculatedTotalTax = detailedTaxes.reduce((sum, tax) => sum + tax.total, 0);
                const totalTax = calculatedTotalTax > 0 ? calculatedTotalTax : Number(sale.totalTaxAmount || 0);

                // Show taxes if we have any
                if (!hasAnyTaxes && totalTax <= 0) return null;

                return (
                  <>
                    {detailedTaxes.length > 0 && detailedTaxes.map((tax, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                        <span style={{ fontWeight: 'bold' }}>
                          {tax.name}{tax.code ? ` (${tax.code})` : ''}:
                        </span>
                        <span style={{ textAlign: 'right', fontWeight: 'bold' }}>MK {Number(tax.total).toFixed(2)}</span>
                      </div>
                    ))}
                    {totalTax > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        margin: '2px 0',
                        borderTop: '1px solid #ddd',
                        paddingTop: '4px',
                        marginTop: '4px'
                      }}>
                        <span style={{ fontWeight: 'bold' }}>Total Tax:</span>
                        <span style={{ textAlign: 'right', fontWeight: 'bold' }}>MK {Number(totalTax).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {sale.totalDiscountAmount && sale.totalDiscountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span style={{ fontWeight: 'bold' }}>Total Discount:</span>
                  <span style={{ textAlign: 'right', fontWeight: 'bold' }}>-MK {Number(sale.totalDiscountAmount).toFixed(2)}</span>
                </div>
              )}
              
              {/* Grand Total */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: 'bold',
                borderTop: '1px solid #000',
                borderBottom: '1px solid #000',
                padding: '2px 0',
                margin: '4px 0'
              }}>
                <span>TOTAL:</span>
                <span>MK {Number(sale.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Information */}
            <div style={{ margin: '6px 0', fontSize: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold' }}>Payment Method: {sale.paymentMethod || sale.payments?.[0]?.allocations?.[0]?.paymentAccount?.name || 'N/A'}</div>
              <div style={{ fontWeight: 'bold' }}>Amount Paid: MK {Number(sale.total || 0).toFixed(2)}</div>
              <div style={{ fontWeight: 'bold' }}>Change: MK 0.00</div>
            </div>

            {/* Enhanced Footer */}
            <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '9px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
              {/* Custom Footer/Slogan */}
              {business.footer && (
                <div style={{ fontStyle: 'italic', margin: '4px 0', fontWeight: 'bold' }}>
                  {business.footer}
                </div>
              )}
              
              {/* Standard Footer */}
              <div style={{ fontSize: '8px', marginTop: '4px', fontWeight: 'bold' }}>
                Receipt generated on {formatDate(new Date())} at {formatTime(new Date())}
              </div>
              <div style={{ fontSize: '8px', marginTop: '2px', fontWeight: 'bold' }}>
                insightbooksafrica.com
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleReceipt;
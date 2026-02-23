// components/QuotationTemplatePreview.jsx
import React, { forwardRef } from 'react';
import { User } from 'lucide-react';

const QuotationTemplatePreview = forwardRef(({ 
  quotation, 
  branding, 
  currency = "MWK",
  isPrint = false 
}, ref) => {
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      // If it's already a Date object, use it directly
      let dateObj = date;
      if (!(date instanceof Date)) {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid Date';
    }
  };

  /** UI: always two decimals (.00). Export/print: no trailing .00 for tidy documents. */
  const formatCurrency = (amount) => {
    return `${currency} ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: isPrint ? 0 : 2, maximumFractionDigits: 2 })}`;
  };
  /** Number only for line items; MWK only in headers and totals */
  const formatAmount = (amount) =>
    Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: isPrint ? 0 : 2, maximumFractionDigits: 2 });

  return (
    <div ref={ref} className={`bg-white ${isPrint ? 'print:shadow-none' : 'shadow-lg'} max-w-4xl mx-auto`} style={{ fontFamily: 'Times New Roman, serif', lineHeight: '1.4' }}>
      <style jsx>{`
        @media print {
          * {
            line-height: 1.4 !important;
          }
          table {
            border-collapse: collapse;
          }
          td, th {
            padding: 8px 8px !important;
            vertical-align: middle;
          }
        }
      `}</style>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            {branding?.logoUrl && (
              <img 
                src={branding.logoUrl?.startsWith('/uploads/')
                  ? `/api/uploads/${branding.logoUrl.replace(/^\/+uploads\//, '')}`
                  : branding.logoUrl} 
                alt="Company Logo" 
                className="h-12 w-auto object-contain"
              />
            )}
            {!branding?.logoUrl && (
              <div>
                <h1 className="text-gray-900 font-bold" style={{ fontSize: '14pt', color: branding?.primaryColor || '#1f2937' }}>
                  {branding?.companyName || branding?.name || 'InsightBooks'}
                </h1>
                {(branding?.companyAddress || branding?.address) && (
                  <p className="text-gray-600" style={{ fontSize: '12pt', marginTop: '2px' }}>{branding?.companyAddress || branding?.address}</p>
                )}
                <div className="flex space-x-4 text-gray-600" style={{ fontSize: '12pt', marginTop: '2px' }}>
                  {(branding?.companyPhone || branding?.phone) && (
                    <span>Phone: {branding?.companyPhone || branding?.phone}</span>
                  )}
                  {(branding?.companyEmail || branding?.email) && (
                    <span>Email: {branding?.companyEmail || branding?.email}</span>
                  )}
                </div>
                {branding?.website && (
                  <div className="text-gray-600" style={{ fontSize: '12pt', marginTop: '2px' }}>
                    Website: {branding.website}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="text-right">
            <h2 className="text-gray-900 font-bold mb-1" style={{ fontSize: '14pt' }}>QUOTATION</h2>
            <div className="text-gray-600" style={{ fontSize: '12pt' }}>
              <div style={{ marginBottom: '2px' }}><strong>Quotation #:</strong> {quotation?.quotationNumber ?? '—'}</div>
              <div style={{ marginBottom: '2px' }}><strong>Order #:</strong> {quotation?.orderNumber ?? '—'}</div>
              <div style={{ marginBottom: '2px' }}><strong>Date:</strong> {formatDate(quotation?.issueDate)}</div>
              <div style={{ marginBottom: '2px' }}><strong>Valid Until:</strong> {formatDate(quotation?.validUntil)}</div>
              <div style={{ marginBottom: '2px' }}><strong>Status:</strong> 
                <span className={`ml-1 px-1 py-0.5 rounded text-xs font-medium ${
                  quotation?.status === 'Approved' ? 'bg-green-100 text-green-800' :
                  quotation?.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                  quotation?.status === 'Converted' ? 'bg-blue-100 text-blue-800' :
                  quotation?.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {quotation?.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To and Prepared By */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-gray-900 font-semibold mb-1" style={{ fontSize: '12pt' }}>Quotation For:</h3>
            <div className="text-gray-700" style={{ fontSize: '12pt' }}>
              <div className="font-medium" style={{ fontSize: '12pt' }}>
                {/* Try multiple fallbacks for client name */}
                {quotation?.client?.name || 
                 quotation?.clientName || 
                 (quotation?.client?.email ? quotation.client.email.split('@')[0] : null) ||
                 'Client Name Not Available'}
              </div>
              <div style={{ fontSize: '12pt', marginTop: '2px' }}>
                {quotation?.client?.email && (
                  <div style={{ marginBottom: '2px' }}>{quotation.client.email}</div>
                )}
                {quotation?.client?.phone && (
                  <div style={{ marginBottom: '2px' }}>Phone: {quotation.client.phone}</div>
                )}
                {quotation?.client?.address && (
                  <div className="whitespace-pre-line" style={{ marginBottom: '2px' }}>{quotation.client.address}</div>
                )}
                {quotation?.client?.contactPerson && (
                  <div style={{ marginBottom: '2px' }}>Contact: {quotation.client.contactPerson}</div>
                )}
              </div>
            </div>
          </div>
          
          {/* NEW: Prepared By Section */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-1 flex items-center" style={{ fontSize: '12pt' }}>
              <User className="w-4 h-4 mr-1" />
              Prepared By:
            </h3>
            <div className="text-gray-700" style={{ fontSize: '12pt' }}>
              <div className="font-medium" style={{ fontSize: '12pt' }}>{quotation?.createdBy?.name || 'N/A'}</div>
              <div style={{ fontSize: '12pt', marginTop: '2px' }}>
                <div style={{ marginBottom: '2px' }}>{quotation?.createdBy?.email}</div>
                {quotation?.createdBy?.phone && <div style={{ marginBottom: '2px' }}>Phone: {quotation?.createdBy?.phone}</div>}
                {quotation?.createdBy?.department && <div style={{ marginBottom: '2px' }}>Department: {quotation?.createdBy?.department}</div>}
                <div className="text-gray-500" style={{ fontSize: '12pt', marginTop: '2px' }}>
                  Created: {formatDate(quotation?.createdAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Title Section - always show so title/order context is visible */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <h3 className="text-gray-500 font-medium mb-0.5" style={{ fontSize: '11pt' }}>Title</h3>
        <p className="text-gray-900 font-semibold" style={{ fontSize: '12pt' }}>{quotation?.title ?? '—'}</p>
      </div>

      {/* Items Table */}
      <div className="p-4 -mt-2 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize: '12pt', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left font-semibold text-gray-900" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>Description</th>
                <th className="text-center font-semibold text-gray-900" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>Qty</th>
                <th className="text-right font-semibold text-gray-900" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>Unit Price (MWK)</th>
                <th className="text-right font-semibold text-gray-900" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>Discount (MWK)</th>
                <th className="text-right font-semibold text-gray-900" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>Tax (MWK)</th>
                <th className="text-right font-semibold text-gray-900" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>Total (MWK)</th>
              </tr>
            </thead>
            <tbody>
              {quotation?.items?.map((item, index) => {
                const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
                // Use discountAmount (fixed amount) instead of discountRate (percentage)
                const discountAmount = item.discountAmount || 0;
                const netAmount = lineTotal - discountAmount;
                const taxAmount = netAmount * ((item.taxRate || 0) / 100);
                const finalAmount = netAmount + taxAmount;
                
                return (
                  <tr key={index} className="border-b border-gray-200" style={{ lineHeight: '1.4' }}>
                    <td style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'top' }}>
                      <div className="font-medium text-gray-900" style={{ fontSize: '12pt', lineHeight: '1.4', marginBottom: '2px' }}>{item.description}</div>
                      {item.product?.sku && (
                        <div className="text-gray-500" style={{ fontSize: '11pt', lineHeight: '1.3' }}>SKU: {item.product.sku}</div>
                      )}
                    </td>
                    <td className="text-center text-gray-700" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>{item.quantity}</td>
                    <td className="text-right text-gray-700" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>{formatAmount(item.unitPrice)}</td>
                    <td className="text-right" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>
                      {discountAmount > 0 ? (
                        <div className="text-red-600" style={{ fontSize: '12pt', lineHeight: '1.4' }}>
                          {formatAmount(discountAmount)}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-right" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>
                      {(item.taxRate || 0) > 0 ? (
                        <div className="text-gray-700" style={{ fontSize: '12pt', lineHeight: '1.4' }}>
                          <div>{item.taxRate}%</div>
                          <div style={{ fontSize: '11pt', color: '#6b7280' }}>({formatAmount(taxAmount)})</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-right font-medium text-gray-900" style={{ padding: '8px 8px', fontSize: '12pt', lineHeight: '1.4', verticalAlign: 'middle' }}>
                      {formatAmount(finalAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Enhanced Totals Section */}
        <div className="flex justify-end mt-4">
          <div className="w-80" style={{ fontSize: '12pt' }}>
            <div className="flex justify-between border-b border-gray-200" style={{ padding: '8px 0' }}>
              <span className="text-gray-600" style={{ fontSize: '12pt' }}>Subtotal:</span>
              <span className="font-medium text-gray-900" style={{ fontSize: '12pt' }}>
                {formatCurrency(quotation?.subtotal || (quotation?.items?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0) || 0))}
              </span>
            </div>
            
            {/* Show total discount if any */}
            {(quotation?.totalDiscountAmount || 0) > 0 && (
              <div className="flex justify-between border-b border-gray-200" style={{ padding: '2px 0' }}>
                <span className="text-red-600" style={{ fontSize: '12pt' }}>Line Item Discounts:</span>
                <span className="font-medium text-red-600" style={{ fontSize: '12pt' }}>-{formatCurrency(quotation?.totalDiscountAmount || 0)}</span>
              </div>
            )}
            
            {/* Show global discount if any */}
            {(quotation?.discount || 0) > 0 && (
              <div className="flex justify-between border-b border-gray-200" style={{ padding: '2px 0' }}>
                <span className="text-red-600" style={{ fontSize: '12pt' }}>Global Discount:</span>
                <span className="font-medium text-red-600" style={{ fontSize: '12pt' }}>-{formatCurrency(quotation?.discount || 0)}</span>
              </div>
            )}
            
            <div className="flex justify-between border-b border-gray-200" style={{ padding: '8px 0' }}>
              <span className="text-gray-600" style={{ fontSize: '12pt' }}>Net Subtotal:</span>
              <span className="font-medium text-gray-900" style={{ fontSize: '12pt' }}>
                {formatCurrency((quotation?.subtotal || (quotation?.items?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0) || 0)) - (quotation?.totalDiscountAmount || 0) - (quotation?.discount || 0))}
              </span>
            </div>
            
            <div className="flex justify-between border-b border-gray-200" style={{ padding: '8px 0' }}>
              <span className="text-gray-600" style={{ fontSize: '12pt' }}>Tax Amount:</span>
              <span className="font-medium text-gray-900" style={{ fontSize: '12pt' }}>
                {formatCurrency(quotation?.taxAmount || (quotation?.items?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0) * ((item.taxRate || 0) / 100)), 0) || 0))}
              </span>
            </div>
            
            <div className="flex justify-between border-t-2 border-gray-800" style={{ padding: '4px 0' }}>
              <span className="font-bold text-gray-900" style={{ fontSize: '14pt' }}>Total:</span>
              <span className="font-bold text-gray-900" style={{ fontSize: '14pt', color: branding?.primaryColor || '#1f2937' }}>
                {formatCurrency(quotation?.total || (quotation?.items?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0) || 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {quotation?.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-1" style={{ fontSize: '12pt' }}>Notes:</h4>
            <p className="text-gray-700 whitespace-pre-line" style={{ fontSize: '12pt' }}>{quotation.notes}</p>
          </div>
        )}

        {/* Footer with phone and bank details (default from settings or override per document) */}
        <div className="mt-4 pt-2 border-t border-gray-200 text-center text-gray-500" style={{ fontSize: '12pt' }}>
          <p>Thank you for considering our quotation!</p>
          {(() => {
            const footerPhone = (quotation?.footerPhoneOverride != null && quotation?.footerPhoneOverride !== '') ? quotation.footerPhoneOverride : (branding?.businessPhone || branding?.companyPhone || branding?.phone || '');
            const footerBankDetails = (quotation?.footerBankDetailsOverride != null && quotation?.footerBankDetailsOverride !== '') ? quotation.footerBankDetailsOverride : (branding?.defaultBankDetails || '');
            const hasFooterContact = footerPhone.trim() || footerBankDetails.trim();
            return hasFooterContact ? (
              <div className="mt-2 text-left max-w-md mx-auto space-y-0.5" style={{ fontSize: '11pt' }}>
                {footerPhone.trim() && <p>Tel: {footerPhone.trim()}</p>}
                {footerBankDetails.trim() && <pre className="whitespace-pre-wrap font-sans text-left">{footerBankDetails.trim()}</pre>}
              </div>
            ) : null;
          })()}
          {branding?.website && (
            <p style={{ marginTop: '2px' }}>Visit us at: {branding.website}</p>
          )}
        </div>
      </div>
    </div>
  );
});

export default QuotationTemplatePreview;
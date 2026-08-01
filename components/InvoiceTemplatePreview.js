// components/InvoiceTemplatePreview.jsx
import React, { useState } from 'react';
import { formatCurrency, formatAmount, formatAmountForExport, formatCurrencyForExport, formatDate } from '@/lib/invoiceCalculations';
import { addMoney, multiplyMoney, percentOfMoney, subtractMoney } from '@/lib/money';
import { shouldDisplayDocumentTax, documentHasLineTax } from '@/lib/documentTaxDisplay';

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
  const [logoError, setLogoError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  // Only treat as having a logo when we have a non-empty URL; otherwise show business name only
  const logoUrl = branding?.logoUrl && String(branding.logoUrl).trim() ? String(branding.logoUrl).trim() : null;
  // Preload logo so we never render a broken img (no green square); reset when URL changes
  React.useEffect(() => {
    setLogoError(false);
    setLogoLoaded(false);
    if (!logoUrl) return;
    const img = new Image();
    const src = logoUrl.startsWith('/uploads/') ? `/api/uploads/${logoUrl.replace(/^\/+uploads\//, '')}` : logoUrl;
    img.onload = () => setLogoLoaded(true);
    img.onerror = () => setLogoError(true);
    img.src = src;
    return () => { img.src = ''; };
  }, [logoUrl]);

  // Export/print: no trailing .00 for tidy documents; UI: always two decimals
  const formatAmountDisplay = isPrint ? formatAmountForExport : formatAmount;
  const formatCurrencyDisplay = isPrint ? (amount, code) => formatCurrencyForExport(amount, code || 'MWK') : formatCurrency;

  // Parse template content
  const content = typeof template?.content === 'string' 
    ? JSON.parse(template.content) 
    : template?.content || {};
    
  const { 
    style = 'standard', 
    showLogo = true, 
    showFooter = true 
  } = content;

  // Seller TPIN from branding/settings (tenant settings surface TPIN on account page)
  const sellerTpin = branding?.tpin || branding?.tpinNumber || '';
  
  // Use the primary color from template content or branding settings
  const primaryColor = content.primaryColor || branding?.primaryColor || '#4f46e5';
  const hasLogoUrl = !!logoUrl;
  // Only show logo image after it has loaded successfully; otherwise show business name (no green/broken placeholder)
  const showLogoImage = showLogo && hasLogoUrl && !logoError && logoLoaded;
  const showCompanyName = !hasLogoUrl || logoError || (hasLogoUrl && !logoLoaded);
  // When no logo is available, show only business name (no image/placeholder)
  const hasLogoAreaContent = showLogoImage || showCompanyName;
  
  // Footer: document override or default from settings (for invoice, quotation, receipt)
  const footerPhone = (invoice?.footerPhoneOverride != null && invoice?.footerPhoneOverride !== '') ? invoice.footerPhoneOverride : (branding?.businessPhone || '');
  const footerBankDetails = (invoice?.footerBankDetailsOverride != null && invoice?.footerBankDetailsOverride !== '') ? invoice.footerBankDetailsOverride : (branding?.defaultBankDetails || '');
  const hasFooterContact = showFooter && (footerPhone.trim() || footerBankDetails.trim());
  
  // Sample invoice data for template preview (used when no invoice is provided)
  const sampleData = {
    invoiceNumber: 'INV-0001',
    title: 'Sample Invoice Title',
    orderNumber: 'ORD-SAMPLE-001',
    issueDate: (() => {
      const date = new Date();
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    })(),
    dueDate: (() => {
      const date = new Date(Date.now() + 30*24*60*60*1000);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    })(),
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
  
  // If using real invoice, calculate display values (title/orderNumber from API)
  const displayData = invoice ? {
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title ?? null,
    orderNumber: invoice.orderNumber ?? null,
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    status: invoice.status,
    client: invoice.client,
    items: invoice.items?.map(item => {
      const lineTotal = multiplyMoney(item.quantity, item.unitPrice);
      const discountAmount = item.discountAmount || 0;
      const netAmount = subtractMoney(lineTotal, discountAmount);
      const itemTaxes = item.itemTaxes || item.taxes || [];
      const lineTaxAmount = itemTaxes.length
        ? itemTaxes.reduce((s, t) => addMoney(s, Number(t.taxAmount) || 0), 0)
        : percentOfMoney(netAmount, item.taxRate || 0);
      return {
        ...item,
        // Ensure line title: description or product name
        description: (item.description && String(item.description).trim()) || (item.product && item.product.name) || 'Item',
        amount: addMoney(netAmount, lineTaxAmount),
        lineTotal,
        discountAmount,
        netAmount,
        lineTaxAmount,
        itemTaxes,
      };
    }),
    // Use the stored discount values from the database
    discount: invoice.discount || 0, // Global discount
    totalDiscountAmount: invoice.totalDiscountAmount || 0, // Total of line item discounts
    subtotal: invoice.subtotal || invoice.items?.reduce((sum, item) => addMoney(sum, multiplyMoney(item.quantity, item.unitPrice)), 0) || 0,
    taxAmount: invoice.taxAmount || invoice.items?.reduce((sum, item) => addMoney(sum, percentOfMoney(multiplyMoney(item.quantity, item.unitPrice), item.taxRate)), 0) || 0,
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

  const showLineTax = documentHasLineTax(displayData.items);
  const showDocumentTax = shouldDisplayDocumentTax({
    taxAmount: displayData.taxAmount,
    taxLines: (displayData.items || []).flatMap((item) => item.itemTaxes || []),
  });
  
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
  
  // Generate template preview based on style — redesigned for clarity and hierarchy
  const renderStandardTemplate = () => (
    <div className={`bg-white ${isPrint ? '' : 'border border-gray-200 rounded-xl shadow-sm'} mx-auto max-w-3xl overflow-hidden`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header: accent bar + company and doc type */}
      <div className="border-l-4 px-6 pt-6 pb-4" style={{ borderLeftColor: primaryColor }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {hasLogoAreaContent && (
              <div className="relative">
                {/* Only render img when logo has loaded successfully (preloaded in useEffect); avoids green broken-image */}
                {showLogoImage && (
                  <img
                    src={logoUrl?.startsWith('/uploads/') ? `/api/uploads/${logoUrl.replace(/^\/+uploads\//, '')}` : logoUrl}
                    alt=""
                    className="h-11 object-contain max-h-14"
                  />
                )}
                {/* When logo is not available or failed: show business name only (no green square) */}
                {showCompanyName && (
                  <p className="text-lg font-semibold text-gray-900 tracking-tight">{branding?.companyName || branding?.name || 'Business'}</p>
                )}
              </div>
            )}
            {sellerTpin && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">TPIN:</span> {sellerTpin}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-gray-900">Invoice</p>
            <p className="text-sm text-gray-500 mt-0.5">#{displayData.invoiceNumber}</p>
            <span className="inline-block mt-2 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700">{displayData.status}</span>
          </div>
        </div>
      </div>

      {/* Bill To + Invoice Details in a clean grid */}
      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 bg-gray-50/60">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Bill to</p>
          <p className="font-semibold text-gray-900">{displayData.client?.name}</p>
          {displayData.client?.contactPerson && <p className="text-sm text-gray-600">Attn: {displayData.client.contactPerson}</p>}
          {displayData.client?.address && displayData.client.address !== '' && <p className="text-sm text-gray-600 mt-1">{displayData.client.address}</p>}
          <p className="text-sm text-gray-600">{displayData.client?.email}</p>
          {displayData.client?.phone && displayData.client.phone !== '' && <p className="text-sm text-gray-600">Tel: {displayData.client.phone}</p>}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-gray-500">Order #</p>
              <p className="text-gray-900">{displayData.orderNumber || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Issue date</p>
              <p className="text-gray-900">{displayData.issueDate}</p>
            </div>
            <div>
              <p className="text-gray-500">Due date</p>
              <p className="text-gray-900">{displayData.dueDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="px-6 py-5">
        <h2 className="text-center text-lg font-semibold text-gray-900 mb-4">{displayData.title?.trim() || 'Invoice'}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 font-semibold text-gray-700">Item</th>
              <th className="text-right py-3 font-semibold text-gray-700 w-16">Qty</th>
              <th className="text-right py-3 font-semibold text-gray-700">Rate</th>
              <th className="text-right py-3 font-semibold text-gray-700">Discount</th>
              {showLineTax && <th className="text-right py-3 font-semibold text-gray-700">Tax</th>}
              <th className="text-right py-3 font-semibold text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayData.items?.map((item, index) => (
              <tr key={index} className={index % 2 === 1 ? 'bg-gray-50/50' : ''}>
                <td className="py-3.5 text-gray-900 font-medium">{item.description}</td>
                <td className="py-3.5 text-right text-gray-600">{item.quantity}</td>
                <td className="py-3.5 text-right text-gray-600">{formatAmountDisplay(item.unitPrice)}</td>
                <td className="py-3.5 text-right">{item.discountAmount > 0 ? <span className="text-red-600">-{formatAmountDisplay(item.discountAmount)}</span> : <span className="text-gray-400">—</span>}</td>
                {showLineTax && (
                <td className="py-3.5 text-right text-gray-600" title={item.itemTaxes?.length ? item.itemTaxes.map((t) => t.taxName).join(', ') : (item.taxRate > 0 ? `VAT ${item.taxRate}%` : null)}>
                  {item.itemTaxes?.length > 0
                    ? item.itemTaxes.map((t) => `${t.taxName}: ${formatAmountDisplay(t.taxAmount)}`).join(' · ')
                    : item.taxRate > 0
                      ? `${item.taxRate}% · ${formatAmountDisplay(item.lineTaxAmount ?? percentOfMoney(item.netAmount ?? subtractMoney(multiplyMoney(item.quantity, item.unitPrice), item.discountAmount || 0), item.taxRate || 0))}`
                      : '—'}
                </td>
                )}
                <td className="py-3.5 text-right font-medium text-gray-900">{formatAmountDisplay(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals card */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 rounded-lg border border-gray-200 bg-gray-50/80 p-4 text-sm">
            {displayData.totalDiscountAmount > 0 && (
              <div className="flex justify-between py-1.5 text-gray-600"><span>Line discounts</span><span className="text-red-600 font-medium">-{formatCurrencyDisplay(displayData.totalDiscountAmount)}</span></div>
            )}
            {displayData.discount > 0 && (
              <div className="flex justify-between py-1.5 text-gray-600"><span>Discount</span><span className="text-red-600 font-medium">-{formatCurrencyDisplay(displayData.discount)}</span></div>
            )}
            <div className="flex justify-between py-1.5 text-gray-600"><span>Subtotal</span><span className="font-medium text-gray-900">{formatCurrencyDisplay(displayData.subtotal)}</span></div>
            {showDocumentTax && (
            <div className="flex justify-between py-1.5 text-gray-600"><span>Tax</span><span className="font-medium text-gray-900">{formatCurrencyDisplay(displayData.taxAmount)}</span></div>
            )}
            <div className="flex justify-between py-3 mt-1 border-t-2 border-gray-200" style={{ color: primaryColor }}>
              <span className="font-bold">Total</span>
              <span className="font-bold">{formatCurrencyDisplay(displayData.total)}</span>
            </div>
            {displayData.paymentInfo &&
              (displayData.paymentInfo.totalPaid > 0 || (displayData.payments?.length ?? 0) > 0) && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
                <div className="flex justify-between text-gray-600"><span>Paid</span><span className="font-medium text-green-600">{formatCurrencyDisplay(displayData.paymentInfo.totalPaid)}</span></div>
                {displayData.paymentInfo.outstandingAmount > 0 && (
                  <div className="flex justify-between text-gray-600"><span>Outstanding</span><span className="font-medium text-red-600">{formatCurrencyDisplay(displayData.paymentInfo.outstandingAmount)}</span></div>
                )}
                {displayData.payments?.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-medium text-gray-500 mb-1">Payment history</p>
                    {displayData.payments.map((payment, i) => (
                      <div key={payment.id || i} className="flex justify-between text-xs text-gray-600"><span>{formatDate(payment.paymentDate)} · {payment.paymentMethodName || payment.paymentMethod}</span><span>{formatCurrencyDisplay(payment.amount)}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {displayData.notes && (
        <div className="px-6 py-5 border-t border-gray-200 bg-gray-50/40 text-sm text-left">
          <p className="text-gray-700 whitespace-pre-line">{displayData.notes}</p>
        </div>
      )}

      {/* Footer: contact info + centered thank-you */}
      <footer className="px-6 py-6 mt-auto border-t border-gray-200 bg-gray-50/60 text-sm">
        {hasFooterContact && (
          <div className="text-gray-500 space-y-0.5 mb-4">
            {footerPhone.trim() && <p>Tel: {footerPhone.trim()}</p>}
            {footerBankDetails.trim() && <pre className="whitespace-pre-wrap font-sans">{footerBankDetails.trim()}</pre>}
          </div>
        )}
        <p className="text-center text-gray-600 font-medium mt-4">
          {showFooter && branding?.emailFooter ? branding.emailFooter : "Thank you for your business!"}
        </p>
      </footer>
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
          {hasLogoAreaContent && (
            <>
              {showLogoImage && (
                <img
                  src={logoUrl?.startsWith('/uploads/') ? `/api/uploads/${logoUrl.replace(/^\/+uploads\//, '')}` : logoUrl}
                  alt=""
                  className="h-16 object-contain bg-white p-2 rounded"
                />
              )}
              {showCompanyName && (
                <div className="text-2xl font-bold text-white">{branding?.companyName || branding?.name || 'Business'}</div>
              )}
            </>
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
            <p className="font-medium">Title:</p>
            <p>{displayData.title || '—'}</p>
            <p className="font-medium">Order #:</p>
            <p>{displayData.orderNumber || '—'}</p>
            <p className="font-medium">Issue Date:</p>
            <p>{displayData.issueDate}</p>
            <p className="font-medium">Due Date:</p>
            <p>{displayData.dueDate}</p>
            <p className="font-medium">Status:</p>
            <p className="flex items-center">
              {displayData.status}
            </p>
          </div>
        </div>
      </div>
      
      {/* Invoice title centered above the items table */}
      <h2 className="text-center text-2xl font-bold my-6" style={{ color: primaryColor }}>{displayData.title?.trim() || 'Invoice'}</h2>
      
      {/* Line Items */}
      <div className="mb-8">
        <h3 className="font-medium mb-3 pb-2 border-b" style={{ color: primaryColor }}>LINE ITEMS</h3>
        <table className="min-w-full">
          <thead>
            <tr style={{ backgroundColor: primaryColor + '15' }}>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Rate (MWK)</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Discount (MWK)</th>
              {showLineTax && <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Tax (MWK)</th>}
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Amount (MWK)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {displayData.items?.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.description}</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.quantity}</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatAmountDisplay(item.unitPrice)}</td>
                <td className="px-6 py-4 text-sm text-gray-500 text-center">
                  {item.discountAmount > 0 ? (
                    <span className="text-red-600">-{formatAmountDisplay(item.discountAmount)}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                {showLineTax && (
                <td className="px-6 py-4 text-sm text-gray-500 text-center" title={item.taxRate > 0 ? `VAT/Tax ${item.taxRate}%` : null}>
                  {item.itemTaxes?.length > 0
                    ? item.itemTaxes.map((t) => `${t.taxName}: ${formatAmountDisplay(t.taxAmount)}`).join(' · ')
                    : item.taxRate > 0
                      ? `${item.taxRate}% · ${formatAmountDisplay(item.lineTaxAmount ?? percentOfMoney(item.netAmount ?? subtractMoney(multiplyMoney(item.quantity, item.unitPrice), item.discountAmount || 0), item.taxRate || 0))}`
                      : '—'}
                </td>
                )}
                <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatAmountDisplay(item.amount)}</td>
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
              <span className="font-medium text-red-600">-{formatCurrencyDisplay(displayData.totalDiscountAmount)}</span>
            </div>
          )}
          {/* Show global discount if any */}
          {displayData.discount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Global Discount:</span>
              <span className="font-medium text-red-600">-{formatCurrencyDisplay(displayData.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{formatCurrencyDisplay(displayData.subtotal)}</span>
          </div>
          {showDocumentTax && (
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Tax:</span>
            <span className="font-medium">{formatCurrencyDisplay(displayData.taxAmount)}</span>
          </div>
          )}
          <div className="flex justify-between py-2 text-lg font-bold mt-2 pt-2 border-t border-gray-300" style={{ color: primaryColor }}>
            <span>Total:</span>
            <span>{formatCurrencyDisplay(displayData.total)}</span>
          </div>
          
          {/* Payment Information */}
          {displayData.paymentInfo &&
            (displayData.paymentInfo.totalPaid > 0 || (displayData.payments?.length ?? 0) > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Information</h4>
              
              {/* Total Paid */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-medium text-green-600">{formatCurrencyDisplay(displayData.paymentInfo.totalPaid)}</span>
              </div>
              
              {/* Outstanding Amount */}
              {displayData.paymentInfo.outstandingAmount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Outstanding:</span>
                  <span className="font-medium text-red-600">{formatCurrencyDisplay(displayData.paymentInfo.outstandingAmount)}</span>
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
                        <span>{formatDate(payment.paymentDate)} - {payment.paymentMethodName || payment.paymentMethod}</span>
                        <span>{formatCurrencyDisplay(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {displayData.notes && (
        <div className="mt-6 sm:mt-8 lg:mt-12 pt-4 sm:pt-6 border-t border-gray-200 text-left">
          <h3 className="text-gray-500 font-medium mb-2 text-xs sm:text-sm">Notes:</h3>
          <div className="text-xs sm:text-sm text-gray-700">
            <p>{displayData.notes}</p>
          </div>
        </div>
      )}

      {/* Footer: contact info + centered thank-you */}
      <footer className="mt-6 sm:mt-8 lg:mt-12 pt-4 sm:pt-6 border-t border-gray-200">
        {hasFooterContact && (
          <div className="text-xs text-gray-600 text-left space-y-0.5 mb-4">
            {footerPhone.trim() && <p>Tel: {footerPhone.trim()}</p>}
            {footerBankDetails.trim() && <pre className="whitespace-pre-wrap font-sans text-left">{footerBankDetails.trim()}</pre>}
          </div>
        )}
        <p className="text-center text-sm text-gray-600 font-medium mt-4">
          {showFooter && branding?.emailFooter ? branding.emailFooter : "Thank you for your business!"}
        </p>
      </footer>
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
          {hasLogoAreaContent && (
            <>
              {showLogoImage && (
                <img
                  src={logoUrl?.startsWith('/uploads/') ? `/api/uploads/${logoUrl.replace(/^\/+uploads\//, '')}` : logoUrl}
                  alt=""
                  className="h-10 object-contain"
                />
              )}
              {showCompanyName && (
                <div className="text-lg font-bold text-gray-900">{branding?.companyName || branding?.name || 'Business'}</div>
              )}
            </>
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
          <p className="text-sm text-gray-500 mb-1">Invoice Details</p>
          <p className="text-sm">Title: {displayData.title || '—'}</p>
          <p className="text-sm">Order #: {displayData.orderNumber || '—'}</p>
          <p className="font-medium mt-1">Due Date: {displayData.dueDate}</p>
          <p className="text-sm">Amount Due: {formatCurrencyDisplay(displayData.total)}</p>
          <p className="text-sm">Status: {displayData.status}</p>
        </div>
      </div>
      
      {/* Invoice title centered above the items table */}
      <h2 className="text-center text-2xl font-bold my-6" style={{ color: primaryColor }}>{displayData.title?.trim() || 'Invoice'}</h2>
      
      {/* Line Items - Simplified table */}
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="pb-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Description</th>
            <th className="pb-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">Qty</th>
            <th className="pb-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">Rate (MWK)</th>
            <th className="pb-3 text-center text-xs font-normal text-gray-500 uppercase tracking-wider">Discount (MWK)</th>
            {showLineTax && <th className="pb-3 text-center text-xs font-normal text-gray-500 uppercase tracking-wider">Tax (MWK)</th>}
            <th className="pb-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">Amount (MWK)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {displayData.items?.map((item, index) => (
            <tr key={index}>
              <td className="py-4 text-sm text-gray-900">{item.description}</td>
              <td className="py-4 text-sm text-gray-500 text-right">{item.quantity}</td>
              <td className="py-4 text-sm text-gray-500 text-right">{formatAmountDisplay(item.unitPrice)}</td>
              <td className="py-4 text-sm text-gray-500 text-center">
                {item.discountAmount > 0 ? (
                  <span className="text-red-600">-{formatAmountDisplay(item.discountAmount)}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              {showLineTax && (
              <td className="py-4 text-sm text-gray-500 text-center" title={item.taxRate > 0 ? `VAT/Tax ${item.taxRate}%` : null}>
                {item.itemTaxes?.length > 0
                    ? item.itemTaxes.map((t) => `${t.taxName}: ${formatAmountDisplay(t.taxAmount)}`).join(' · ')
                    : item.taxRate > 0
                      ? `${item.taxRate}% · ${formatAmountDisplay(item.lineTaxAmount ?? percentOfMoney(item.netAmount ?? subtractMoney(multiplyMoney(item.quantity, item.unitPrice), item.discountAmount || 0), item.taxRate || 0))}`
                      : '—'}
              </td>
              )}
              <td className="py-4 text-sm text-gray-500 text-right">{formatAmountDisplay(item.amount)}</td>
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
              <span className="font-medium text-red-600">-{formatCurrencyDisplay(displayData.totalDiscountAmount)}</span>
            </div>
          )}
          {/* Show global discount if any */}
          {displayData.discount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Global Discount</span>
              <span className="font-medium text-red-600">-{formatCurrencyDisplay(displayData.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrencyDisplay(displayData.subtotal)}</span>
          </div>
          {showDocumentTax && (
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">{formatCurrencyDisplay(displayData.taxAmount)}</span>
          </div>
          )}
          <div className="flex justify-between py-2 text-lg" style={{ color: primaryColor }}>
            <span>Total</span>
            <span>{formatCurrencyDisplay(displayData.total)}</span>
          </div>
          
          {/* Payment Information */}
          {displayData.paymentInfo &&
            (displayData.paymentInfo.totalPaid > 0 || (displayData.payments?.length ?? 0) > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Information</h4>
              
              {/* Total Paid */}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-medium text-green-600">{formatCurrencyDisplay(displayData.paymentInfo.totalPaid)}</span>
              </div>
              
              {/* Outstanding Amount */}
              {displayData.paymentInfo.outstandingAmount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Outstanding:</span>
                  <span className="font-medium text-red-600">{formatCurrencyDisplay(displayData.paymentInfo.outstandingAmount)}</span>
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
                        <span>{formatDate(payment.paymentDate)} - {payment.paymentMethodName || payment.paymentMethod}</span>
                        <span>{formatCurrencyDisplay(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {displayData.notes && (
        <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-left">
          <p>{displayData.notes}</p>
        </div>
      )}

      {/* Footer: contact info + centered thank-you */}
      <footer className="mt-12 pt-6 border-t border-gray-100 text-sm">
        {hasFooterContact && (
          <div className="text-xs text-gray-600 space-y-0.5 mb-4 text-left">
            {footerPhone.trim() && <p>Tel: {footerPhone.trim()}</p>}
            {footerBankDetails.trim() && <pre className="whitespace-pre-wrap font-sans text-left">{footerBankDetails.trim()}</pre>}
          </div>
        )}
        <p className="text-center text-gray-600 font-medium mt-4">
          {showFooter && branding?.emailFooter ? branding.emailFooter : "Thank you for your business!"}
        </p>
      </footer>
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
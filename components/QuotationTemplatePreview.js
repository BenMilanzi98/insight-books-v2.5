// components/QuotationTemplatePreview.jsx
import React, { forwardRef, useState } from 'react';
import { addMoney, multiplyMoney, percentOfMoney, subtractMoney } from '@/lib/money';

const QuotationTemplatePreview = forwardRef(({
  quotation,
  branding,
  currency = "MWK",
  isPrint = false
}, ref) => {
  const [logoError, setLogoError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const logoUrl = branding?.logoUrl && String(branding.logoUrl).trim() ? String(branding.logoUrl).trim() : null;
  // Preload logo so we never render a broken img (no green square); when no logo, show business name only
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

  const hasLogoUrl = !!logoUrl;
  const showLogoImage = hasLogoUrl && !logoError && logoLoaded;
  const showCompanyName = !hasLogoUrl || logoError || (hasLogoUrl && !logoLoaded);
  const hasLogoAreaContent = showLogoImage || showCompanyName;

  const primaryColor = branding?.primaryColor || '#1f2937';
  const footerPhone = (quotation?.footerPhoneOverride != null && quotation?.footerPhoneOverride !== '') ? quotation.footerPhoneOverride : (branding?.businessPhone || branding?.companyPhone || branding?.phone || '');
  const footerBankDetails = (quotation?.footerBankDetailsOverride != null && quotation?.footerBankDetailsOverride !== '') ? quotation.footerBankDetailsOverride : (branding?.defaultBankDetails || '');
  const hasFooterContact = footerPhone.trim() || footerBankDetails.trim();

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      let dateObj = date;
      if (!(date instanceof Date)) dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount) =>
    `${currency} ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: isPrint ? 0 : 2, maximumFractionDigits: 2 })}`;
  const formatAmount = (amount) =>
    Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: isPrint ? 0 : 2, maximumFractionDigits: 2 });

  // Compute totals from quotation or from line items so tax is always shown on the quotation (not only after convert/sale)
  const subtotal = quotation?.subtotal ?? quotation?.items?.reduce((sum, item) => addMoney(sum, multiplyMoney(item.quantity || 0, item.unitPrice || 0)), 0) ?? 0;
  const totalDiscount = addMoney(quotation?.totalDiscountAmount || 0, quotation?.discount || 0);
  const netSubtotal = subtractMoney(subtotal, totalDiscount);
  const taxAmount = quotation?.taxAmount ?? quotation?.items?.reduce((sum, item) => {
    const lt = multiplyMoney(item.quantity || 0, item.unitPrice || 0);
    const da = multiplyMoney(item.discountAmount || 0, item.quantity || 0);
    return addMoney(sum, percentOfMoney(subtractMoney(lt, da), item.taxRate || 0));
  }, 0) ?? 0;
  const total = quotation?.total ?? addMoney(netSubtotal, taxAmount);

  return (
    <div ref={ref} className={`bg-white ${isPrint ? 'print:shadow-none' : 'border border-gray-200 rounded-xl shadow-sm'} max-w-3xl mx-auto overflow-hidden`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style jsx>{`@media print { table { border-collapse: collapse; } td, th { padding: 8px !important; } }`}</style>
      {/* Header: accent bar + company and doc type */}
      <div className="border-l-4 px-6 pt-6 pb-4" style={{ borderLeftColor: primaryColor }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {hasLogoAreaContent && (
              <>
                {showLogoImage && (
                  <img
                    src={logoUrl?.startsWith('/uploads/') ? `/api/uploads/${logoUrl.replace(/^\/+uploads\//, '')}` : logoUrl}
                    alt=""
                    className="h-11 object-contain max-h-14"
                  />
                )}
                {showCompanyName && (
                  <p className="text-lg font-semibold text-gray-900 tracking-tight">{branding?.companyName || branding?.name || 'Business'}</p>
                )}
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-gray-900">Quotation</p>
            <p className="text-sm text-gray-500 mt-0.5">{quotation?.quotationNumber ?? '—'}</p>
            <span className={`inline-block mt-2 px-2.5 py-1 text-xs font-medium rounded-md ${
              quotation?.status === 'Approved' ? 'bg-green-100 text-green-800' :
              quotation?.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
              quotation?.status === 'Converted' ? 'bg-blue-100 text-blue-800' :
              quotation?.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {quotation?.status ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Quotation for + Prepared by + Doc details */}
      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 bg-gray-50/60">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Quotation for</p>
          <p className="font-semibold text-gray-900">
            {quotation?.client?.name || quotation?.clientName || (quotation?.client?.email ? quotation.client.email.split('@')[0] : null) || 'Client Name Not Available'}
          </p>
          {quotation?.client?.contactPerson && <p className="text-sm text-gray-600">Contact: {quotation.client.contactPerson}</p>}
          {quotation?.client?.email && <p className="text-sm text-gray-600">{quotation.client.email}</p>}
          {quotation?.client?.phone && <p className="text-sm text-gray-600">Tel: {quotation.client.phone}</p>}
          {quotation?.client?.address && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{quotation.client.address}</p>}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><p className="text-gray-500">Order #</p><p className="text-gray-900">{quotation?.orderNumber ?? '—'}</p></div>
            <div><p className="text-gray-500">Date</p><p className="text-gray-900">{formatDate(quotation?.issueDate)}</p></div>
            <div><p className="text-gray-500">Valid until</p><p className="text-gray-900">{formatDate(quotation?.validUntil)}</p></div>
          </div>
          {quotation?.createdBy && (
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Prepared by</p>
              <p className="text-gray-900 font-medium">{quotation.createdBy.name}</p>
              {quotation.createdBy.email && <p className="text-sm text-gray-600">{quotation.createdBy.email}</p>}
              <p className="text-xs text-gray-500 mt-1">Created {formatDate(quotation?.createdAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="px-6 py-5">
        {/* Centered title above items table */}
        <h2 className="text-center text-lg font-semibold text-gray-900 mb-4">{quotation?.title?.trim() || 'Quotation'}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 font-semibold text-gray-700">Description</th>
              <th className="text-right py-3 font-semibold text-gray-700 w-16">Qty</th>
              <th className="text-right py-3 font-semibold text-gray-700">Selling Price</th>
              <th className="text-right py-3 font-semibold text-gray-700">Discount</th>
              <th className="text-right py-3 font-semibold text-gray-700">Tax</th>
              <th className="text-right py-3 font-semibold text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quotation?.items?.map((item, index) => {
              const lineTotal = multiplyMoney(item.quantity || 0, item.unitPrice || 0);
              const perItemDiscount = item.discountAmount || 0;
              const lineDiscount = multiplyMoney(perItemDiscount, item.quantity || 0);
              const netAmount = subtractMoney(lineTotal, lineDiscount);
              const itemTaxes = item.itemTaxes || item.taxes || [];
              const taxAmountItem = itemTaxes.length
                ? itemTaxes.reduce((s, t) => addMoney(s, Number(t.taxAmount) || 0), 0)
                : percentOfMoney(netAmount, item.taxRate || 0);
              const finalAmount = addMoney(netAmount, taxAmountItem);
              return (
                <tr key={index} className={index % 2 === 1 ? 'bg-gray-50/50' : ''}>
                  <td className="py-3.5 text-gray-900 font-medium">
                    {item.description}
                    {item.product?.sku && <span className="block text-gray-500 text-xs">SKU: {item.product.sku}</span>}
                  </td>
                  <td className="py-3.5 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-3.5 text-right text-gray-600">{formatAmount(item.unitPrice)}</td>
                  <td className="py-3.5 text-right">{lineDiscount > 0 ? <span className="text-red-600">-{formatAmount(lineDiscount)}</span> : <span className="text-gray-400">—</span>}</td>
                  <td className="py-3.5 text-right text-gray-600">
                    {itemTaxes.length > 0
                      ? itemTaxes.map((t) => `${t.taxName}: ${formatAmount(t.taxAmount)}`).join(' · ')
                      : (item.taxRate || 0) > 0
                        ? `${item.taxRate}% · ${formatAmount(taxAmountItem)}`
                        : '—'}
                  </td>
                  <td className="py-3.5 text-right font-medium text-gray-900">{formatAmount(finalAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals card */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 rounded-lg border border-gray-200 bg-gray-50/80 p-4 text-sm">
            <div className="flex justify-between py-1.5 text-gray-600"><span>Subtotal</span><span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span></div>
            {(quotation?.totalDiscountAmount || 0) > 0 && <div className="flex justify-between py-1.5 text-gray-600"><span>Line discounts</span><span className="text-red-600 font-medium">-{formatCurrency(quotation.totalDiscountAmount)}</span></div>}
            {(quotation?.discount || 0) > 0 && <div className="flex justify-between py-1.5 text-gray-600"><span>Discount</span><span className="text-red-600 font-medium">-{formatCurrency(quotation.discount)}</span></div>}
            <div className="flex justify-between py-1.5 text-gray-600"><span>Net subtotal</span><span className="font-medium text-gray-900">{formatCurrency(netSubtotal)}</span></div>
            <div className="flex justify-between py-1.5 text-gray-600"><span>Tax</span><span className="font-medium text-gray-900">{formatCurrency(taxAmount)}</span></div>
            <div className="flex justify-between py-3 mt-1 border-t-2 border-gray-200" style={{ color: primaryColor }}>
              <span className="font-bold">Total</span>
              <span className="font-bold">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes (custom notes only) */}
      {quotation?.notes && (
        <div className="px-6 py-5 border-t border-gray-200 bg-gray-50/40 text-sm text-left">
          <p className="text-gray-700 whitespace-pre-line">{quotation.notes}</p>
        </div>
      )}

      {/* Footer: contact info + centered thank-you */}
      <footer className="px-6 py-6 mt-auto border-t border-gray-200 bg-gray-50/60 text-sm">
        {hasFooterContact && (
          <div className="text-gray-500 space-y-0.5 mb-4">
            {footerPhone.trim() && <p>Tel: {footerPhone.trim()}</p>}
            {footerBankDetails.trim() && <pre className="whitespace-pre-wrap font-sans">{footerBankDetails.trim()}</pre>}
            {branding?.website && <p>Visit: {branding.website}</p>}
          </div>
        )}
        <p className="text-center text-gray-600 font-medium mt-4">
          {branding?.emailFooter || "Thank you for your business!"}
        </p>
      </footer>
    </div>
  );
});

export default QuotationTemplatePreview;

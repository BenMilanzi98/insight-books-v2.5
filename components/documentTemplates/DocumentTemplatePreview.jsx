'use client';

import React, { useEffect, useState } from 'react';
import { tt } from '@/lib/i18n/runtime';
import {
  formatCurrency,
  formatAmount,
  formatAmountForExport,
  formatCurrencyForExport,
  formatDate,
} from '@/lib/invoiceCalculations';
import { multiplyMoney, percentOfMoney, subtractMoney } from '@/lib/money';
import { shouldDisplayDocumentTax, documentHasLineTax } from '@/lib/documentTaxDisplay';
import { parseTemplateContent } from '@/lib/documentTemplates/parseTemplateContent';

const KEEP = 'ib-doc-keep';

function logoSrc(logoUrl) {
  if (!logoUrl) return null;
  return logoUrl.startsWith('/uploads/')
    ? `/api/uploads/${logoUrl.replace(/^\/+uploads\//, '')}`
    : logoUrl;
}

function LogoBlock({ showLogoImage, showCompanyName, logoUrl, branding, className = '', imgClass = 'h-11 object-contain max-h-14' }) {
  if (!showLogoImage && !showCompanyName) return null;
  return (
    <div className={className}>
      {showLogoImage && <img src={logoSrc(logoUrl)} alt="" className={imgClass} />}
      {showCompanyName && (
        <p className="text-lg font-semibold text-gray-900 tracking-tight">
          {branding?.companyName || branding?.name || 'Business'}
        </p>
      )}
    </div>
  );
}

function logoAlignClass(logoPosition) {
  if (logoPosition === 'center') return 'items-center text-center';
  if (logoPosition === 'right') return 'items-end text-right';
  return 'items-start text-left';
}

function logoFlexJustify(logoPosition) {
  if (logoPosition === 'center') return 'justify-center';
  if (logoPosition === 'right') return 'justify-end';
  return 'justify-start';
}

/**
 * Shared live preview for invoices and quotations across all 10 layouts.
 */
export default function DocumentTemplatePreview({
  template,
  branding,
  document: documentProp,
  invoice,
  quotation,
  documentType = 'invoice',
  isPrint = false,
}) {
  const [logoError, setLogoError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  const rawDoc = documentProp || invoice || quotation || null;
  const isQuote = documentType === 'quotation' || (!!quotation && !invoice && !documentProp);

  const appearance = parseTemplateContent(template?.content);
  const {
    layoutId,
    showLogo = true,
    showFooter = true,
    primaryColor,
    logoPosition,
  } = appearance;

  const logoUrl =
    branding?.logoUrl && String(branding.logoUrl).trim()
      ? String(branding.logoUrl).trim()
      : null;

  useEffect(() => {
    setLogoError(false);
    setLogoLoaded(false);
    if (!logoUrl) return undefined;
    const img = new Image();
    img.onload = () => setLogoLoaded(true);
    img.onerror = () => setLogoError(true);
    img.src = logoSrc(logoUrl);
    return () => {
      img.src = '';
    };
  }, [logoUrl]);

  const formatAmountDisplay = isPrint ? formatAmountForExport : formatAmount;
  const formatCurrencyDisplay = isPrint
    ? (amount, code) => formatCurrencyForExport(amount, code || 'MWK')
    : formatCurrency;

  const sellerTpin = branding?.tpin || branding?.tpinNumber || '';
  const hasLogoUrl = !!logoUrl;
  const showLogoImage = showLogo && hasLogoUrl && !logoError && logoLoaded;
  const showCompanyName = !hasLogoUrl || logoError || (hasLogoUrl && !logoLoaded);
  const hasLogoAreaContent = showLogoImage || showCompanyName;

  const sampleData = {
    docNumber: isQuote ? 'QUO-0001' : 'INV-0001',
    title: isQuote ? 'Sample Quotation' : 'Sample Invoice Title',
    orderNumber: 'ORD-SAMPLE-001',
    issueDate: formatSampleDate(new Date()),
    dueDate: formatSampleDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    status: 'Draft',
    client: {
      name: 'Sample Client',
      contactPerson: 'John Doe',
      address: '123 Client Street',
      email: 'client@example.com',
      phone: '123-456-7890',
    },
    items: [
      { description: 'Service Item 1', quantity: 1, unitPrice: 100, taxRate: 10, amount: 100 },
      { description: 'Product Item 2', quantity: 2, unitPrice: 50, taxRate: 10, amount: 100 },
    ],
    subtotal: 200,
    taxAmount: 20,
    total: 220,
    discount: 0,
    totalDiscountAmount: 0,
    notes: 'Thank you for your business!',
  };

  const source = rawDoc || sampleData;
  const displayData = normalizeDocument(source, isQuote, sampleData);

  const footerPhone =
    displayData.footerPhoneOverride != null && displayData.footerPhoneOverride !== ''
      ? displayData.footerPhoneOverride
      : branding?.businessPhone || branding?.companyPhone || branding?.phone || '';
  const footerBankDetails =
    displayData.footerBankDetailsOverride != null && displayData.footerBankDetailsOverride !== ''
      ? displayData.footerBankDetailsOverride
      : branding?.defaultBankDetails || '';
  const hasFooterContact = showFooter && (String(footerPhone).trim() || String(footerBankDetails).trim());

  const showLineTax = documentHasLineTax(displayData.items);
  const showDocumentTax = shouldDisplayDocumentTax({
    taxAmount: displayData.taxAmount,
    taxLines: (displayData.items || []).flatMap((item) => item.itemTaxes || item.taxes || []),
  });

  const docLabel = isQuote ? tt('Quotation') : tt('Invoice');
  const dueLabel = isQuote ? tt('Valid until') : tt('Due date');

  const logoProps = { showLogoImage, showCompanyName, logoUrl, branding };
  const shared = {
    displayData,
    primaryColor,
    logoPosition,
    logoProps,
    hasLogoAreaContent,
    sellerTpin,
    docLabel,
    dueLabel,
    isPrint,
    formatAmountDisplay,
    formatCurrencyDisplay,
    showLineTax,
    showDocumentTax,
    hasFooterContact,
    footerPhone,
    footerBankDetails,
    showFooter,
    branding,
  };

  const shell = (children, extraClass = '') => (
    <div
      className={`bg-white ${isPrint ? '' : 'border border-gray-200 rounded-xl shadow-sm'} mx-auto max-w-3xl overflow-hidden ${extraClass}`}
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <style>{`
        .${KEEP} { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          .${KEEP} { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      {children}
    </div>
  );

  switch (layoutId) {
    case 'modern':
      return shell(<ModernLayout {...shared} />);
    case 'bold-bar':
      return shell(<BoldBarLayout {...shared} />);
    case 'minimal':
      return shell(<MinimalLayout {...shared} />, 'p-8');
    case 'compact':
      return shell(<CompactLayout {...shared} />, 'p-5');
    case 'editorial':
      return shell(<EditorialLayout {...shared} />);
    case 'band-header':
      return shell(<BandHeaderLayout {...shared} />);
    case 'split-brand':
      return shell(<SplitBrandLayout {...shared} />);
    case 'soft-card':
      return shell(<SoftCardLayout {...shared} />);
    case 'ledger':
      return shell(<LedgerLayout {...shared} />);
    case 'classic':
    default:
      return shell(<ClassicLayout {...shared} />);
  }
}

function formatSampleDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

function normalizeDocument(source, isQuote, sample) {
  if (!source || source === sample) return sample;
  const issue =
    typeof source.issueDate === 'string'
      ? source.issueDate
      : source.issueDate
        ? formatDate(source.issueDate)
        : sample.issueDate;
  const dueRaw = isQuote ? source.validUntil || source.dueDate : source.dueDate;
  const due =
    typeof dueRaw === 'string'
      ? dueRaw
      : dueRaw
        ? formatDate(dueRaw)
        : sample.dueDate;

  return {
    ...source,
    docNumber: source.docNumber || source.invoiceNumber || source.quotationNumber || sample.docNumber,
    title: source.title || sample.title,
    orderNumber: source.orderNumber,
    issueDate: issue,
    dueDate: due,
    status: source.status || sample.status,
    client: source.client || sample.client,
    items: source.items || sample.items,
    subtotal: source.subtotal ?? sample.subtotal,
    taxAmount: source.taxAmount ?? sample.taxAmount,
    total: source.total ?? sample.total,
    discount: source.discount || 0,
    totalDiscountAmount: source.totalDiscountAmount || 0,
    notes: source.notes,
    paymentInfo: source.paymentInfo,
    payments: source.payments,
    footerPhoneOverride: source.footerPhoneOverride,
    footerBankDetailsOverride: source.footerBankDetailsOverride,
  };
}

function LineItemsTable({
  displayData,
  formatAmountDisplay,
  showLineTax,
  dense = false,
  bordered = false,
  headerBg,
  primaryColor,
}) {
  const thPad = dense ? 'py-2' : 'py-3';
  const tdPad = dense ? 'py-2' : 'py-3.5';
  return (
    <table className={`w-full text-sm ${bordered ? 'border border-gray-300' : ''}`}>
      <thead>
        <tr
          className={bordered ? 'border-b border-gray-300' : 'border-b-2 border-gray-200'}
          style={headerBg ? { backgroundColor: headerBg } : undefined}
        >
          <th className={`text-left ${thPad} font-semibold text-gray-700`}>{tt('Item')}</th>
          <th className={`text-right ${thPad} font-semibold text-gray-700 w-16`}>{tt('Qty')}</th>
          <th className={`text-right ${thPad} font-semibold text-gray-700`}>{tt('Rate')}</th>
          <th className={`text-right ${thPad} font-semibold text-gray-700`}>{tt('Discount')}</th>
          {showLineTax && (
            <th className={`text-right ${thPad} font-semibold text-gray-700`}>{tt('Tax')}</th>
          )}
          <th className={`text-right ${thPad} font-semibold text-gray-700`}>{tt('Amount')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {displayData.items?.map((item, index) => (
          <tr key={index} className={index % 2 === 1 ? 'bg-gray-50/50' : ''}>
            <td className={`${tdPad} text-gray-900 font-medium`}>{item.description}</td>
            <td className={`${tdPad} text-right text-gray-600`}>{item.quantity}</td>
            <td className={`${tdPad} text-right text-gray-600`}>
              {formatAmountDisplay(item.unitPrice)}
            </td>
            <td className={`${tdPad} text-right`}>
              {item.discountAmount > 0 ? (
                <span className="text-red-600">-{formatAmountDisplay(item.discountAmount)}</span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            {showLineTax && (
              <td className={`${tdPad} text-right text-gray-600`}>
                {item.itemTaxes?.length > 0
                  ? item.itemTaxes
                      .map((t) => `${t.taxName}: ${formatAmountDisplay(t.taxAmount)}`)
                      .join(' · ')
                  : item.taxRate > 0
                    ? `${item.taxRate}% · ${formatAmountDisplay(
                        item.lineTaxAmount ??
                          percentOfMoney(
                            item.netAmount ??
                              subtractMoney(
                                multiplyMoney(item.quantity, item.unitPrice),
                                item.discountAmount || 0
                              ),
                            item.taxRate || 0
                          )
                      )}`
                    : '—'}
              </td>
            )}
            <td className={`${tdPad} text-right font-medium text-gray-900`}>
              {formatAmountDisplay(item.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalsBlock({
  displayData,
  formatCurrencyDisplay,
  showDocumentTax,
  primaryColor,
  variant = 'card',
}) {
  const body = (
    <>
      {displayData.totalDiscountAmount > 0 && (
        <div className="flex justify-between py-1.5 text-gray-600">
          <span>{tt('Line discounts')}</span>
          <span className="text-red-600 font-medium">
            -{formatCurrencyDisplay(displayData.totalDiscountAmount)}
          </span>
        </div>
      )}
      {displayData.discount > 0 && (
        <div className="flex justify-between py-1.5 text-gray-600">
          <span>{tt('Discount')}</span>
          <span className="text-red-600 font-medium">
            -{formatCurrencyDisplay(displayData.discount)}
          </span>
        </div>
      )}
      <div className="flex justify-between py-1.5 text-gray-600">
        <span>{tt('Subtotal')}</span>
        <span className="font-medium text-gray-900">
          {formatCurrencyDisplay(displayData.subtotal)}
        </span>
      </div>
      {showDocumentTax && (
        <div className="flex justify-between py-1.5 text-gray-600">
          <span>{tt('Tax')}</span>
          <span className="font-medium text-gray-900">
            {formatCurrencyDisplay(displayData.taxAmount)}
          </span>
        </div>
      )}
      <div
        className="flex justify-between py-3 mt-1 border-t-2 border-gray-200"
        style={{ color: primaryColor }}
      >
        <span className="font-bold">{tt('Total')}</span>
        <span className="font-bold">{formatCurrencyDisplay(displayData.total)}</span>
      </div>
      {displayData.paymentInfo &&
        (displayData.paymentInfo.totalPaid > 0 || (displayData.payments?.length ?? 0) > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
            <div className="flex justify-between text-gray-600">
              <span>{tt('Paid')}</span>
              <span className="font-medium text-green-600">
                {formatCurrencyDisplay(displayData.paymentInfo.totalPaid)}
              </span>
            </div>
            {displayData.paymentInfo.outstandingAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{tt('Outstanding')}</span>
                <span className="font-medium text-red-600">
                  {formatCurrencyDisplay(displayData.paymentInfo.outstandingAmount)}
                </span>
              </div>
            )}
          </div>
        )}
    </>
  );

  if (variant === 'plain') {
    return <div className={`${KEEP} w-64 text-sm`}>{body}</div>;
  }
  if (variant === 'tint') {
    return (
      <div
        className={`${KEEP} w-72 p-4 rounded-md text-sm`}
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        {body}
      </div>
    );
  }
  return (
    <div className={`${KEEP} w-64 rounded-lg border border-gray-200 bg-gray-50/80 p-4 text-sm`}>
      {body}
    </div>
  );
}

function DocFooter({
  hasFooterContact,
  footerPhone,
  footerBankDetails,
  showFooter,
  branding,
  className = 'px-6 py-6 border-t border-gray-200 bg-gray-50/60 text-sm',
}) {
  return (
    <footer className={`${KEEP} ${className}`}>
      {hasFooterContact && (
        <div className="text-gray-500 space-y-0.5 mb-4">
          {String(footerPhone).trim() && <p>Tel: {String(footerPhone).trim()}</p>}
          {String(footerBankDetails).trim() && (
            <pre className="whitespace-pre-wrap font-sans">{String(footerBankDetails).trim()}</pre>
          )}
        </div>
      )}
      <p className="text-center text-gray-600 font-medium mt-4">
        {showFooter && branding?.emailFooter
          ? branding.emailFooter
          : 'Thank you for your business!'}
      </p>
    </footer>
  );
}

function MetaGrid({ displayData, dueLabel }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <div>
        <p className="text-gray-500">{tt('Order #')}</p>
        <p className="text-gray-900">{displayData.orderNumber || '—'}</p>
      </div>
      <div>
        <p className="text-gray-500">{tt('Issue date')}</p>
        <p className="text-gray-900">{displayData.issueDate}</p>
      </div>
      <div>
        <p className="text-gray-500">{dueLabel}</p>
        <p className="text-gray-900">{displayData.dueDate}</p>
      </div>
    </div>
  );
}

function BillTo({ displayData }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
        {tt('Bill to')}
      </p>
      <p className="font-semibold text-gray-900">{displayData.client?.name}</p>
      {displayData.client?.contactPerson && (
        <p className="text-sm text-gray-600">Attn: {displayData.client.contactPerson}</p>
      )}
      {displayData.client?.address && (
        <p className="text-sm text-gray-600 mt-1">{displayData.client.address}</p>
      )}
      <p className="text-sm text-gray-600">{displayData.client?.email}</p>
      {displayData.client?.phone && (
        <p className="text-sm text-gray-600">Tel: {displayData.client.phone}</p>
      )}
    </div>
  );
}

function ClassicLayout(p) {
  return (
    <>
      <div className="border-l-4 px-6 pt-6 pb-4" style={{ borderLeftColor: p.primaryColor }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className={`min-w-0 flex flex-col ${logoAlignClass(p.logoPosition)}`}>
            {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} />}
            {p.sellerTpin && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">{tt('TPIN:')}</span> {p.sellerTpin}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-gray-900">{p.docLabel}</p>
            <p className="text-sm text-gray-500 mt-0.5">#{p.displayData.docNumber}</p>
            <span className="inline-block mt-2 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700">
              {p.displayData.status}
            </span>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50/60">
        <BillTo displayData={p.displayData} />
        <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
      </div>
      <div className="px-6 py-5">
        <h2 className="text-center text-lg font-semibold text-gray-900 mb-4">
          {p.displayData.title?.trim() || p.docLabel}
        </h2>
        <LineItemsTable {...p} />
        <div className="mt-6 flex justify-end">
          <TotalsBlock {...p} />
        </div>
      </div>
      {p.displayData.notes && (
        <div className={`${KEEP} px-6 py-5 border-t border-gray-200 bg-gray-50/40 text-sm`}>
          <p className="text-gray-700 whitespace-pre-line">{p.displayData.notes}</p>
        </div>
      )}
      <DocFooter {...p} />
    </>
  );
}

function ModernLayout(p) {
  return (
    <div className="p-8">
      <div className="p-6 mb-6 rounded-md" style={{ backgroundColor: p.primaryColor }}>
        <div className={`flex items-center gap-4 ${logoFlexJustify(p.logoPosition)}`}>
          {p.logoPosition !== 'right' && (
            <div>
              <h2 className="text-3xl font-bold text-white uppercase">{p.docLabel}</h2>
              <p className="text-white opacity-80 mt-1">#{p.displayData.docNumber}</p>
            </div>
          )}
          {p.hasLogoAreaContent && (
            <LogoBlock
              {...p.logoProps}
              imgClass="h-16 object-contain bg-white p-2 rounded"
              className={p.logoPosition === 'center' ? 'mx-auto' : ''}
            />
          )}
          {p.logoPosition === 'right' && (
            <div className="ml-auto text-right">
              <h2 className="text-3xl font-bold text-white uppercase">{p.docLabel}</h2>
              <p className="text-white opacity-80 mt-1">#{p.displayData.docNumber}</p>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="p-4 bg-gray-50 rounded-md">
          <BillTo displayData={p.displayData} />
        </div>
        <div className="p-4 bg-gray-50 rounded-md">
          <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
        </div>
      </div>
      <LineItemsTable {...p} headerBg={`${p.primaryColor}15`} />
      <div className="mt-6 flex justify-end">
        <TotalsBlock {...p} variant="tint" />
      </div>
      {p.displayData.notes && (
        <div className={`${KEEP} mt-8 pt-4 border-t text-sm`}>{p.displayData.notes}</div>
      )}
      <DocFooter {...p} className="mt-8 pt-6 border-t text-sm" />
    </div>
  );
}

function BoldBarLayout(p) {
  return (
    <>
      <div className="h-3 w-full" style={{ backgroundColor: p.primaryColor }} />
      <div className="px-8 pt-6 pb-4">
        <div className={`flex flex-col gap-3 ${logoAlignClass(p.logoPosition)}`}>
          {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} imgClass="h-12 object-contain" />}
          <div>
            <p className="text-4xl font-black tracking-tight text-gray-900">{p.docLabel}</p>
            <p className="text-sm text-gray-500 mt-1">
              #{p.displayData.docNumber} · {p.displayData.status}
            </p>
          </div>
        </div>
      </div>
      <div className="px-8 py-5 grid grid-cols-2 gap-6 border-y border-gray-100">
        <BillTo displayData={p.displayData} />
        <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
      </div>
      <div className="px-8 py-5">
        <LineItemsTable {...p} />
        <div className="mt-6 flex justify-end">
          <TotalsBlock {...p} />
        </div>
      </div>
      <DocFooter {...p} />
    </>
  );
}

function MinimalLayout(p) {
  return (
    <>
      <div className={`mb-8 flex flex-col gap-2 ${logoAlignClass(p.logoPosition)}`}>
        {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} imgClass="h-10 object-contain" />}
        <h2 className="text-2xl font-normal" style={{ color: p.primaryColor }}>
          {p.docLabel} #{p.displayData.docNumber}
        </h2>
        <p className="text-gray-500 text-sm">
          {tt('Issue date')}: {p.displayData.issueDate}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <BillTo displayData={p.displayData} />
        <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
      </div>
      <LineItemsTable {...p} />
      <div className="mt-8 flex justify-end">
        <TotalsBlock {...p} variant="plain" />
      </div>
      <DocFooter {...p} className="mt-10 pt-6 border-t text-sm" />
    </>
  );
}

function CompactLayout(p) {
  return (
    <>
      <div className={`flex justify-between gap-3 mb-4 ${logoFlexJustify(p.logoPosition)}`}>
        {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} imgClass="h-8 object-contain" />}
        <div className="text-right ml-auto">
          <p className="text-sm font-bold uppercase tracking-wide">{p.docLabel}</p>
          <p className="text-xs text-gray-500">#{p.displayData.docNumber}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
        <BillTo displayData={p.displayData} />
        <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
      </div>
      <LineItemsTable {...p} dense />
      <div className="mt-3 flex justify-end">
        <TotalsBlock {...p} />
      </div>
      <DocFooter {...p} className="mt-4 pt-3 border-t text-xs" />
    </>
  );
}

function EditorialLayout(p) {
  return (
    <>
      <div className="px-8 pt-8 pb-4">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] mb-2"
          style={{ color: p.primaryColor }}
        >
          {p.docLabel}
        </p>
        <div className={`flex flex-col gap-4 ${logoAlignClass(p.logoPosition)}`}>
          {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} />}
          <h1 className="text-3xl font-serif font-semibold text-gray-900 max-w-xl">
            {p.displayData.title?.trim() || `${p.docLabel} ${p.displayData.docNumber}`}
          </h1>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-600">
          <span>#{p.displayData.docNumber}</span>
          <span>
            {tt('Issue date')}: {p.displayData.issueDate}
          </span>
          <span>
            {p.dueLabel}: {p.displayData.dueDate}
          </span>
        </div>
      </div>
      <div className="px-8 py-5 border-t border-gray-200">
        <BillTo displayData={p.displayData} />
      </div>
      <div className="px-8 py-5">
        <LineItemsTable {...p} />
        <div className="mt-6 flex justify-end">
          <TotalsBlock {...p} />
        </div>
      </div>
      <DocFooter {...p} />
    </>
  );
}

function BandHeaderLayout(p) {
  return (
    <>
      <div className="grid grid-cols-5">
        <div className="col-span-2 p-6 text-white" style={{ backgroundColor: p.primaryColor }}>
          <div className={`flex flex-col gap-2 ${logoAlignClass(p.logoPosition)}`}>
            {p.hasLogoAreaContent && (
              <LogoBlock
                {...p.logoProps}
                imgClass="h-12 object-contain bg-white/90 p-1 rounded"
                className="text-white"
              />
            )}
            <p className="text-sm opacity-90">{brandingName(p)}</p>
          </div>
        </div>
        <div className="col-span-3 p-6 bg-slate-800 text-white">
          <p className="text-2xl font-bold uppercase tracking-wide">{p.docLabel}</p>
          <p className="text-slate-300 mt-1">#{p.displayData.docNumber}</p>
          <p className="text-xs text-slate-400 mt-3">
            {tt('Issue date')}: {p.displayData.issueDate} · {p.dueLabel}: {p.displayData.dueDate}
          </p>
        </div>
      </div>
      <div className="px-6 py-5 grid grid-cols-2 gap-6">
        <BillTo displayData={p.displayData} />
        <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
      </div>
      <div className="px-6 py-5">
        <LineItemsTable {...p} headerBg={`${p.primaryColor}12`} />
        <div className="mt-6 flex justify-end">
          <TotalsBlock {...p} variant="tint" />
        </div>
      </div>
      <DocFooter {...p} />
    </>
  );
}

function brandingName(p) {
  return p.branding?.companyName || p.branding?.name || 'Business';
}

function SplitBrandLayout(p) {
  return (
    <>
      <div className="grid grid-cols-2 border-b border-gray-200">
        <div className={`p-6 flex flex-col gap-2 ${logoAlignClass(p.logoPosition)}`}>
          {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} />}
          {p.sellerTpin && (
            <p className="text-xs text-gray-500">
              {tt('TPIN:')} {p.sellerTpin}
            </p>
          )}
        </div>
        <div className="p-6 bg-gray-50 border-l border-gray-200">
          <p className="text-xl font-bold" style={{ color: p.primaryColor }}>
            {p.docLabel}
          </p>
          <p className="text-sm text-gray-600 mt-1">#{p.displayData.docNumber}</p>
          <div className="mt-3">
            <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        <BillTo displayData={p.displayData} />
      </div>
      <div className="px-6 py-5">
        <LineItemsTable {...p} />
        <div className="mt-6 flex justify-end">
          <TotalsBlock {...p} />
        </div>
      </div>
      <DocFooter {...p} />
    </>
  );
}

function SoftCardLayout(p) {
  return (
    <div className="p-6 space-y-4">
      <div
        className={`rounded-2xl border border-gray-100 bg-white shadow-sm p-5 flex flex-col gap-2 ${logoAlignClass(p.logoPosition)}`}
      >
        {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} />}
        <p className="text-2xl font-semibold text-gray-900">{p.docLabel}</p>
        <p className="text-sm text-gray-500">#{p.displayData.docNumber}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gray-50 p-4">
          <BillTo displayData={p.displayData} />
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
        </div>
      </div>
      <div className="rounded-2xl border border-gray-100 p-4">
        <LineItemsTable {...p} />
      </div>
      <div className="flex justify-end">
        <div className={`${KEEP} rounded-2xl shadow-sm border border-gray-100 p-4 w-64`}>
          <TotalsBlock {...p} variant="plain" />
        </div>
      </div>
      <DocFooter {...p} className="rounded-2xl bg-gray-50 p-4 text-sm" />
    </div>
  );
}

function LedgerLayout(p) {
  return (
    <>
      <div className="px-6 pt-6 pb-3 border-b-2 border-gray-800">
        <div className={`flex flex-col gap-2 ${logoAlignClass(p.logoPosition)}`}>
          {p.hasLogoAreaContent && <LogoBlock {...p.logoProps} imgClass="h-9 object-contain" />}
          <div className="flex flex-wrap items-baseline justify-between gap-2 w-full">
            <p className="text-lg font-bold uppercase tracking-wider">{p.docLabel}</p>
            <p className="font-mono text-sm">#{p.displayData.docNumber}</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm border-b border-gray-300">
        <BillTo displayData={p.displayData} />
        <MetaGrid displayData={p.displayData} dueLabel={p.dueLabel} />
      </div>
      <div className="px-6 py-4">
        <LineItemsTable {...p} bordered dense headerBg="#f5f5f4" />
        <div className="mt-4 flex justify-end">
          <TotalsBlock {...p} variant="plain" />
        </div>
      </div>
      <DocFooter {...p} className="px-6 py-4 border-t border-gray-800 text-xs" />
    </>
  );
}

// lib/server-pdf-html.js
// Server-side HTML templates for Puppeteer PDF rendering.
// Mirrors the website's InvoiceTemplatePreview / QuotationTemplatePreview components.
import { formatCurrencyForExport, formatAmountForExport, formatDate } from './invoiceCalculations';

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtCurrency(amount, code = 'MWK') {
  return formatCurrencyForExport(amount, code);
}

function fmtAmount(amount) {
  return formatAmountForExport(amount);
}

function logoImg(branding) {
  const url = branding?.logoUrl;
  if (!url) return '';
  const src = url.startsWith('/uploads/')
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/uploads/${url.replace(/^\/+uploads\//, '')}`
    : url;
  return `<img src="${esc(src)}" alt="" style="height:44px;object-fit:contain;max-height:56px;">`;
}

// Shared CSS reset + layout styles (inline, no Tailwind dependency)
const baseStyles = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5;background:#fff;margin:0;padding:0}
.page{max-width:210mm;margin:0 auto;background:#fff}
table{border-collapse:collapse;width:100%}
`;

// ---------------------------------------------------------------------------
// INVOICE HTML
// ---------------------------------------------------------------------------

export function generateInvoiceHtml(invoice, template, branding) {
  const content = typeof template?.content === 'string'
    ? JSON.parse(template.content)
    : template?.content || {};
  const primaryColor = content.primaryColor || branding?.primaryColor || '#4f46e5';
  const showFooter = content.showFooter !== false;

  const sellerTpin = (branding?.tpin && String(branding.tpin).trim()) || '';
  const footerPhone = (invoice?.footerPhoneOverride != null && invoice?.footerPhoneOverride !== '')
    ? invoice.footerPhoneOverride : (branding?.businessPhone || '');
  const footerBankDetails = (invoice?.footerBankDetailsOverride != null && invoice?.footerBankDetailsOverride !== '')
    ? invoice.footerBankDetailsOverride : (branding?.defaultBankDetails || '');

  const items = (invoice.items || []).map(item => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.unitPrice) || 0;
    const disc = parseFloat(item.discountAmount) || 0;
    const taxRate = parseFloat(item.taxRate) || 0;
    const net = qty * rate - disc;
    const taxAmt = net * (taxRate / 100);
    const amount = net + taxAmt;
    return { ...item, qty, rate, disc, taxRate, taxAmt, net, amount };
  });

  const itemRows = items.map((it, i) => `
    <tr style="background:${i % 2 === 1 ? '#f9fafb' : '#fff'}">
      <td style="padding:10px 8px;color:#111827;font-weight:500">${esc(it.description)}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${it.qty}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${fmtAmount(it.rate)}</td>
      <td style="padding:10px 8px;text-align:right">${it.disc > 0 ? `<span style="color:#dc2626">-${fmtAmount(it.disc)}</span>` : '<span style="color:#9ca3af">\u2014</span>'}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${it.taxRate > 0 ? `${it.taxRate}%` : '\u2014'}</td>
      <td style="padding:10px 8px;text-align:right;font-weight:500;color:#111827">${fmtAmount(it.amount)}</td>
    </tr>`).join('');

  const payments = invoice.payments || [];
  const totalPaid = payments
    .filter(p => p.status !== 'reversed' && !p.isReversal)
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const outstanding = (parseFloat(invoice.total) || 0) - totalPaid;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
<div class="page" style="padding:28px">
  <!-- Header -->
  <div style="border-left:4px solid ${primaryColor};padding:24px 24px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        ${logoImg(branding) || `<p style="font-size:18px;font-weight:600;color:#111827">${esc(branding?.companyName || 'Company')}</p>`}
        ${sellerTpin ? `<p style="margin-top:8px;font-size:12px;color:#4b5563"><b>TPIN:</b> ${esc(sellerTpin)}</p>` : ''}
      </div>
      <div style="text-align:right">
        <p style="font-size:24px;font-weight:700;color:#111827">Invoice</p>
        <p style="font-size:14px;color:#6b7280;margin-top:2px">#${esc(invoice.invoiceNumber)}</p>
        <span style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:6px;background:#f3f4f6;color:#374151">${esc(invoice.status)}</span>
      </div>
    </div>
  </div>

  <!-- Bill To + Details -->
  <div style="padding:20px 24px;display:flex;gap:32px;background:#f9fafb">
    <div style="flex:1">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px">Bill to</p>
      <p style="font-weight:600;color:#111827">${esc(invoice.client?.name)}</p>
      ${invoice.client?.contactPerson ? `<p style="font-size:14px;color:#4b5563">Attn: ${esc(invoice.client.contactPerson)}</p>` : ''}
      ${invoice.client?.address ? `<p style="font-size:14px;color:#4b5563;margin-top:4px">${esc(invoice.client.address)}</p>` : ''}
      <p style="font-size:14px;color:#4b5563">${esc(invoice.client?.email)}</p>
      ${invoice.client?.phone ? `<p style="font-size:14px;color:#4b5563">Tel: ${esc(invoice.client.phone)}</p>` : ''}
    </div>
    <div style="flex:1">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:14px">
        <div><p style="color:#6b7280">Order #</p><p style="color:#111827">${esc(invoice.orderNumber) || '\u2014'}</p></div>
        <div><p style="color:#6b7280">Issue date</p><p style="color:#111827">${formatDate(invoice.issueDate)}</p></div>
        <div><p style="color:#6b7280">Due date</p><p style="color:#111827">${formatDate(invoice.dueDate)}</p></div>
      </div>
    </div>
  </div>

  <!-- Items -->
  <div style="padding:20px 24px">
    <h2 style="text-align:center;font-size:18px;font-weight:600;color:#111827;margin-bottom:16px">${esc(invoice.title?.trim?.()) || 'Invoice'}</h2>
    <table style="font-size:14px">
      <thead>
        <tr style="border-bottom:2px solid #e5e7eb">
          <th style="text-align:left;padding:12px 8px;font-weight:600;color:#374151">Item</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151;width:50px">Qty</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Rate</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Discount</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Tax</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <div style="width:256px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:16px;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Subtotal</span><span style="font-weight:500;color:#111827">${fmtCurrency(invoice.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Tax</span><span style="font-weight:500;color:#111827">${fmtCurrency(invoice.taxAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:12px 0 4px;margin-top:4px;border-top:2px solid #e5e7eb;color:${primaryColor}"><span style="font-weight:700">Total</span><span style="font-weight:700">${fmtCurrency(invoice.total)}</span></div>
        ${totalPaid > 0 ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb">
          <div style="display:flex;justify-content:space-between;padding:4px 0;color:#4b5563"><span>Paid</span><span style="font-weight:500;color:#059669">${fmtCurrency(totalPaid)}</span></div>
          ${outstanding > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#4b5563"><span>Outstanding</span><span style="font-weight:500;color:#dc2626">${fmtCurrency(outstanding)}</span></div>` : ''}
        </div>` : ''}
      </div>
    </div>
  </div>

  ${invoice.notes ? `<div style="padding:20px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:14px;color:#374151;white-space:pre-line">${esc(invoice.notes)}</div>` : ''}

  <!-- Footer -->
  ${showFooter ? `
  <footer style="padding:24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:14px">
    ${(footerPhone || footerBankDetails) ? `<div style="color:#6b7280;margin-bottom:16px">
      ${footerPhone ? `<p>Tel: ${esc(footerPhone)}</p>` : ''}
      ${footerBankDetails ? `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${esc(footerBankDetails)}</pre>` : ''}
    </div>` : ''}
    <p style="text-align:center;color:#4b5563;font-weight:500">${esc(branding?.emailFooter || 'Thank you for your business!')}</p>
  </footer>` : ''}
</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// QUOTATION HTML
// ---------------------------------------------------------------------------

export function generateQuotationHtml(quotation, template, branding) {
  const content = typeof template?.content === 'string'
    ? JSON.parse(template.content)
    : template?.content || {};
  const primaryColor = content.primaryColor || branding?.primaryColor || '#4f46e5';
  const showFooter = content.showFooter !== false;

  const items = (quotation.items || []).map(item => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.unitPrice) || 0;
    const taxRate = parseFloat(item.taxRate) || 0;
    const net = qty * rate;
    const taxAmt = net * (taxRate / 100);
    const amount = net + taxAmt;
    return { ...item, qty, rate, taxRate, taxAmt, net, amount };
  });

  const itemRows = items.map((it, i) => `
    <tr style="background:${i % 2 === 1 ? '#f9fafb' : '#fff'}">
      <td style="padding:10px 8px;color:#111827;font-weight:500">${esc(it.description)}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${it.qty}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${fmtAmount(it.rate)}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${it.taxRate > 0 ? `${it.taxRate}%` : '\u2014'}</td>
      <td style="padding:10px 8px;text-align:right;font-weight:500;color:#111827">${fmtAmount(it.amount)}</td>
    </tr>`).join('');

  const client = quotation.client || {};

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
<div class="page" style="padding:28px">
  <!-- Header -->
  <div style="border-left:4px solid ${primaryColor};padding:24px 24px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        ${logoImg(branding) || `<p style="font-size:18px;font-weight:600;color:#111827">${esc(branding?.companyName || 'Company')}</p>`}
      </div>
      <div style="text-align:right">
        <p style="font-size:24px;font-weight:700;color:#111827">Quotation</p>
        <p style="font-size:14px;color:#6b7280;margin-top:2px">#${esc(quotation.quotationNumber)}</p>
        <span style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:6px;background:#f3f4f6;color:#374151">${esc(quotation.status)}</span>
      </div>
    </div>
  </div>

  <!-- Client + Details -->
  <div style="padding:20px 24px;display:flex;gap:32px;background:#f9fafb">
    <div style="flex:1">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px">Quotation for</p>
      <p style="font-weight:600;color:#111827">${esc(client.name)}</p>
      ${client.contactPerson ? `<p style="font-size:14px;color:#4b5563">Attn: ${esc(client.contactPerson)}</p>` : ''}
      ${client.address ? `<p style="font-size:14px;color:#4b5563;margin-top:4px">${esc(client.address)}</p>` : ''}
      <p style="font-size:14px;color:#4b5563">${esc(client.email)}</p>
      ${client.phone ? `<p style="font-size:14px;color:#4b5563">Tel: ${esc(client.phone)}</p>` : ''}
    </div>
    <div style="flex:1">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:14px">
        <div><p style="color:#6b7280">Issue date</p><p style="color:#111827">${quotation.issueDate || ''}</p></div>
        <div><p style="color:#6b7280">Valid until</p><p style="color:#111827">${quotation.validUntil || ''}</p></div>
      </div>
    </div>
  </div>

  <!-- Items -->
  <div style="padding:20px 24px">
    <h2 style="text-align:center;font-size:18px;font-weight:600;color:#111827;margin-bottom:16px">${esc(quotation.title?.trim?.()) || 'Quotation'}</h2>
    <table style="font-size:14px">
      <thead>
        <tr style="border-bottom:2px solid #e5e7eb">
          <th style="text-align:left;padding:12px 8px;font-weight:600;color:#374151">Description</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151;width:50px">Qty</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Rate</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Tax</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <div style="width:256px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:16px;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Subtotal</span><span style="font-weight:500;color:#111827">${fmtCurrency(quotation.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Tax</span><span style="font-weight:500;color:#111827">${fmtCurrency(quotation.taxAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:12px 0 4px;margin-top:4px;border-top:2px solid #e5e7eb;color:${primaryColor}"><span style="font-weight:700">Total</span><span style="font-weight:700">${fmtCurrency(quotation.total)}</span></div>
      </div>
    </div>
  </div>

  ${quotation.notes ? `<div style="padding:20px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:14px;color:#374151;white-space:pre-line">${esc(quotation.notes)}</div>` : ''}

  ${showFooter ? `
  <footer style="padding:24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:14px">
    ${(branding?.businessPhone || branding?.defaultBankDetails) ? `<div style="color:#6b7280;margin-bottom:16px">
      ${branding.businessPhone ? `<p>Tel: ${esc(branding.businessPhone)}</p>` : ''}
      ${branding.defaultBankDetails ? `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${esc(branding.defaultBankDetails)}</pre>` : ''}
    </div>` : ''}
    <p style="text-align:center;color:#4b5563;font-weight:500">${esc(branding?.emailFooter || 'Thank you for your business!')}</p>
  </footer>` : ''}
</div>
</body></html>`;
}

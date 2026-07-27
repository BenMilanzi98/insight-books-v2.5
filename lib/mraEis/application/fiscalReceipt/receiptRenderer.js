/**
 * Phase 14 — deterministic HTML / thermal / A4 PDF renderers from immutable Receipt Data.
 * No remote URL fetch. No tenant-supplied HTML/JS. No credentials in metadata.
 */

import crypto from 'crypto';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RECEIPT_TYPE } from './receiptContractRegistry.js';

export const HTML_RENDERER_VERSION = 'phase14-html-v1';
export const PDF_RENDERER_VERSION = 'phase14-jspdf-v1';
export const THERMAL_RENDERER_VERSION = 'phase14-thermal80-v1';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(v, code = 'MWK') {
  if (v == null || v === '') return '';
  return `${code} ${v}`;
}

/**
 * Render POS 80mm / browser-print HTML.
 */
export function renderPos80Html({ receiptData, qrPngDataUrl = null, paperWidthMm = 80 } = {}) {
  const d = receiptData;
  const sandbox = d.sandbox
    ? `<div class="banner sandbox">${esc(d.footer?.sandboxBanner || 'SANDBOX / TEST')}</div>`
    : '';
  const reprint =
    d.originalOrReprint === 'REPRINT'
      ? `<div class="banner reprint">${esc(d.footer?.originalOrReprintWording)}</div>`
      : `<div class="banner original">${esc(d.footer?.originalOrReprintWording || 'ORIGINAL')}</div>`;

  const lines = (d.lines || [])
    .map(
      (l) => `<tr>
      <td>${esc(l.lineNumber)}</td>
      <td>${esc(l.description)}</td>
      <td class="num">${esc(l.quantity)}</td>
      <td class="num">${esc(l.lineTotal)}</td>
    </tr>`
    )
    .join('');

  const tax = (d.taxSummary || [])
    .map(
      (t) =>
        `<div class="row"><span>Tax ${esc(t.treatmentType || t.mraTaxId || '')}</span><span>${esc(t.taxAmount)}</span></div>`
    )
    .join('');

  const pay = (d.payment?.components || [])
    .map(
      (c) =>
        `<div class="row"><span>${esc(c.mraPaymentMethodCode || 'PAY')}${c.isCreditComponent ? ' (CREDIT)' : ''}</span><span>${esc(c.amount)}</span></div>`
    )
    .join('');

  const qrBlock = qrPngDataUrl
    ? `<div class="qr"><img src="${qrPngDataUrl}" width="160" height="160" alt="${esc(d.QR?.altText || 'QR code for MRA receipt validation.')}" /></div>`
    : '';

  const validationUrl = d.mraValidation?.validationUrlClickable
    ? `<p class="url"><a href="${esc(d.mraValidation.validationUrl)}" rel="noopener noreferrer" target="_blank">${esc(d.mraValidation.validationUrl)}</a></p>
       <p class="hint">Trusted host indication: MRA validation domain (allowlisted).</p>`
    : d.mraValidation?.validationUrl
      ? `<p class="url">${esc(d.mraValidation.validationUrl)}</p>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Fiscal receipt ${esc(d.fiscal?.fiscalNumber)}</title>
<style>
  @page { margin: 0; }
  body { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #000; background: #fff; margin: 0; }
  .ticket { width: ${paperWidthMm}mm; max-width: 100%; margin: 0 auto; padding: 4mm; }
  .banner { font-weight: 700; text-align: center; margin: 4px 0; border: 1px solid #000; padding: 4px; }
  .sandbox { background: #fff3cd; }
  .reprint { background: #eee; }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  td { vertical-align: top; padding: 2px 0; }
  .num { text-align: right; white-space: nowrap; }
  .qr { text-align: center; margin: 8px 0; }
  .qr img { image-rendering: pixelated; }
  .url { word-break: break-all; font-size: 10px; }
  .section { margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
  @media print { body { background: #fff; } .no-print { display: none !important; } }
</style>
</head>
<body>
<main class="ticket" aria-label="MRA fiscal receipt">
  ${sandbox}
  ${reprint}
  <h1>${esc(d.seller?.legalName || 'Seller')}</h1>
  <p>TIN: ${esc(d.seller?.tin)}</p>
  <p>${esc(d.seller?.address)}</p>
  <div class="section">
    <div class="row"><span>Fiscal No.</span><span>${esc(d.fiscal?.fiscalNumber)}</span></div>
    <div class="row"><span>MRA Txn</span><span>${esc(d.fiscal?.mraTransactionId)}</span></div>
    <div class="row"><span>Local Doc</span><span>${esc(d.transaction?.localDocumentNumber)}</span></div>
    <div class="row"><span>Txn Date</span><span>${esc(d.fiscal?.transactionDateTime)}</span></div>
    <div class="row"><span>Terminal</span><span>${esc(d.terminal?.mraTerminalId)}</span></div>
    <p><strong>${esc(d.mraValidation?.acceptedWording || 'Accepted by MRA')}</strong></p>
  </div>
  <div class="section">
    <table>
      <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
  </div>
  <div class="section">
    ${tax}
    <div class="row"><span>Tax total</span><span>${esc(money(d.totals?.taxTotal, d.currency?.code))}</span></div>
    <div class="row"><span>Levy total</span><span>${esc(money(d.totals?.levyTotal, d.currency?.code))}</span></div>
    <div class="row"><strong>Gross</strong><strong>${esc(money(d.totals?.grossTotal, d.currency?.code))}</strong></div>
  </div>
  <div class="section">
    <p>Payment: ${esc(d.payment?.classification)}</p>
    ${pay}
    ${d.payment?.amountTendered != null ? `<div class="row"><span>Tendered</span><span>${esc(d.payment.amountTendered)}</span></div>` : ''}
    ${d.payment?.changeGiven != null ? `<div class="row"><span>Change</span><span>${esc(d.payment.changeGiven)}</span></div>` : ''}
  </div>
  <div class="section">
    <p>${esc(d.mraValidation?.wording)}</p>
    ${qrBlock}
    ${validationUrl}
  </div>
  <div class="section">
    ${(d.footer?.required || []).map((t) => `<p>${esc(t)}</p>`).join('')}
    <p>Template ${esc(d.footer?.templateVersion)}</p>
  </div>
</main>
</body>
</html>`;

  return {
    html,
    mimeType: 'text/html; charset=utf-8',
    rendererVersion: paperWidthMm === 80 ? THERMAL_RENDERER_VERSION : HTML_RENDERER_VERSION,
    receiptType:
      paperWidthMm === 80 ? RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM : RECEIPT_TYPE.POS_BROWSER_PRINT,
    checksum: crypto.createHash('sha256').update(html, 'utf8').digest('hex'),
  };
}

/**
 * Accessible HTML view (same data, slightly richer structure).
 */
export function renderFiscalHtmlView({ receiptData, qrPngDataUrl = null } = {}) {
  const base = renderPos80Html({ receiptData, qrPngDataUrl, paperWidthMm: 80 });
  return {
    ...base,
    rendererVersion: HTML_RENDERER_VERSION,
    receiptType: RECEIPT_TYPE.SALES_INVOICE_FISCAL_HTML,
  };
}

/**
 * A4 fiscal PDF from immutable receipt data. Network-free jsPDF rendering.
 */
export function renderSalesInvoiceA4Pdf({ receiptData, qrPngBuffer = null } = {}) {
  const d = receiptData;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  // Sanitize metadata — no credentials / paths
  if (doc.setProperties) {
    doc.setProperties({
      title: `Fiscal Receipt ${d.fiscal?.fiscalNumber || ''}`.trim(),
      subject: 'MRA EIS fiscal document',
      author: 'InsightBooks',
      keywords: 'fiscal,mra,eis',
      creator: 'InsightBooks Phase 14',
    });
  }

  let y = 14;
  if (d.sandbox) {
    doc.setFontSize(12);
    doc.text(d.footer?.sandboxBanner || 'SANDBOX / TEST', 14, y);
    y += 8;
  }
  doc.setFontSize(16);
  doc.text(String(d.seller?.legalName || 'Seller'), 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`TIN: ${d.seller?.tin || ''}`, 14, y);
  y += 5;
  doc.text(`Fiscal No: ${d.fiscal?.fiscalNumber || ''}`, 14, y);
  y += 5;
  doc.text(`MRA Transaction ID: ${d.fiscal?.mraTransactionId || ''}`, 14, y);
  y += 5;
  doc.text(`Classification: ${d.receiptClassification || ''}`, 14, y);
  y += 5;
  doc.text(`${d.mraValidation?.acceptedWording || 'Accepted by MRA'}`, 14, y);
  y += 5;
  if (d.originalOrReprint === 'REPRINT') {
    doc.text(String(d.footer?.originalOrReprintWording || 'REPRINT'), 14, y);
    y += 5;
  }
  if (d.buyer && !d.buyer.anonymous) {
    doc.text(`Buyer: ${d.buyer.legalName || ''} TIN: ${d.buyer.tin || ''}`, 14, y);
    y += 6;
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Qty', 'Unit', 'Tax', 'Total']],
    body: (d.lines || []).map((l) => [
      String(l.lineNumber),
      String(l.description || ''),
      String(l.quantity ?? ''),
      String(l.unitPrice ?? ''),
      String(l.taxAmount ?? ''),
      String(l.lineTotal ?? ''),
    ]),
    styles: { fontSize: 8, textColor: [0, 0, 0] },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    margin: { left: 14, right: 14 },
    didDrawPage(data) {
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${page}`, 196, 287, { align: 'right' });
      void data;
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 8;
  doc.text(`Gross total: ${d.currency?.code || 'MWK'} ${d.totals?.grossTotal || ''}`, 14, y);
  y += 5;
  doc.text(`Payment: ${d.payment?.classification || ''}`, 14, y);
  y += 8;
  doc.text(String(d.mraValidation?.wording || ''), 14, y, { maxWidth: 120 });

  if (qrPngBuffer) {
    const dataUrl = `data:image/png;base64,${qrPngBuffer.toString('base64')}`;
    doc.addImage(dataUrl, 'PNG', 150, Math.max(y - 10, 40), 40, 40);
  }

  y = Math.max(y + 20, 200);
  for (const line of d.footer?.required || []) {
    doc.text(String(line), 14, y, { maxWidth: 180 });
    y += 5;
  }

  const buffer = Buffer.from(doc.output('arraybuffer'));
  return {
    buffer,
    mimeType: 'application/pdf',
    rendererVersion: PDF_RENDERER_VERSION,
    receiptType: RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4,
    pageCount: doc.getNumberOfPages(),
    checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

export function evaluatePos58Support() {
  return {
    supported: false,
    reason: 'MANDATORY_QR_AND_FIELDS_CANNOT_FIT_58MM_COMPLIANTLY',
    alternatives: [RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM, RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4],
  };
}

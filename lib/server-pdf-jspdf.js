// lib/server-pdf-jspdf.js
// Server-side PDF generation using jsPDF (no Puppeteer/Chromium required).
// Provides Buffer-returning functions for invoices, quotations, sale receipts, and payment receipts.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyForExport, formatAmountForExport, formatDate } from './invoiceCalculations';
import { shouldDisplayDocumentTax, documentHasLineTax } from './documentTaxDisplay';
import { parseTemplateContent } from './documentTemplates/parseTemplateContent';
import {
  drawDocumentPdfHeader,
  drawBillToAndDetails,
  pdfTableHeadStyles,
  pdfTableBodyStyles,
} from './documentTemplates/drawPdfHeader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return { r: 0, g: 117, b: 190 };
  }
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 117, b: 190 };
}

function toBuffer(doc) {
  return Buffer.from(doc.output('arraybuffer'));
}

function fmtCurrency(amount, code = 'MWK') {
  return formatCurrencyForExport(amount, code);
}

function fmtAmount(amount) {
  return formatAmountForExport(amount);
}

function fmtDateShort(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return formatDate(date);
  }
}

function fmtDateTime(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(date);
  }
}

function fmtTime(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return '';
  }
}

function getPaymentMethodLabel(paymentOrMethod) {
  if (paymentOrMethod?.paymentMethodName) return paymentOrMethod.paymentMethodName;
  const method = paymentOrMethod?.paymentMethod || paymentOrMethod;
  if (!method) return 'N/A';
  if (typeof method !== 'string') return 'N/A';
  switch (method.toLowerCase()) {
    case 'cash': return 'Cash';
    case 'bank_transfer': return 'Bank Transfer';
    case 'mobile_money': return 'Mobile Money';
    case 'check': return 'Check';
    case 'credit_card': return 'Credit Card';
    default: return method.length > 20 ? 'Unknown method' : method;
  }
}

function drawColoredRect(doc, x, y, w, h, rgb) {
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(x, y, w, h, 'F');
}

function drawDivider(doc, x, y, width) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, y, x + width, y);
}

function ensurePageSpace(doc, y, needed, margin) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

// Wraps text and returns the new y position
function drawWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  lines.forEach((line) => {
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
}

function computeInvoicePaymentsForPdf(invoice) {
  const eligible = (invoice.payments || []).filter(
    (p) => p && !p.isReversal && (p.status == null || String(p.status) === 'Completed'),
  );
  if (invoice.paymentInfo && typeof invoice.paymentInfo.totalPaid === 'number') {
    return { eligiblePayments: eligible, paymentInfo: invoice.paymentInfo };
  }
  const totalPaid = eligible.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const invTotal = parseFloat(invoice.total) || 0;
  const outstandingAmount = Math.max(0, invTotal - totalPaid);
  const isFullyPaid = totalPaid >= invTotal - 0.005;
  const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
  return {
    eligiblePayments: eligible,
    paymentInfo: {
      totalPaid,
      outstandingAmount,
      isFullyPaid,
      isPartiallyPaid,
      paymentCount: eligible.length,
    },
  };
}

function invoiceLineAmountForPdf(item) {
  const stored = parseFloat(item.amount);
  if (Number.isFinite(stored)) return stored;
  const qty = parseFloat(item.quantity) || 0;
  const rate = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discountAmount) || 0;
  const net = qty * rate - disc;
  const tr = parseFloat(item.taxRate) || 0;
  return net * (1 + tr / 100);
}

// ---------------------------------------------------------------------------
// 1. INVOICE PDF
// ---------------------------------------------------------------------------

export function generateInvoicePdfBuffer(invoice, template, branding) {
  const appearance = parseTemplateContent(template?.content);
  const layoutId = appearance.layoutId || 'classic';
  const logoPosition = appearance.logoPosition || 'left';
  const showFooter = appearance.showFooter !== false;
  const primaryColor = appearance.primaryColor || branding?.primaryColor || '#0075be';
  const rgb = hexToRgb(primaryColor);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');
  doc.setProperties({
    title: `Invoice ${invoice.invoiceNumber}`,
    subject: `Invoice for ${invoice.client?.name || 'Client'}`,
    creator: 'InsightBooks',
  });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = layoutId === 'compact' ? 10 : 12;
  const cw = pw - m * 2;
  let y = m;
  const x = m;

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const { eligiblePayments, paymentInfo } = computeInvoicePaymentsForPdf(invoice);
  const showDiscountCol = items.some((it) => (parseFloat(it.discountAmount) || 0) > 0);
  const showTaxCol = documentHasLineTax(items);
  const showDocumentTax = shouldDisplayDocumentTax({
    taxAmount: invoice.taxAmount,
    taxLines: items.flatMap((item) => item.itemTaxes || []),
  });
  const invTitle = (invoice.title && String(invoice.title).trim()) ? String(invoice.title).trim() : 'Invoice';
  const sellerTpin = (branding?.tpin && String(branding.tpin).trim()) || '';

  y = drawDocumentPdfHeader(doc, {
    layoutId,
    logoPosition,
    rgb,
    branding,
    docLabel: 'INVOICE',
    docNumber: invoice.invoiceNumber,
    status: invoice.status,
    sellerTpin,
    x,
    y,
    cw,
    pw,
    m,
  });

  y = drawBillToAndDetails(doc, {
    x,
    y,
    cw,
    client: invoice.client,
    title: invTitle,
    orderNumber: invoice.orderNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    dueLabel: 'Due',
    status: invoice.status,
    layoutId,
    rgb,
  });

  // ---- Line items (compact rows ≈10+ per page; repeat header on continuation pages) ----
  const tableHead = [
    [
      '#',
      'Description',
      'Qty',
      'Rate',
      ...(showDiscountCol ? ['Disc.'] : []),
      ...(showTaxCol ? ['Tax'] : []),
      'Amount',
    ],
  ];

  const tableBody = items.map((item, idx) => {
    const row = [
      String(idx + 1),
      item.description || '',
      String(item.quantity ?? 0),
      fmtAmount(item.unitPrice),
    ];
    if (showDiscountCol) {
      row.push((parseFloat(item.discountAmount) || 0) > 0 ? `−${fmtAmount(item.discountAmount)}` : '—');
    }
    if (showTaxCol) {
      row.push(`${item.taxRate || 0}%`);
    }
    row.push(fmtAmount(invoiceLineAmountForPdf(item)));
    return row;
  });

  const bodyStyles = pdfTableBodyStyles(layoutId);
  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: m, right: m, bottom: 36, top: m },
    showHead: 'everyPage',
    headStyles: pdfTableHeadStyles(layoutId, rgb),
    alternateRowStyles: { fillColor: layoutId === 'ledger' ? [250, 250, 249] : [248, 250, 252] },
    styles: bodyStyles,
    columnStyles: (() => {
      const styles = {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 22, halign: 'right' },
      };
      let col = 4;
      if (showDiscountCol) {
        styles[col] = { cellWidth: 18, halign: 'right' };
        col += 1;
      }
      if (showTaxCol) {
        styles[col] = { cellWidth: 14, halign: 'center' };
        col += 1;
      }
      styles[col] = { cellWidth: 26, halign: 'right' };
      return styles;
    })(),
  });

  y = doc.lastAutoTable.finalY + 10;

  // ---- Summary: payment history + financials ----
  y = ensurePageSpace(doc, y, 72, m);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', x, y);
  y += 5;

  if (eligiblePayments.length > 0) {
    const payHead = [['Date', 'Method', 'Reference', 'Amount']];
    const payBody = eligiblePayments.map((p) => [
      fmtDateShort(p.paymentDate),
      getPaymentMethodLabel(p),
      (p.reference && String(p.reference).trim()) ? String(p.reference).trim() : '—',
      fmtCurrency(parseFloat(p.amount) || 0),
    ]);
    autoTable(doc, {
      startY: y,
      head: payHead,
      body: payBody,
      margin: { left: m, right: m },
      tableWidth: cw,
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 32 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 34, halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  const tw = 78;
  const tx = pw - m - tw;
  y = ensurePageSpace(doc, y, 52, m);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(tx - 2, y - 3, tw + 4, 48, 1.5, 1.5, 'S');
  doc.setFillColor(248, 250, 252);
  doc.rect(tx - 2, y - 3, tw + 4, 10, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Amounts', tx + 4, y + 4);

  let ay = y + 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const discGlobal = parseFloat(invoice.discount) || 0;
  const discLines = parseFloat(invoice.totalDiscountAmount) || 0;
  if (discLines > 0) {
    doc.text('Line discounts', tx + 4, ay);
    doc.setTextColor(220, 38, 38);
    doc.text(`−${fmtCurrency(discLines)}`, tx + tw - 4, ay, { align: 'right' });
    doc.setTextColor(71, 85, 105);
    ay += 5;
  }
  if (discGlobal > 0) {
    doc.text('Discount', tx + 4, ay);
    doc.setTextColor(220, 38, 38);
    doc.text(`−${fmtCurrency(discGlobal)}`, tx + tw - 4, ay, { align: 'right' });
    doc.setTextColor(71, 85, 105);
    ay += 5;
  }
  doc.text('Subtotal', tx + 4, ay);
  doc.text(fmtCurrency(invoice.subtotal), tx + tw - 4, ay, { align: 'right' });
  ay += 5;
  if (showDocumentTax) {
    doc.text('Tax', tx + 4, ay);
    doc.text(fmtCurrency(invoice.taxAmount), tx + tw - 4, ay, { align: 'right' });
    ay += 5;
  }
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(0.4);
  doc.line(tx + 4, ay, tx + tw - 4, ay);
  ay += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(11);
  doc.text('Total', tx + 4, ay);
  doc.text(fmtCurrency(invoice.total), tx + tw - 4, ay, { align: 'right' });
  ay += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 163, 74);
  doc.text('Paid', tx + 4, ay);
  doc.text(fmtCurrency(paymentInfo.totalPaid), tx + tw - 4, ay, { align: 'right' });
  ay += 5;
  doc.setTextColor(220, 38, 38);
  doc.text('Outstanding', tx + 4, ay);
  doc.text(fmtCurrency(paymentInfo.outstandingAmount), tx + tw - 4, ay, { align: 'right' });
  ay += 5;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  const payStatus = paymentInfo.isFullyPaid
    ? 'Fully paid'
    : paymentInfo.isPartiallyPaid
      ? 'Partially paid'
      : 'Unpaid';
  doc.text(`Payment status: ${payStatus}`, tx + 4, ay);

  y = ay + 10;

  if (invoice.notes) {
    y = ensurePageSpace(doc, y, 24, m);
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    y = drawWrappedText(doc, invoice.notes, x, y + 4, cw, 4.2);
    y += 4;
  }

  // ---- Footers on every page (contact / banks on last page only) ----
  const footerPhone = (invoice?.footerPhoneOverride != null && invoice?.footerPhoneOverride !== '')
    ? invoice.footerPhoneOverride
    : (branding?.businessPhone || '');
  const footerBankDetails = (invoice?.footerBankDetailsOverride != null && invoice?.footerBankDetailsOverride !== '')
    ? invoice.footerBankDetailsOverride
    : (branding?.defaultBankDetails || '');
  const thankYouText = branding?.emailFooter || 'Thank you for your business!';
  const totalPages = doc.internal.getNumberOfPages();

  for (let pi = 1; pi <= totalPages; pi++) {
    doc.setPage(pi);
    doc.setFont('helvetica', 'normal');
    if (showFooter && pi === totalPages) {
      let fy = ph - 14;
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(thankYouText, pw / 2, fy, { align: 'center' });
      fy -= 5;
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      if (footerPhone.trim()) {
        doc.text(`Tel: ${footerPhone.trim()}`, pw / 2, fy, { align: 'center' });
        fy -= 3.5;
      }
      if (branding?.email) {
        doc.text(`Email: ${branding.email}`, pw / 2, fy, { align: 'center' });
        fy -= 3.5;
      }
      const addrLine = [branding?.address, branding?.city].filter(Boolean).join(', ');
      if (addrLine) {
        doc.text(addrLine, pw / 2, fy, { align: 'center' });
        fy -= 3.5;
      }
      if (footerBankDetails.trim()) {
        fy -= 2;
        const bankLines = doc.splitTextToSize(footerBankDetails.trim(), cw - 16);
        bankLines.forEach((line) => {
          doc.text(line, pw / 2, fy, { align: 'center' });
          fy -= 3.3;
        });
      }
    }
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${pi} of ${totalPages}`, pw / 2, ph - 5, { align: 'center' });
  }

  return toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 2. QUOTATION PDF
// ---------------------------------------------------------------------------

export function generateQuotationPdfBuffer(quotation, template, branding) {
  const appearance = parseTemplateContent(template?.content);
  const layoutId = appearance.layoutId || 'classic';
  const logoPosition = appearance.logoPosition || 'left';
  const primaryColor = appearance.primaryColor || branding?.primaryColor || '#0075be';
  const showFooter = appearance.showFooter !== false;
  const rgb = hexToRgb(primaryColor);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');
  const qNum = quotation.quotationNumber || quotation.id || '';
  doc.setProperties({ title: `Quotation ${qNum}`, creator: 'InsightBooks' });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = layoutId === 'compact' ? 10 : 15;
  const cw = pw - m * 2;
  let y = m;
  const x = m;

  y = drawDocumentPdfHeader(doc, {
    layoutId,
    logoPosition,
    rgb,
    branding,
    docLabel: 'QUOTATION',
    docNumber: qNum,
    status: quotation.status,
    sellerTpin: branding?.tpin || '',
    x,
    y,
    cw,
    pw,
    m,
  });

  y = drawBillToAndDetails(doc, {
    x,
    y,
    cw,
    client: quotation.client || {},
    title: (quotation.title && String(quotation.title).trim()) || 'Quotation',
    orderNumber: quotation.orderNumber,
    issueDate: quotation.issueDate,
    dueDate: quotation.validUntil,
    dueLabel: 'Valid until',
    status: quotation.status,
    layoutId,
    rgb,
  });

  // Date row already covered in details; continue to line items
  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const showDiscountCol = items.some((it) => (parseFloat(it.discountAmount) || 0) > 0);
  const showTaxCol = documentHasLineTax(items);
  const showDocumentTax = shouldDisplayDocumentTax({
    taxAmount: quotation.taxAmount,
    taxLines: items.flatMap((item) => item.itemTaxes || []),
  });

  const tableHead = [
    [
      '#',
      'Description',
      'Qty',
      'Rate',
      ...(showDiscountCol ? ['Disc.'] : []),
      ...(showTaxCol ? ['Tax'] : []),
      'Amount',
    ],
  ];
  const tableBody = items.map((item, idx) => {
    const row = [
      String(idx + 1),
      item.description || '',
      String(item.quantity ?? 0),
      fmtAmount(item.unitPrice),
    ];
    if (showDiscountCol) {
      row.push((parseFloat(item.discountAmount) || 0) > 0 ? `−${fmtAmount(item.discountAmount)}` : '—');
    }
    if (showTaxCol) {
      row.push(`${item.taxRate || 0}%`);
    }
    row.push(fmtAmount(invoiceLineAmountForPdf(item)));
    return row;
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: m, right: m, bottom: 28, top: m },
    showHead: 'everyPage',
    headStyles: pdfTableHeadStyles(layoutId, rgb),
    alternateRowStyles: { fillColor: layoutId === 'ledger' ? [250, 250, 249] : [248, 250, 252] },
    styles: pdfTableBodyStyles(layoutId),
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ---- Totals ----
  const tw = 70;
  const tx = pw - m - tw;
  y = ensurePageSpace(doc, y, 30, m);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', tx + 4, y + 5);
  doc.text(fmtCurrency(quotation.subtotal ?? 0), tx + tw - 4, y + 5, { align: 'right' });
  let quoteTotalY = y + 11;
  if (showDocumentTax) {
    doc.text('Tax:', tx + 4, quoteTotalY);
    doc.text(fmtCurrency(quotation.taxAmount ?? 0), tx + tw - 4, quoteTotalY, { align: 'right' });
    quoteTotalY += 6;
  } else {
    quoteTotalY = y + 10;
  }

  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(0.5);
  doc.line(tx + 4, quoteTotalY + 3, tx + tw - 4, quoteTotalY + 3);

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', tx + 4, quoteTotalY + 11);
  doc.text(fmtCurrency(quotation.total ?? 0), tx + tw - 4, quoteTotalY + 11, { align: 'right' });
  y += 30;

  // ---- Notes ----
  if (quotation.notes) {
    y = ensurePageSpace(doc, y, 20, m);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y = drawWrappedText(doc, quotation.notes, x, y + 5, cw, 4.5);
  }

  // ---- Footer ----
  if (showFooter) {
    let fy = ph - 12;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    const thankYou = branding?.emailFooter || 'Thank you for your business!';
    doc.text(thankYou, pw / 2, fy, { align: 'center' });
    fy -= 5;
    doc.setFontSize(7);
    if (branding?.defaultBankDetails) {
      const bankLines = doc.splitTextToSize(branding.defaultBankDetails.trim(), cw);
      for (let i = bankLines.length - 1; i >= 0; i--) {
        doc.text(bankLines[i], x, fy);
        fy -= 3.5;
      }
    }
    if (branding?.businessPhone) {
      doc.text(`Tel: ${branding.businessPhone}`, x, fy);
    }
  }

  return toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 3. SALE RECEIPT PDF (thermal-style but on A4 for readability in apps)
// ---------------------------------------------------------------------------

/**
 * Draw one sale receipt onto an existing jsPDF document.
 * Used by single-receipt PDF and bulk receipts export (one receipt per page start).
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {object} sale
 * @param {object|null} tenantSettings
 * @param {object|null} taxData
 * @param {{ startOnNewPage?: boolean }} [opts]
 */
export function drawSaleReceiptOnDoc(doc, sale, tenantSettings, taxData, opts = {}) {
  const { startOnNewPage = false } = opts;
  if (startOnNewPage) {
    doc.addPage();
  }

  doc.setFont('helvetica');

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;
  const cw = pw - m * 2;
  let y = m;
  const x = m;
  const cx = pw / 2; // center x
  const currencyCode = tenantSettings?.currencyCode || 'MWK';

  const ensureSpace = (needed = 12) => {
    if (y + needed > ph - m) {
      doc.addPage();
      y = m;
    }
  };

  const fmtC = (amt) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(amt);
    } catch {
      return `${currencyCode} ${Number(amt).toFixed(2)}`;
    }
  };

  // ---- Company Header ----
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.tenant?.name || 'Company', cx, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (tenantSettings?.buildingName) { doc.text(tenantSettings.buildingName, cx, y, { align: 'center' }); y += 3.5; }
  if (tenantSettings?.businessAddress) { doc.text(tenantSettings.businessAddress, cx, y, { align: 'center' }); y += 3.5; }
  if (tenantSettings?.businessCity) { doc.text(tenantSettings.businessCity, cx, y, { align: 'center' }); y += 3.5; }
  if (tenantSettings?.businessPhone) { doc.text(`Tel: ${tenantSettings.businessPhone}`, cx, y, { align: 'center' }); y += 3.5; }
  if (tenantSettings?.businessEmail) { doc.text(`Email: ${tenantSettings.businessEmail}`, cx, y, { align: 'center' }); y += 3.5; }

  y += 2;
  drawDivider(doc, x, y, cw);
  y += 5;

  // ---- Receipt Title ----
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`RECEIPT #${sale.saleNumber}`, cx, y, { align: 'center' });
  y += 6;
  drawDivider(doc, x, y, cw);
  y += 5;

  // ---- Info Section ----
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const infoRows = [];

  if (sale.isHistorical && sale.historicalDate) {
    infoRows.push(['Sale Date:', `${fmtDateShort(sale.historicalDate)} ${fmtTime(sale.historicalDate)}`]);
    infoRows.push(['Receipt Generated:', `${fmtDateShort(sale.saleDate)} ${fmtTime(sale.saleDate)}`]);
  } else {
    infoRows.push(['Date:', fmtDateShort(sale.saleDate)]);
    infoRows.push(['Time:', fmtTime(sale.saleDate)]);
  }
  infoRows.push(['Customer:', sale.client ? sale.client.name : 'Walk-in Customer']);
  infoRows.push(['Cashier:', sale.createdBy?.name || '']);

  infoRows.forEach(([label, value]) => {
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), pw - m, y, { align: 'right' });
    y += 5;
  });

  y += 3;
  drawDivider(doc, x, y, cw);
  y += 5;

  // ---- Items ----
  ensureSpace(16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMS PURCHASED', x, y);
  y += 5;

  const itemsArray = Array.isArray(sale.items) ? sale.items : [];
  const tableHead = [['Item', 'Qty', 'Price', 'Amount']];
  const tableBody = itemsArray.map((item) => {
    const qty = parseFloat(item.quantity || 1);
    const price = parseFloat(item.unitPrice || 0);
    const discount = parseFloat(item.discountAmount || 0);
    const lineAmount =
      item.amount != null && item.amount !== ''
        ? parseFloat(item.amount)
        : qty * price - qty * discount;
    const label =
      (item.description && String(item.description).trim()) ||
      item.product?.name ||
      'Item';
    return [
      label,
      String(qty),
      fmtC(price),
      fmtC(Number.isFinite(lineAmount) ? lineAmount : 0),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody.length
      ? tableBody
      : [
          [
            'Sale',
            '1',
            fmtC(parseFloat(sale.subtotal || sale.total || 0)),
            fmtC(parseFloat(sale.subtotal || sale.total || 0)),
          ],
        ],
    margin: { left: m, right: m },
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, lineWidth: 0.1, lineColor: [200, 200, 200] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
  });

  y = doc.lastAutoTable.finalY + 5;
  drawDivider(doc, x, y, cw);
  y += 5;

  // ---- Totals ----
  ensureSpace(40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const subtotal = parseFloat(sale.subtotal || 0);
  const totalDiscountAmount = parseFloat(sale.totalDiscountAmount || 0);

  doc.text('Subtotal (Before Tax):', x, y);
  doc.text(fmtC(subtotal), pw - m, y, { align: 'right' });
  y += 5;

  if (totalDiscountAmount > 0) {
    ensureSpace(8);
    doc.text('Total Discount:', x, y);
    doc.text(`-${fmtC(totalDiscountAmount)}`, pw - m, y, { align: 'right' });
    y += 5;
  }

  // Tax breakdown
  if (taxData) {
    const { taxGroups, hasAnyTaxes, totalTaxAmount } = taxData;
    const positiveTaxGroups = (taxGroups || []).filter(
      (tax) => parseFloat(tax.totalAmount || 0) > 0.000001,
    );
    if (hasAnyTaxes && positiveTaxGroups.length > 0) {
      positiveTaxGroups.forEach((tax) => {
        ensureSpace(8);
        const amt = parseFloat(tax.totalAmount || 0);
        const label = tax.taxName + (tax.taxCode ? ` (${tax.taxCode})` : '');
        doc.text(`${label}:`, x, y);
        doc.text(fmtC(amt), pw - m, y, { align: 'right' });
        y += 5;
      });
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Tax:', x, y);
      doc.text(fmtC(totalTaxAmount), pw - m, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'normal');
    } else if (parseFloat(totalTaxAmount || 0) > 0.000001) {
      ensureSpace(8);
      doc.text('Total Tax:', x, y);
      doc.text(fmtC(totalTaxAmount), pw - m, y, { align: 'right' });
      y += 5;
    }
  }

  // Grand total
  ensureSpace(20);
  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(x, y, pw - m, y);
  y += 5;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL:', x, y);
  doc.text(fmtC(parseFloat(sale.total || 0)), pw - m, y, { align: 'right' });
  y += 2;
  doc.line(x, y, pw - m, y);
  y += 8;

  // ---- Payment Info ----
  ensureSpace(24);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);

  if (sale.payments && sale.payments.length > 0 && sale.payments[0].allocations && sale.payments[0].allocations.length > 0) {
    doc.text('Payment Breakdown:', cx, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    sale.payments[0].allocations.forEach((alloc) => {
      ensureSpace(6);
      doc.text(`${alloc.paymentAccount?.name || 'Account'}: ${fmtC(alloc.amount)}`, cx, y, { align: 'center' });
      y += 4;
    });
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Paid: ${fmtC(sale.payments[0].amount)}`, cx, y, { align: 'center' });
    y += 5;
  } else {
    const method = sale.paymentMethod || sale.payments?.[0]?.allocations?.[0]?.paymentAccount?.name || 'N/A';
    doc.text(`Payment Method: ${method}`, cx, y, { align: 'center' });
    y += 5;
  }

  if (sale.posAmountTendered != null) {
    ensureSpace(14);
    y += 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Amount tendered:', x, y);
    doc.text(fmtC(sale.posAmountTendered), pw - m, y, { align: 'right' });
    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.text('Change:', x, y);
    doc.text(fmtC(sale.posChangeGiven != null ? sale.posChangeGiven : 0), pw - m, y, { align: 'right' });
    y += 5;
  }

  if (sale.notes) {
    ensureSpace(10);
    y += 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(`Notes: ${sale.notes}`, cw);
    noteLines.forEach((line) => {
      ensureSpace(5);
      doc.text(line, x, y);
      y += 4;
    });
    y += 1;
  }

  // ---- Footer ----
  ensureSpace(28);
  y += 3;
  drawDivider(doc, x, y, cw);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  const footerMsg = tenantSettings?.receiptFooter || 'Thank you for your business!';
  doc.text(footerMsg, cx, y, { align: 'center' });
  y += 5;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const phoneOverride = sale.footerPhoneOverride != null && sale.footerPhoneOverride !== ''
    ? sale.footerPhoneOverride : (tenantSettings?.businessPhone || '');
  if (phoneOverride) {
    doc.text(`Tel: ${phoneOverride}`, cx, y, { align: 'center' });
    y += 3.5;
  }
  const bankOverride = sale.footerBankDetailsOverride != null && sale.footerBankDetailsOverride !== ''
    ? sale.footerBankDetailsOverride : (tenantSettings?.defaultBankDetails || '');
  if (bankOverride) {
    const bankLines = doc.splitTextToSize(bankOverride.trim(), cw - 20);
    bankLines.forEach((line) => {
      ensureSpace(5);
      doc.text(line, cx, y, { align: 'center' });
      y += 3.5;
    });
  }

  y += 2;
  ensureSpace(6);
  doc.setFontSize(7);
  doc.text(`${new Date().getFullYear()} \u00A9 ${sale.tenant?.name || ''} | insightbooksafrica.com`, cx, y, { align: 'center' });
}

export function generateSaleReceiptPdfBuffer(sale, tenantSettings, taxData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');
  doc.setProperties({
    title: `Receipt ${sale.saleNumber}`,
    creator: 'InsightBooks',
  });
  drawSaleReceiptOnDoc(doc, sale, tenantSettings, taxData, { startOnNewPage: false });
  return toBuffer(doc);
}

/**
 * Build a multi-receipt archive PDF (cover page + one receipt starting per page).
 * @param {Array<{ sale: object, taxData: object|null }>} receipts
 * @param {object|null} tenantSettings
 * @param {{ tenantName?: string, dateFrom?: Date|string|null, dateTo?: Date|string|null, count?: number }} meta
 */
export function generateBulkSaleReceiptsPdfBuffer(receipts, tenantSettings, meta = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');
  doc.setProperties({
    title: 'POS Receipts Export',
    creator: 'InsightBooks',
  });

  const pw = doc.internal.pageSize.getWidth();
  const m = 20;
  const cx = pw / 2;
  let y = 40;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(meta.tenantName || 'POS Receipts', cx, y, { align: 'center' });
  y += 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Receipt archive export', cx, y, { align: 'center' });
  y += 10;
  doc.setFontSize(10);
  const fromLabel = meta.dateFrom ? fmtDateShort(meta.dateFrom) : '—';
  const toLabel = meta.dateTo ? fmtDateShort(meta.dateTo) : '—';
  doc.text(`Date range: ${fromLabel} – ${toLabel}`, cx, y, { align: 'center' });
  y += 6;
  doc.text(`Receipts: ${meta.count != null ? meta.count : (receipts?.length || 0)}`, cx, y, { align: 'center' });
  y += 6;
  doc.text(`Generated: ${fmtDateTime(new Date())}`, cx, y, { align: 'center' });
  y += 14;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Each receipt starts on a new page. Long receipts may continue onto following pages.', cx, y, {
    align: 'center',
  });

  for (let i = 0; i < (receipts || []).length; i++) {
    const { sale, taxData } = receipts[i];
    drawSaleReceiptOnDoc(doc, sale, tenantSettings, taxData, { startOnNewPage: true });
  }

  return toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 4. PAYMENT RECEIPT PDF
// ---------------------------------------------------------------------------

export function generatePaymentReceiptPdfBuffer(receiptData) {
  const { type, payment, invoice, expense, client, payments, totalPaid, isFullyPaid } = receiptData;

  const isExpenseReceipt = !!expense;
  const documentNumber = isExpenseReceipt
    ? expense?.reference ||
      expense?.originalReference ||
      (expense?.description ? String(expense.description).slice(0, 48) : 'Expense')
    : invoice?.invoiceNumber || '';
  const documentTotal = isExpenseReceipt ? expense.amount : (invoice?.total || 0);
  const documentType = isExpenseReceipt ? 'Expense' : 'Invoice';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');
  doc.setProperties({ title: `Payment Receipt - ${documentNumber}`, creator: 'InsightBooks' });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;
  const cw = pw - m * 2;
  let y = m;
  const x = m;
  const cx = pw / 2;
  const accentRGB = { r: 0, g: 117, b: 190 }; // #0075be

  // ---- Header ----
  doc.setDrawColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.setLineWidth(1);
  doc.line(x, y + 12, pw - m, y + 12);

  doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Payment Receipt', cx, y + 8, { align: 'center' });
  y += 17;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${documentType} #${documentNumber}`, cx, y, { align: 'center' });
  y += 10;

  // ---- Client Info + Receipt Details side by side ----
  const colW = cw / 2 - 5;

  // Left: Client Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.text('CLIENT INFORMATION', x, y);
  y += 5;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${client?.name || 'N/A'}`, x, y);
  doc.text(`Email: ${client?.email || 'N/A'}`, x, y + 4.5);
  doc.text(`Phone: ${client?.phone || 'N/A'}`, x, y + 9);

  // Right: Receipt Details
  const rx = pw / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.text('RECEIPT DETAILS', rx, y - 5);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (type === 'individual') {
    doc.text(`Receipt Date: ${payment?.paymentDate ? fmtDateShort(payment.paymentDate) : 'N/A'}`, rx, y);
    doc.text(`Payment reference: ${payment?.reference || 'N/A'}`, rx, y + 4.5);
    doc.text(`${documentType} Total: ${fmtCurrency(documentTotal)}`, rx, y + 9);
  } else {
    doc.text(`Total Payments: ${(payments || []).length}`, rx, y);
    doc.text(`${documentType} Total: ${fmtCurrency(documentTotal)}`, rx, y + 4.5);
    doc.text(`Total Paid: ${fmtCurrency(totalPaid || 0)}`, rx, y + 9);
  }

  y += 18;

  if (type === 'individual') {
    // ---- Payment Amount Banner ----
    drawColoredRect(doc, x, y, cw, 18, accentRGB);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Amount', x + 6, y + 6);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtCurrency(payment?.amount || 0), x + 6, y + 14);

    const isFullPayment = (payment?.amount || 0) >= documentTotal;
    const statusLabel = isFullPayment ? 'Full Payment' : 'Partial Payment';
    const statusColor = isFullPayment ? { r: 16, g: 185, b: 129 } : { r: 245, g: 158, b: 11 };
    const statusW = doc.getTextWidth(statusLabel) + 10;
    const statusX = pw - m - statusW - 5;
    drawColoredRect(doc, statusX, y + 5, statusW, 8, statusColor);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel, statusX + statusW / 2, y + 10.5, { align: 'center' });

    y += 24;

    // ---- Payment Method ----
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Payment Method: ${getPaymentMethodLabel(payment)}`, x, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Payment Date: ${payment?.paymentDate ? fmtDateTime(payment.paymentDate) : 'N/A'}`, x, y);
    y += 4.5;
    if (payment?.reference) { doc.text(`Reference: ${payment.reference}`, x, y); y += 4.5; }
    if (payment?.notes) { doc.text(`Notes: ${payment.notes}`, x, y); y += 4.5; }
    y += 5;

    // ---- Status Box ----
    const isPartial = (payment?.amount || 0) < documentTotal;
    if (isPartial) {
      doc.setFillColor(254, 243, 199);
      doc.rect(x, y, cw, 14, 'F');
      doc.setDrawColor(245, 158, 11);
      doc.rect(x, y, cw, 14, 'S');
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Note: ', x + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      const note = `This is a partial payment of ${fmtCurrency(payment?.amount || 0)} from ${documentType.toLowerCase()} total of ${fmtCurrency(documentTotal)}. Outstanding balance: ${fmtCurrency(documentTotal - (payment?.amount || 0))}`;
      const noteLines = doc.splitTextToSize(note, cw - 20);
      noteLines.forEach((line, i) => { doc.text(line, x + 18, y + 5 + i * 4); });
    } else {
      doc.setFillColor(209, 250, 229);
      doc.rect(x, y, cw, 12, 'F');
      doc.setDrawColor(16, 185, 129);
      doc.rect(x, y, cw, 12, 'S');
      doc.setTextColor(6, 95, 70);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Complete: ', x + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(`This payment fully settles ${documentType.toLowerCase()} #${documentNumber}.`, x + 38, y + 5);
    }
    y += 20;

  } else {
    // ---- Combined Receipt ----
    // Payment Amount Banner
    drawColoredRect(doc, x, y, cw, 18, accentRGB);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Amount Paid', x + 6, y + 6);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtCurrency(totalPaid || 0), x + 6, y + 14);

    const statusLabel = isFullyPaid ? 'Fully Paid' : 'Partially Paid';
    const statusColor = isFullyPaid ? { r: 16, g: 185, b: 129 } : { r: 245, g: 158, b: 11 };
    const statusW = doc.getTextWidth(statusLabel) + 10;
    const statusX = pw - m - statusW - 5;
    drawColoredRect(doc, statusX, y + 5, statusW, 8, statusColor);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel, statusX + statusW / 2, y + 10.5, { align: 'center' });

    y += 24;

    // Payment History Table
    doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment History', x, y);
    y += 4;

    const pHead = [['Date', 'Method', 'Amount', 'Reference']];
    const pBody = (payments || []).map((p) => [
      p.paymentDate ? fmtDateTime(p.paymentDate) : 'N/A',
      getPaymentMethodLabel(p),
      fmtCurrency(p.amount),
      p.reference || 'N/A',
    ]);

    autoTable(doc, {
      startY: y,
      head: pHead,
      body: pBody,
      margin: { left: m, right: m },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineWidth: 0.1, lineColor: [220, 220, 220] },
    });

    y = doc.lastAutoTable.finalY + 6;

    // Totals summary
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, y, cw, 30, 'FD');

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${documentType} Total:`, x + 6, y + 7);
    doc.text(fmtCurrency(documentTotal), pw - m - 6, y + 7, { align: 'right' });
    doc.text('Total Paid:', x + 6, y + 13);
    doc.text(fmtCurrency(totalPaid || 0), pw - m - 6, y + 13, { align: 'right' });
    doc.text('Outstanding Balance:', x + 6, y + 19);
    doc.text(fmtCurrency(documentTotal - (totalPaid || 0)), pw - m - 6, y + 19, { align: 'right' });

    doc.setDrawColor(accentRGB.r, accentRGB.g, accentRGB.b);
    doc.setLineWidth(0.5);
    doc.line(x + 6, y + 22, pw - m - 6, y + 22);

    doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', x + 6, y + 28);
    doc.text(isFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID', pw - m - 6, y + 28, { align: 'right' });
    y += 36;

    // Status Box
    if (!isFullyPaid) {
      doc.setFillColor(254, 243, 199);
      doc.rect(x, y, cw, 10, 'F');
      doc.setDrawColor(245, 158, 11);
      doc.rect(x, y, cw, 10, 'S');
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Outstanding Balance: ${fmtCurrency(documentTotal - (totalPaid || 0))} remaining.`, x + 4, y + 6);
    } else {
      doc.setFillColor(209, 250, 229);
      doc.rect(x, y, cw, 10, 'F');
      doc.setDrawColor(16, 185, 129);
      doc.rect(x, y, cw, 10, 'S');
      doc.setTextColor(6, 95, 70);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Payment Complete: All payments fully settle ${documentType.toLowerCase()} #${documentNumber}.`, x + 4, y + 6);
    }
    y += 16;
  }

  // ---- Footer ----
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your payment!', cx, ph - 18, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`Generated on ${new Date().toLocaleString()}`, cx, ph - 13, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Powered by InsightBooks  |  insightbooksafrica.com', cx, ph - 9, { align: 'center' });

  return toBuffer(doc);
}

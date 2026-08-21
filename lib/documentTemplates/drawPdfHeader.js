/**
 * Layout-aware PDF header drawing for invoices/quotations (jsPDF).
 * Returns the y position after the header block.
 */

import { formatDate } from '../invoiceCalculations.js';

function companyLabel(branding) {
  return branding?.companyName || branding?.name || 'Business';
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {object} opts
 * @returns {number} y
 */
export function drawDocumentPdfHeader(doc, opts) {
  const {
    layoutId = 'classic',
    logoPosition = 'left',
    rgb,
    branding,
    docLabel = 'INVOICE',
    docNumber = '',
    status = '',
    sellerTpin = '',
    x,
    y: startY,
    cw,
    pw,
    m,
  } = opts;

  let y = startY;
  const company = companyLabel(branding);
  const num = docNumber ? `#${docNumber}` : '';

  const placeBrand = (textY, optsAlign) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    if (logoPosition === 'center') {
      doc.text(company, pw / 2, textY, { align: 'center' });
    } else if (logoPosition === 'right') {
      doc.text(company, pw - m, textY, { align: 'right' });
    } else {
      doc.text(company, x, textY, optsAlign);
    }
  };

  switch (layoutId) {
    case 'modern': {
      drawColoredRect(doc, x, y, cw, 20, rgb);
      doc.setTextColor(255, 255, 255);
      if (logoPosition === 'right') {
        placeBrand(y + 8);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(docLabel, x + 4, y + 9);
        doc.setFontSize(9);
        doc.text(num, x + 4, y + 15);
      } else if (logoPosition === 'center') {
        placeBrand(y + 7);
        doc.setFontSize(11);
        doc.text(`${docLabel} ${num}`, pw / 2, y + 14, { align: 'center' });
      } else {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(docLabel, x + 4, y + 9);
        doc.setFontSize(9);
        doc.text(num, x + 4, y + 15);
        placeBrand(y + 10);
        // brand was left; overwrite with right for modern default look when left logo
        if (logoPosition === 'left') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(255, 255, 255);
          doc.text(company, pw - m - 4, y + 10, { align: 'right' });
        }
      }
      y += 26;
      break;
    }
    case 'bold-bar': {
      drawColoredRect(doc, x, y, cw, 4, rgb);
      y += 8;
      if (logoPosition !== 'right') placeBrandColored(doc, company, x, y, logoPosition, pw, m, rgb);
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      const titleX = logoPosition === 'center' ? pw / 2 : logoPosition === 'right' ? pw - m : x;
      const titleAlign = logoPosition === 'left' ? undefined : logoPosition === 'center' ? 'center' : 'right';
      doc.text(docLabel, titleX, y + (logoPosition === 'right' ? 0 : 8), titleAlign ? { align: titleAlign } : undefined);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(`${num}${status ? ` · ${status}` : ''}`, titleX, y + (logoPosition === 'right' ? 6 : 14), titleAlign ? { align: titleAlign } : undefined);
      if (logoPosition === 'right') placeBrandColored(doc, company, x, y, 'left', pw, m, rgb);
      y += 22;
      break;
    }
    case 'band-header': {
      const leftW = cw * 0.38;
      drawColoredRect(doc, x, y, leftW, 22, rgb);
      doc.setFillColor(30, 41, 59);
      doc.rect(x + leftW, y, cw - leftW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const brandX =
        logoPosition === 'center'
          ? x + leftW / 2
          : logoPosition === 'right'
            ? x + leftW - 3
            : x + 4;
      const brandAlign =
        logoPosition === 'center' ? 'center' : logoPosition === 'right' ? 'right' : undefined;
      doc.text(company, brandX, y + 12, brandAlign ? { align: brandAlign } : undefined);
      doc.setFontSize(16);
      doc.text(docLabel, x + leftW + 4, y + 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(num, x + leftW + 4, y + 16);
      y += 28;
      break;
    }
    case 'split-brand': {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(x + cw / 2, y, x + cw / 2, y + 22);
      placeBrandColored(doc, company, x, y + 8, logoPosition === 'center' ? 'left' : logoPosition, pw / 2 + m / 2, m, rgb);
      if (sellerTpin) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`TPIN: ${sellerTpin}`, x, y + 14);
      }
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(docLabel, x + cw / 2 + 4, y + 8);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(num, x + cw / 2 + 4, y + 14);
      y += 26;
      break;
    }
    case 'editorial': {
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(docLabel, logoPosition === 'center' ? pw / 2 : logoPosition === 'right' ? pw - m : x, y + 4, {
        align: logoPosition === 'left' ? undefined : logoPosition,
      });
      y += 8;
      placeBrandColored(doc, company, x, y + 4, logoPosition, pw, m, { r: 17, g: 24, b: 39 });
      y += 10;
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${docLabel} ${num}`, logoPosition === 'center' ? pw / 2 : x, y + 4, {
        align: logoPosition === 'center' ? 'center' : undefined,
      });
      y += 14;
      break;
    }
    case 'soft-card': {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, cw, 24, 3, 3, 'FD');
      placeBrandColored(doc, company, x + 4, y + 8, logoPosition, pw, m + 4, rgb);
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const softAlign = logoPosition === 'center' ? 'center' : logoPosition === 'right' ? 'right' : undefined;
      const softX = logoPosition === 'center' ? pw / 2 : logoPosition === 'right' ? pw - m - 4 : x + 4;
      doc.text(docLabel, softX, y + 16, softAlign ? { align: softAlign } : undefined);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(num, softX, y + 20, softAlign ? { align: softAlign } : undefined);
      y += 30;
      break;
    }
    case 'ledger': {
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.8);
      doc.line(x, y + 16, x + cw, y + 16);
      placeBrandColored(doc, company, x, y + 5, logoPosition, pw, m, { r: 30, g: 41, b: 59 });
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(docLabel, x, y + 13);
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      doc.text(num, pw - m, y + 13, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 22;
      break;
    }
    case 'minimal': {
      doc.setDrawColor(rgb.r, rgb.g, rgb.b);
      doc.setLineWidth(1);
      doc.line(x, y + 1, x + 24, y + 1);
      doc.setTextColor(55, 65, 81);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'normal');
      doc.text(`${titleCase(docLabel)} ${num}`, x, y + 9);
      placeBrandColored(doc, company, x, y + 9, logoPosition === 'left' ? 'right' : logoPosition, pw, m, {
        r: 17,
        g: 24,
        b: 39,
      });
      y += 18;
      drawLine(doc, x, y, cw);
      y += 5;
      break;
    }
    case 'compact': {
      placeBrandColored(doc, company, x, y + 4, logoPosition, pw, m, rgb);
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(docLabel, pw - m, y + 4, { align: 'right' });
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(num, pw - m, y + 9, { align: 'right' });
      y += 14;
      break;
    }
    case 'classic':
    default: {
      // Left accent bar
      drawColoredRect(doc, x, y, 1.5, 16, rgb);
      placeBrandColored(doc, company, x + 4, y + 6, logoPosition === 'right' ? 'left' : logoPosition, pw, m, {
        r: 17,
        g: 24,
        b: 39,
      });
      if (sellerTpin && logoPosition !== 'right') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`TPIN: ${sellerTpin}`, x + 4, y + 12);
      }
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(titleCase(docLabel), pw - m, y + 6, { align: 'right' });
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(num, pw - m, y + 12, { align: 'right' });
      y += 20;
      break;
    }
  }

  return y;
}

/** Table header style hints per layout for autoTable. */
export function pdfTableHeadStyles(layoutId, rgb) {
  if (layoutId === 'minimal' || layoutId === 'compact') {
    return {
      fillColor: [255, 255, 255],
      textColor: [100, 116, 139],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: layoutId === 'compact' ? 1.2 : 2,
    };
  }
  if (layoutId === 'ledger') {
    return {
      fillColor: [245, 245, 244],
      textColor: [41, 37, 36],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 1.5,
      lineWidth: 0.3,
      lineColor: [120, 113, 108],
    };
  }
  if (layoutId === 'soft-card' || layoutId === 'editorial') {
    return {
      fillColor: [248, 250, 252],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    };
  }
  return {
    fillColor: [rgb.r, rgb.g, rgb.b],
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: 8,
    cellPadding: 2,
  };
}

export function pdfTableBodyStyles(layoutId) {
  if (layoutId === 'compact') {
    return { fontSize: 7.5, cellPadding: 1.2 };
  }
  if (layoutId === 'ledger') {
    return {
      fontSize: 8,
      cellPadding: 1.5,
      lineWidth: 0.25,
      lineColor: [168, 162, 158],
      font: 'helvetica',
    };
  }
  return {
    font: 'helvetica',
    fontSize: 8.5,
    cellPadding: 1.8,
    lineWidth: 0.1,
    lineColor: [226, 232, 240],
    valign: 'middle',
  };
}

function placeBrandColored(doc, company, x, y, logoPosition, pw, m, rgb) {
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (logoPosition === 'center') {
    doc.text(company, pw / 2, y, { align: 'center' });
  } else if (logoPosition === 'right') {
    doc.text(company, pw - m, y, { align: 'right' });
  } else {
    doc.text(company, x, y);
  }
}

function drawColoredRect(doc, x, y, w, h, rgb) {
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(x, y, w, h, 'F');
}

function drawLine(doc, x, y, width) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, y, x + width, y);
}

function titleCase(label) {
  const s = String(label || '');
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Shared bill-to + meta panels; returns new y. */
export function drawBillToAndDetails(doc, opts) {
  const {
    x,
    y: startY,
    cw,
    client,
    title,
    orderNumber,
    issueDate,
    dueDate,
    dueLabel = 'Due',
    status,
    layoutId,
    rgb,
  } = opts;
  let y = startY;
  const boxH = layoutId === 'compact' ? 30 : 38;
  const soft = layoutId === 'soft-card' || layoutId === 'modern' || layoutId === 'band-header';

  if (soft) {
    doc.setFillColor(248, 250, 252);
    doc.rect(x, y, cw / 2 - 3, boxH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, y, cw / 2 - 3, boxH, 'S');
    doc.setFillColor(248, 250, 252);
    doc.rect(x + cw / 2 + 3, y, cw / 2 - 3, boxH, 'F');
    doc.rect(x + cw / 2 + 3, y, cw / 2 - 3, boxH, 'S');
  } else if (layoutId === 'ledger') {
    doc.setDrawColor(120, 113, 108);
    doc.setLineWidth(0.35);
    doc.rect(x, y, cw / 2 - 3, boxH, 'S');
    doc.rect(x + cw / 2 + 3, y, cw / 2 - 3, boxH, 'S');
  }

  let by = y + 4;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', x + 3, by);
  by += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(layoutId === 'compact' ? 8 : 9);
  if (client?.name) {
    doc.setFont('helvetica', 'bold');
    doc.text(String(client.name), x + 3, by);
    doc.setFont('helvetica', 'normal');
    by += 4;
  }
  if (client?.contactPerson) {
    doc.text(`Attn: ${client.contactPerson}`, x + 3, by);
    by += 3.5;
  }
  if (client?.address) {
    const addrLines = doc.splitTextToSize(String(client.address), cw / 2 - 8);
    addrLines.slice(0, 2).forEach((ln) => {
      doc.text(ln, x + 3, by);
      by += 3.5;
    });
  }
  if (client?.email) {
    doc.text(String(client.email), x + 3, by);
    by += 3.5;
  }
  if (client?.phone) {
    doc.text(`Tel: ${client.phone}`, x + 3, by);
  }

  let dy = y + 4;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILS', x + cw / 2 + 6, dy);
  dy += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8.5);
  const detailRows = [
    ['Title', title || '—'],
    ['Order #', orderNumber || '—'],
    ['Issue', typeof issueDate === 'string' ? issueDate : formatDate(issueDate)],
    [dueLabel, typeof dueDate === 'string' ? dueDate : formatDate(dueDate)],
    ['Status', String(status || '')],
  ];
  detailRows.forEach(([lab, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${lab}:`, x + cw / 2 + 6, dy);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val), x + cw / 2 + 28, dy);
    dy += layoutId === 'compact' ? 3.5 : 4;
  });

  y += boxH + (layoutId === 'compact' ? 4 : 6);

  if (layoutId !== 'editorial' && layoutId !== 'compact') {
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title || 'Document', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 7;
  }

  return y;
}

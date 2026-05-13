// app/api/payroll/[id]/payslip/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { formatSalaryAmount } from '@/lib/currencyUtils';
import { getPayrollStatutoryBreakdown } from '@/lib/payrollStatutoryBreakdown';

export async function GET(request, { params }) {
  const { id } = await params;
  const payrollId = String(id);

  try {
    // Authentication check
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch payroll data with employee details and tenant information
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { 
        employee: {
          include: {
            tenant: {
              include: {
                settings: true
              }
            }
          }
        }
      },
    });

    if (!payroll || !payroll.employee) {
      return NextResponse.json(
        { error: 'Payroll or employee not found' },
        { status: 404 }
      );
    }

    // Process data exactly as frontend does
    const processedPayslip = processPayslipData(payroll);

    // Try to generate PDF with Puppeteer first (for proper logo display)
    // If that fails, fall back to jsPDF with logo placeholders
    let pdfBuffer;
    try {
      pdfBuffer = await generatePayslipPDFWithPuppeteer(processedPayslip);
    } catch (puppeteerError) {
      console.warn('Puppeteer PDF generation failed, falling back to jsPDF:', puppeteerError);
      pdfBuffer = await generatePayslipPDFWithJsPDF(processedPayslip);
    }

    // Return PDF response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="payslip-${payroll.employee.name}-${processedPayslip.payPeriod}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating payslip:', error);
    return NextResponse.json(
      { error: `Failed to generate payslip: ${error.message}` },
      { status: 500 }
    );
  }
}

// Process payslip data exactly as frontend does
function processPayslipData(payroll) {
  const basicSalary = payroll.basicSalary || 0;
  const additions = payroll.additions || 0;
  const statutory = getPayrollStatutoryBreakdown(payroll);
  const grossPay = Number(payroll.grossPay || basicSalary || 0) || 0;
  const paye = statutory.payeAmount || 0;
  const pension = statutory.npsEmployeeAmount || 0;
  const deductions = Math.max(0, (Number(payroll.deductions || 0) || 0) - paye - pension);
  const tax = paye;
  const netPay = payroll.netPay || 0;
  const deductionsTotal = deductions + pension + paye;
  const totalEarnings = grossPay + additions;

  // Explicit fields only — do not spread full payroll (avoids leaking `notes` JSON or other DB fields into PDF/HTML).
  return {
    id: payroll.id,
    employee: payroll.employee,
    periodStart: payroll.periodStart,
    periodEnd: payroll.periodEnd,
    paymentDate: payroll.paymentDate,
    status: payroll.status,
    basicSalary,
    additions,
    deductions,
    pension,
    paye,
    deductionsTotal,
    netPay,
    tax,
    grossPay,
    totalEarnings,
    refNumber: `PS-${payroll.id.substring(0, 8).toUpperCase()}`,
    issueDate: new Date().toISOString(),
    payPeriod: `${new Date(payroll.periodStart).toLocaleString('default', { month: 'long' })} ${new Date(payroll.periodStart).getFullYear()}`,
    benefits: {},
    benefitsTotal: 0,
  };
}

// Helper function to format date properly (matching frontend format)
function formatDate(date) {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

// Generate payslip PDF using Puppeteer (like invoices) for proper logo display
async function generatePayslipPDFWithPuppeteer(processedPayslip) {
  try {
    const { launchPuppeteer, PDF_SET_CONTENT_OPTIONS } = await import('@/lib/puppeteer-launch');

    const tenant = processedPayslip.employee.tenant;
    const tenantSettings = tenant.settings;

    // Generate HTML for the payslip
    const payslipHtml = generatePayslipHtml(processedPayslip, tenant, tenantSettings);

    // Create a full HTML document with proper styles
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payslip - ${processedPayslip.employee.name}</title>
          <style>
            @page {
              margin: 0.45in;
              size: A4;
            }
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
              line-height: 1.45;
              color: #1e293b;
              background: #f1f5f9;
            }
            .payslip {
              max-width: 720px;
              margin: 0 auto;
              padding: 8px 0 24px;
            }
            .payslip-frame {
              background: #fff;
              border-radius: 12px;
              box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
              border: 1px solid #e2e8f0;
              overflow: hidden;
            }
            .accent-bar {
              height: 5px;
              background: linear-gradient(90deg, #0d9488 0%, #2563eb 50%, #7c3aed 100%);
            }
            .header {
              text-align: center;
              padding: 22px 24px 18px;
              border-bottom: 1px solid #e2e8f0;
              background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
            }
            .logo {
              max-height: 72px;
              max-width: 200px;
              object-fit: contain;
              margin-bottom: 12px;
            }
            .company-name {
              font-size: 22px;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: -0.02em;
            }
            .company-info {
              font-size: 13px;
              color: #64748b;
              margin-top: 4px;
            }
            .title-row {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 18px 24px 12px;
            }
            .pill {
              display: inline-block;
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.12em;
              color: #fff;
              background: linear-gradient(135deg, #0d9488, #2563eb);
              padding: 8px 16px;
              border-radius: 999px;
            }
            .period-chip {
              font-size: 14px;
              font-weight: 600;
              color: #475569;
              background: #e0f2fe;
              border: 1px solid #bae6fd;
              padding: 8px 14px;
              border-radius: 8px;
            }
            .meta-section {
              margin: 0 24px 20px;
              padding: 14px 16px;
              background: #f8fafc;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
              font-size: 13px;
              color: #334155;
            }
            .meta-section strong {
              color: #0f172a;
            }
            .employee-details {
              margin: 0 24px 22px;
            }
            .employee-details h3 {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e2e8f0;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 20px;
            }
            .detail-item {
              padding: 10px 12px;
              background: #f8fafc;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .detail-label {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #64748b;
              margin-bottom: 4px;
            }
            .detail-value {
              font-size: 14px;
              font-weight: 600;
              color: #0f172a;
            }
            .earnings-section, .deductions-section {
              margin: 0 24px 22px;
            }
            .section-title {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 10px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .section-title::before {
              content: '';
              width: 4px;
              height: 18px;
              border-radius: 2px;
            }
            .earnings-section .section-title::before {
              background: #0d9488;
            }
            .deductions-section .section-title::before {
              background: #6366f1;
            }
            .table-wrap {
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid #e2e8f0;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
            }
            .table th, .table td {
              padding: 12px 14px;
              text-align: left;
            }
            .table thead th {
              font-weight: 700;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #fff;
            }
            .table-earnings thead th {
              background: linear-gradient(135deg, #0f766e, #0d9488);
            }
            .table-deductions thead th {
              background: linear-gradient(135deg, #4338ca, #6366f1);
            }
            .table tbody tr:nth-child(odd) {
              background: #f8fafc;
            }
            .table tbody tr:nth-child(even) {
              background: #fff;
            }
            .table tbody td {
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            .table tbody tr:last-child td {
              border-bottom: none;
            }
            .table .total-row {
              font-weight: 700;
              background: #ecfdf5 !important;
              color: #065f46;
            }
            .table-deductions .total-row {
              background: #eef2ff !important;
              color: #3730a3;
            }
            .table td:last-child, .table th:last-child {
              text-align: right;
              font-variant-numeric: tabular-nums;
            }
            .net-pay {
              margin: 24px;
              padding: 0;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18);
            }
            .net-pay-inner {
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 12px;
              padding: 20px 24px;
              background: linear-gradient(125deg, #0f172a 0%, #1e3a5f 45%, #0f766e 100%);
            }
            .net-pay-label {
              font-size: 14px;
              font-weight: 800;
              letter-spacing: 0.14em;
              color: #e2e8f0;
            }
            .net-pay-amount {
              font-size: 28px;
              font-weight: 800;
              color: #6ee7b7;
              text-shadow: 0 1px 2px rgba(0,0,0,0.25);
            }
            .footer {
              margin: 0 24px 20px;
              text-align: center;
              font-size: 11px;
              color: #64748b;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          ${payslipHtml}
        </body>
      </html>
    `;

    const browser = await launchPuppeteer();

    const page = await browser.newPage();

    await page.setContent(fullHtml, PDF_SET_CONTENT_OPTIONS);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.4in',
        right: '0.4in',
        bottom: '0.4in',
        left: '0.4in'
      }
    });
    
    await browser.close();
    
    return pdf;
  } catch (error) {
    console.error('Error generating payslip PDF with Puppeteer:', error);
    throw error;
  }
}

// Generate HTML for the payslip (for Puppeteer)
function generatePayslipHtml(processedPayslip, tenant, tenantSettings) {
  // Company logo HTML
  let logoHtml = '';
  if (tenant.logoUrl) {
    const logoUrl = tenant.logoUrl.startsWith('http') 
      ? tenant.logoUrl 
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${tenant.logoUrl}`;
    logoHtml = `<img src="${logoUrl}" alt="Company Logo" class="logo">`;
  }

  // Company info HTML
  let companyInfoHtml = '';
  if (tenantSettings) {
    if (tenantSettings.buildingName) {
      companyInfoHtml += `<div class="company-info">${tenantSettings.buildingName}</div>`;
    }
    if (tenantSettings.businessAddress) {
      companyInfoHtml += `<div class="company-info">${tenantSettings.businessAddress}</div>`;
    }
    if (tenantSettings.businessCity) {
      companyInfoHtml += `<div class="company-info">${tenantSettings.businessCity}</div>`;
    }
    if (tenantSettings.businessPhone || tenantSettings.businessEmail) {
      let contactInfo = '';
      if (tenantSettings.businessPhone) contactInfo += `Tel: ${tenantSettings.businessPhone}`;
      if (tenantSettings.businessPhone && tenantSettings.businessEmail) contactInfo += ' | ';
      if (tenantSettings.businessEmail) contactInfo += `Email: ${tenantSettings.businessEmail}`;
      companyInfoHtml += `<div class="company-info">${contactInfo}</div>`;
    }
  }

  // Fallback company info if no tenant settings
  if (!companyInfoHtml) {
    companyInfoHtml = `
      <div class="company-info">123 Business Park, Lilongwe, Malawi</div>
      <div class="company-info">Tel: +265 1 234 5678 | Email: hr@company.com</div>
    `;
  }

  return `
    <div class="payslip">
      <div class="payslip-frame">
        <div class="accent-bar"></div>
        <div class="header">
          ${logoHtml}
          <div class="company-name">${tenant.name || 'InsightBooks'}</div>
          ${companyInfoHtml}
        </div>

        <div class="title-row">
          <span class="pill">PAYSLIP</span>
          <span class="period-chip">Pay Period: ${processedPayslip.payPeriod}</span>
        </div>

        <div class="meta-section">
          <strong>Ref:</strong> ${processedPayslip.refNumber}
          &nbsp;·&nbsp;
          <strong>Issue date:</strong> ${formatDate(processedPayslip.issueDate)}
        </div>

        <div class="employee-details">
          <h3>Employee information</h3>
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">Employee</div>
              <div class="detail-value">${processedPayslip.employee.name}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Employee ID</div>
              <div class="detail-value">${processedPayslip.employee.id}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Position</div>
              <div class="detail-value">${processedPayslip.employee.position || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Department</div>
              <div class="detail-value">${processedPayslip.employee.department || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Payment date</div>
              <div class="detail-value">${processedPayslip.paymentDate ? formatDate(processedPayslip.paymentDate) : 'Pending'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Tax ID</div>
              <div class="detail-value">${processedPayslip.employee.taxID || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Bank account</div>
              <div class="detail-value">${processedPayslip.employee.bankAccount || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="earnings-section">
          <h3 class="section-title">Earnings</h3>
          <div class="table-wrap">
            <table class="table table-earnings">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Basic salary</td>
                  <td>${formatSalaryAmount(processedPayslip.basicSalary)}</td>
                </tr>
                ${processedPayslip.additions > 0 ? `
                <tr>
                  <td>Benefits &amp; allowances (after tax)</td>
                  <td>${formatSalaryAmount(processedPayslip.additions)}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                  <td>Taxable gross pay</td>
                  <td>${formatSalaryAmount(processedPayslip.grossPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="deductions-section">
          <h3 class="section-title">Deductions</h3>
          <div class="table-wrap">
            <table class="table table-deductions">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${Number(processedPayslip.deductions) > 0 ? `
                <tr>
                  <td>Other deductions</td>
                  <td>${formatSalaryAmount(processedPayslip.deductions)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td>Pension (NPS)</td>
                  <td>${formatSalaryAmount(processedPayslip.pension || 0)}</td>
                </tr>
                <tr>
                  <td>Income tax (PAYE)</td>
                  <td>${formatSalaryAmount(processedPayslip.paye || 0)}</td>
                </tr>
                <tr class="total-row">
                  <td>Total deductions</td>
                  <td>${formatSalaryAmount(processedPayslip.deductionsTotal || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="net-pay">
          <div class="net-pay-inner">
            <div class="net-pay-label">NET PAY</div>
            <div class="net-pay-amount">${formatSalaryAmount(processedPayslip.netPay)}</div>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated document and does not require a signature.</p>
          <p>For any queries regarding this payslip, please contact the HR department.</p>
        </div>
      </div>
    </div>
  `;
}

// Fallback: Generate payslip PDF using jsPDF with logo placeholders
async function generatePayslipPDFWithJsPDF(processedPayslip) {
  try {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 20;
    let yPos = margin;

    const tenant = processedPayslip.employee.tenant;
    const tenantSettings = tenant.settings;

    // Company header - Logo or Company Name (matching frontend)
    if (tenant.logoUrl) {
      try {
        // Create a styled logo placeholder that looks professional
        const logoHeight = createLogoPlaceholder(doc, tenant.logoUrl, margin, yPos);
        if (logoHeight > 0) {
          yPos += logoHeight;
        } else {
          throw new Error('Logo creation failed');
        }
      } catch (error) {
        console.warn('Could not add logo, falling back to company name:', error);
        // Fall back to company name
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(tenant.name || 'InsightBooks', 105, yPos, { align: 'center' });
        yPos += 15;
      }
    } else {
      // No logo available, use company name
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(tenant.name || 'InsightBooks', 105, yPos, { align: 'center' });
      yPos += 15;
    }

    // Company address and contact info (matching frontend)
    if (tenantSettings) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (tenantSettings.buildingName) {
        doc.text(tenantSettings.buildingName, 105, yPos, { align: 'center' });
        yPos += 5;
      }
      
      if (tenantSettings.businessAddress) {
        doc.text(tenantSettings.businessAddress, 105, yPos, { align: 'center' });
        yPos += 5;
      }
      
      if (tenantSettings.businessCity) {
        doc.text(tenantSettings.businessCity, 105, yPos, { align: 'center' });
        yPos += 5;
      }
      
      if (tenantSettings.businessPhone || tenantSettings.businessEmail) {
        let contactInfo = '';
        if (tenantSettings.businessPhone) contactInfo += `Tel: ${tenantSettings.businessPhone}`;
        if (tenantSettings.businessPhone && tenantSettings.businessEmail) contactInfo += ' | ';
        if (tenantSettings.businessEmail) contactInfo += `Email: ${tenantSettings.businessEmail}`;
        doc.text(contactInfo, 105, yPos, { align: 'center' });
        yPos += 5;
      }
    }

    // Accent strip + payslip title
    doc.setFillColor(13, 148, 136);
    doc.rect(margin, yPos, doc.internal.pageSize.getWidth() - margin * 2, 2.5, 'F');
    yPos += 8;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('PAYSLIP', 105, yPos + 4, { align: 'center' });
    yPos += 12;

    // Pay period
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Pay Period: ${processedPayslip.payPeriod}`, 105, yPos, { align: 'center' });
    yPos += 10;

    // Employee information
    autoTable(doc, {
      startY: yPos,
      head: [['Employee information', '']],
      body: [
        ['Employee Name:', processedPayslip.employee.name || 'N/A'],
        ['Position:', processedPayslip.employee.position || 'N/A'],
        ['Department:', processedPayslip.employee.department || 'N/A'],
        ['Payment Date:', processedPayslip.paymentDate ?
          formatDate(processedPayslip.paymentDate) : 'Pending'],
        ['Employee ID:', processedPayslip.employee.id.substring(0, 8)],
        ['Tax ID:', 'N/A'],
        ['Bank Account:', 'N/A']
      ],
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 10
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 52, textColor: [71, 85, 105] },
        1: { textColor: [15, 23, 42], fontStyle: 'normal' }
      },
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.1 }
    });
    yPos = doc.lastAutoTable.finalY + 10;

    // Earnings
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text('Earnings', margin, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Amount']],
      body: [
        ['Basic Salary', formatSalaryAmount(processedPayslip.basicSalary)],
        ...(processedPayslip.additions > 0 ? [['Benefits & Allowances (after tax)', formatSalaryAmount(processedPayslip.additions)]] : []),
        ['Taxable Gross Pay', formatSalaryAmount(processedPayslip.grossPay)]
      ],
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      theme: 'striped',
      columnStyles: { 1: { halign: 'right' } },
      styles: { fontSize: 10, cellPadding: 3 }
    });
    yPos = doc.lastAutoTable.finalY + 10;

    // Deductions (no redundant "Deductions" line — show other only if > 0)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202);
    doc.text('Deductions', margin, yPos);
    yPos += 5;

    const deductionRows = [];
    if (Number(processedPayslip.deductions) > 0) {
      deductionRows.push(['Other deductions', formatSalaryAmount(processedPayslip.deductions)]);
    }
    deductionRows.push(
      ['Pension (NPS)', formatSalaryAmount(processedPayslip.pension || 0)],
      ['Income Tax (PAYE)', formatSalaryAmount(processedPayslip.paye || 0)],
      ['Total Deductions', formatSalaryAmount(processedPayslip.deductionsTotal || 0)]
    );

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Amount']],
      body: deductionRows,
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      theme: 'striped',
      columnStyles: { 1: { halign: 'right' } },
      styles: { fontSize: 10, cellPadding: 3 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === deductionRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [238, 242, 255];
          data.cell.styles.textColor = [55, 48, 163];
        }
      }
    });
    yPos = doc.lastAutoTable.finalY + 12;

    // Net pay — high contrast banner
    const pageW = doc.internal.pageSize.getWidth();
    const bannerW = pageW - margin * 2;
    const bannerH = 18;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, yPos, bannerW, bannerH, 2, 2, 'F');
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.line(margin + 2, yPos + bannerH - 1.5, margin + bannerW - 2, yPos + bannerH - 1.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(226, 232, 240);
    doc.text('NET PAY', margin + 6, yPos + 11);

    doc.setFontSize(17);
    doc.setTextColor(110, 231, 183);
    doc.text(formatSalaryAmount(processedPayslip.netPay), pageW - margin - 6, yPos + 11.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPos += bannerH + 10;

    // Footer (matching frontend exactly)
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      'This is a computer-generated document and does not require a signature.',
      105,
      287,
      { align: 'center' }
    );
    doc.text(
      'For any queries regarding this payslip, please contact the HR department.',
      105,
      292,
      { align: 'center' }
    );

    return Buffer.from(doc.output('arraybuffer'));
  } catch (error) {
    console.error('Error generating payslip PDF with jsPDF:', error);
    throw error;
  }
}

// Helper function to create logo placeholder (matching frontend display)
function createLogoPlaceholder(doc, logoUrl, margin, yPos) {
  try {
    // Create a logo placeholder that matches the frontend styling
    const companyName = logoUrl.split('/').pop().split('.')[0] || 'LOGO';
    const initials = companyName.substring(0, 2).toUpperCase();
    
    // Draw a styled logo placeholder similar to frontend
    doc.setFillColor(13, 148, 136);
    doc.circle(margin + 20, yPos + 15, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(initials, margin + 20, yPos + 18, { align: 'center' });
    
    return 35; // Return the height used
  } catch (error) {
    console.warn('Could not create logo placeholder:', error);
    return 0;
  }
}

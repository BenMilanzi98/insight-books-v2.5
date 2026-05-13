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
              margin: 0.5in;
              size: A4;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              margin: 0;
              padding: 0;
              line-height: 1.4;
            }
            .payslip {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .logo {
              max-height: 80px;
              max-width: 200px;
              object-fit: contain;
              margin-bottom: 15px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 10px;
            }
            .company-info {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 5px;
            }
            .payslip-title {
              font-size: 20px;
              font-weight: bold;
              color: #374151;
              margin-bottom: 20px;
            }
            .pay-period {
              font-size: 16px;
              color: #6b7280;
              margin-bottom: 20px;
            }
            .meta-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .employee-details {
              margin-bottom: 30px;
            }
            .employee-details h3 {
              font-size: 18px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            .detail-item {
              margin-bottom: 10px;
            }
            .detail-label {
              font-weight: 600;
              color: #374151;
              margin-bottom: 5px;
            }
            .detail-value {
              color: #6b7280;
            }
            .earnings-section, .deductions-section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
            }
            .table th, .table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            .table th {
              background-color: #f9fafb;
              font-weight: 600;
              color: #374151;
            }
            .table .total-row {
              font-weight: 600;
              background-color: #f3f4f6;
            }
            .net-pay {
              background-color: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
              text-align: center;
            }
            .net-pay-label {
              font-size: 18px;
              font-weight: 600;
              color: #374151;
              margin-bottom: 10px;
            }
            .net-pay-amount {
              font-size: 24px;
              font-weight: bold;
              color: #059669;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
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
      <div class="header">
        ${logoHtml}
        <div class="company-name">${tenant.name || 'InsightBooks'}</div>
        ${companyInfoHtml}
      </div>
      
      <div class="payslip-title">PAYSLIP</div>
      <div class="pay-period">Pay Period: ${processedPayslip.payPeriod}</div>
      
      <div class="meta-section">
        <div>
          <strong>Ref Number:</strong> ${processedPayslip.refNumber}<br>
          <strong>Issue Date:</strong> ${formatDate(processedPayslip.issueDate)}<br>
          <strong>Pay Period:</strong> ${processedPayslip.payPeriod}
        </div>
      </div>
      
      <div class="employee-details">
        <h3>Employee Information</h3>
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Employee:</div>
            <div class="detail-value">${processedPayslip.employee.name}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Employee ID:</div>
            <div class="detail-value">${processedPayslip.employee.id}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Position:</div>
            <div class="detail-value">${processedPayslip.employee.position || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Department:</div>
            <div class="detail-value">${processedPayslip.employee.department || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Tax ID:</div>
            <div class="detail-value">${processedPayslip.employee.taxID || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Bank Account:</div>
            <div class="detail-value">${processedPayslip.employee.bankAccount || 'N/A'}</div>
          </div>
        </div>
      </div>
      
      <div class="earnings-section">
        <h3 class="section-title">Earnings</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td>${formatSalaryAmount(processedPayslip.basicSalary)}</td>
            </tr>
            ${processedPayslip.additions > 0 ? `
            <tr>
              <td>Benefits & Allowances (after tax)</td>
              <td>${formatSalaryAmount(processedPayslip.additions)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td><strong>Taxable Gross Pay</strong></td>
              <td><strong>${formatSalaryAmount(processedPayslip.grossPay)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="deductions-section">
        <h3 class="section-title">Deductions</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Deductions</td>
              <td>${formatSalaryAmount(processedPayslip.deductions)}</td>
            </tr>
            <tr>
              <td>Pension (NPS)</td>
              <td>${formatSalaryAmount(processedPayslip.pension || 0)}</td>
            </tr>
            <tr>
              <td>Income Tax (PAYE)</td>
              <td>${formatSalaryAmount(processedPayslip.paye || 0)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>Total Deductions</strong></td>
              <td><strong>${formatSalaryAmount(processedPayslip.deductionsTotal || 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="net-pay">
        <div class="net-pay-label">NET PAY</div>
        <div class="net-pay-amount">${formatSalaryAmount(processedPayslip.netPay)}</div>
      </div>
      
      <div class="footer">
        <p>This is a computer-generated document and does not require a signature.</p>
        <p>For any queries regarding this payslip, please contact the HR department.</p>
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

    // Payslip title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYSLIP', 105, yPos + 5, { align: 'center' });
    yPos += 15;

    // Pay period (matching frontend format)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Pay Period: ${processedPayslip.payPeriod}`,
      105,
      yPos,
      { align: 'center' }
    );
    yPos += 10;

    // Employee information table (matching frontend exactly)
    autoTable(doc, {
      startY: yPos,
      body: [
        ['Employee Name:', processedPayslip.employee.name || 'N/A'],
        ['Position:', processedPayslip.employee.position || 'N/A'],
        ['Department:', processedPayslip.employee.department || 'N/A'],
        ['Payment Date:', processedPayslip.paymentDate ? 
          formatDate(processedPayslip.paymentDate) : 'Pending'],
        ['Employee ID:', processedPayslip.employee.id.substring(0, 8)],
        ['Tax ID:', 'N/A'], // Matching frontend
        ['Bank Account:', 'N/A'] // Matching frontend
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: margin },
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1 }
    });
    yPos = doc.lastAutoTable.finalY + 10;

    // Earnings table (matching frontend exactly)
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Amount']],
      body: [
        ['Basic Salary', formatSalaryAmount(processedPayslip.basicSalary)],
        ...(processedPayslip.additions > 0 ? [['Benefits & Allowances (after tax)', formatSalaryAmount(processedPayslip.additions)]] : []),
        ['Taxable Gross Pay', formatSalaryAmount(processedPayslip.grossPay)]
      ],
      headStyles: {
        fillColor: [40, 40, 40],
        textColor: 255,
        fontStyle: 'bold'
      },
      margin: { left: margin, right: margin },
      theme: 'striped'
    });
    yPos = doc.lastAutoTable.finalY + 10;

    // Deductions table (matching frontend exactly)
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Amount']],
      body: [
        ['Deductions', formatSalaryAmount(processedPayslip.deductions)],
        ['Pension (NPS)', formatSalaryAmount(processedPayslip.pension || 0)],
        ['Income Tax (PAYE)', formatSalaryAmount(processedPayslip.paye || 0)],
        [
          'Total Deductions',
          formatSalaryAmount(processedPayslip.deductionsTotal || 0)
        ]
      ],
      headStyles: {
        fillColor: [40, 40, 40],
        textColor: 255,
        fontStyle: 'bold'
      },
      margin: { left: margin, right: margin },
      theme: 'striped'
    });
    yPos = doc.lastAutoTable.finalY + 15;

    // Net pay section (matching frontend)
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, 170, 12, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('NET PAY:', margin + 5, yPos + 8);
    doc.text(formatSalaryAmount(processedPayslip.netPay), 165, yPos + 8, { align: 'right' });
    yPos += 20;

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
    doc.setFillColor(70, 130, 180); // Steel blue color
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

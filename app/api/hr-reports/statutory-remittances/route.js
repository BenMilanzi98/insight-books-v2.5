// app/api/hr-reports/statutory-remittances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateStatutoryRemittances } from '@/lib/malawiTaxUtils';
import { getTenantBranding } from '@/lib/reportBranding';

/**
 * GET - Generate statutory remittances report
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('periodStart') || searchParams.get('startDate');
    const periodEnd = searchParams.get('periodEnd') || searchParams.get('endDate');
    const format = (searchParams.get('format') || 'pdf').toLowerCase(); // pdf default

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Period start and end dates are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // Get payrolls for the period
    const payrolls = await prisma.payroll.findMany({
      where: {
        tenantId: user.tenantId,
        periodStart: {
          gte: startDate
        },
        periodEnd: {
          lte: endDate
        }
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true
          }
        }
      }
    });

    if (payrolls.length === 0) {
      return NextResponse.json(
        { error: 'No payroll records found for the specified period' },
        { status: 404 }
      );
    }

    // Calculate statutory remittances
    const remittances = calculateStatutoryRemittances(payrolls);

    // Get tenant information
    const tenantBranding = await getTenantBranding(user.tenantId);

    const report = {
      tenant: tenantBranding,
      period: {
        start: startDate,
        end: endDate,
        generatedAt: new Date()
      },
      summary: {
        totalEmployees: payrolls.length,
        totalGrossPay: payrolls.reduce((sum, p) => sum + p.grossPay, 0),
        totalPAYE: remittances.paye.amount,
        totalNPS: remittances.nps.totalAmount,
        totalStatutory: remittances.totalStatutory
      },
      paye: {
        amount: remittances.paye.amount,
        description: remittances.paye.description,
        remittanceDeadline: remittances.remittanceDeadline,
        authority: 'Malawi Revenue Authority (MRA)',
        accountDetails: 'To be provided by MRA'
      },
      nps: {
        employeeAmount: remittances.nps.employeeAmount,
        employerAmount: remittances.nps.employerAmount,
        totalAmount: remittances.nps.totalAmount,
        description: remittances.nps.description,
        remittanceDeadline: remittances.remittanceDeadline,
        authority: 'Pension Fund Administrator',
        accountDetails: 'To be provided by pension fund administrator'
      },
      employeeBreakdown: payrolls.map(payroll => ({
        employeeId: payroll.employee.employeeId,
        employeeName: payroll.employee.name,
        grossPay: payroll.grossPay,
        payeAmount: payroll.payeAmount || 0,
        npsEmployeeAmount: payroll.npsEmployeeAmount || 0,
        npsEmployerAmount: payroll.npsEmployerAmount || 0
      }))
    };

    if (format === 'json') {
      return NextResponse.json(report);
    }

    const pdfBuffer = await generateStatutoryRemittancesPDF(report);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="statutory-remittances-${periodStart}-to-${periodEnd}.pdf"`
      }
    });

  } catch (error) {
    console.error('Error generating statutory remittances report:', error);
    return NextResponse.json(
      { error: 'Failed to generate statutory remittances report', details: error.message },
      { status: 500 }
    );
  }
}

function formatCurrency(amount) {
  return 'MWK ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function generateStatutoryRemittancesPDF(report) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(report.tenant.name, pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const contactLine = [report.tenant.address, report.tenant.city].filter(Boolean).join(' • ');
  if (contactLine) {
    doc.setTextColor(100, 100, 100);
    doc.text(contactLine, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }
  if (report.tenant.email || report.tenant.phone) {
    const contact = [report.tenant.email, report.tenant.phone].filter(Boolean).join(' | ');
    doc.text(contact, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Statutory Remittances Report', margin, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${formatDate(report.period.start)} - ${formatDate(report.period.end)}`, margin, y);
  y += 8;

  // Summary table
  const summaryRows = [
    ['Total Employees', report.summary.totalEmployees.toString()],
    ['Total Gross Pay', formatCurrency(report.summary.totalGrossPay)],
    ['Total PAYE', formatCurrency(report.summary.totalPAYE)],
    ['Total NPS', formatCurrency(report.summary.totalNPS)],
    ['Total Statutory', formatCurrency(report.summary.totalStatutory)]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Amount']],
    body: summaryRows,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin }
  });

  y = doc.lastAutoTable.finalY + 10;

  // PAYE details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('PAYE Remittance', margin, y);
  y += 6;

  const payeRows = [
    ['Amount Due', formatCurrency(report.paye.amount)],
    ['Remittance Deadline', formatDate(report.paye.remittanceDeadline)],
    ['Authority', report.paye.authority],
    ['Account Details', report.paye.accountDetails || 'N/A'],
    ['Description', report.paye.description || '']
  ];

  autoTable(doc, {
    startY: y,
    body: payeRows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    margin: { left: margin, right: margin }
  });

  y = doc.lastAutoTable.finalY + 8;

  // NPS details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NPS Remittance', margin, y);
  y += 6;

  const npsRows = [
    ['Employee Contribution', formatCurrency(report.nps.employeeAmount)],
    ['Employer Contribution', formatCurrency(report.nps.employerAmount)],
    ['Total NPS', formatCurrency(report.nps.totalAmount)],
    ['Remittance Deadline', formatDate(report.nps.remittanceDeadline)],
    ['Authority', report.nps.authority],
    ['Account Details', report.nps.accountDetails || 'N/A']
  ];

  autoTable(doc, {
    startY: y,
    body: npsRows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    margin: { left: margin, right: margin }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Employee breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('Employee Breakdown', margin, y);
  y += 6;

  const employeeRows = report.employeeBreakdown.map((emp, index) => [
    index + 1,
    emp.employeeId || '-',
    emp.employeeName,
    formatCurrency(emp.grossPay),
    formatCurrency(emp.payeAmount),
    formatCurrency(emp.npsEmployeeAmount),
    formatCurrency(emp.npsEmployerAmount)
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Employee ID', 'Name', 'Gross Pay', 'PAYE', 'NPS (Emp)', 'NPS (Empr)']],
    body: employeeRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [248, 250, 252], textColor: [31, 41, 55], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  return Buffer.from(doc.output('arraybuffer'));
}


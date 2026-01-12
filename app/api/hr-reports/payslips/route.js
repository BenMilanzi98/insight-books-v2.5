// app/api/hr-reports/payslips/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

// Helper function to format currency
function formatCurrency(amount) {
  return 'MWK ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

// Helper function to format date
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Generate PDF with all payslips using jsPDF
async function generatePayslipsPDF(payslips, tenantId) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  
  // Get tenant information
  let tenant = null;
  let tenantSettings = {};
  
  try {
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        settings: true
      }
    });
    
    if (tenant?.settings) {
      tenantSettings = typeof tenant.settings === 'string' 
        ? JSON.parse(tenant.settings) 
        : tenant.settings;
    }
  } catch (error) {
    console.warn('Error fetching tenant information:', error);
  }

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;
  const borderStyles = { lineColor: [229, 231, 235], lineWidth: 0.1 };

  // Generate each payslip
  for (let i = 0; i < payslips.length; i++) {
    const payslip = payslips[i];
    
    // Add new page for each payslip (except the first one)
    if (i > 0) {
      doc.addPage();
      yPos = margin;
    }

    // Company Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(tenant?.name || 'InsightBooks', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Company Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    if (tenantSettings.businessAddress) {
      doc.text(tenantSettings.businessAddress, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
    }
    const contactLine = [tenantSettings.businessCity, tenantSettings.businessPhone, tenantSettings.businessEmail]
      .filter(Boolean)
      .join(' • ');
    if (contactLine) {
      doc.text(contactLine, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
    }

    doc.setDrawColor(229, 231, 235);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Payslip Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('PAYSLIP', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Pay Period
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const periodText = `Pay Period: ${formatDate(payslip.period.start)} - ${formatDate(payslip.period.end)}`;
    doc.text(periodText, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Employee Information Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Employee Information', margin, yPos);
    yPos += 4;
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    const employeeDetails = [
      ['Name', payslip.employee.name],
      ['Employee ID', payslip.employee.employeeId || payslip.employee.id],
      ['Position', payslip.employee.jobTitle || 'N/A'],
      ['Department', payslip.employee.department || 'N/A']
    ];
    if (payslip.hoursWorked > 0) {
      employeeDetails.push(['Hours Worked', `${payslip.hoursWorked}`]);
    }
    if (payslip.overtimeHours > 0) {
      employeeDetails.push(['Overtime Hours', `${payslip.overtimeHours}`]);
    }

    autoTable(doc, {
      startY: yPos,
      body: employeeDetails,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, ...borderStyles },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold', textColor: [55, 65, 81] },
        1: { textColor: [75, 85, 99] }
      },
      margin: { left: margin, right: margin },
      tableLineWidth: 0
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // Earnings Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', margin, yPos);
    yPos += 8;

    const totalAllowances = Object.values(payslip.earnings.allowances || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const earningsData = [
      ['Basic Salary', formatCurrency(payslip.earnings.basicSalary)]
    ];
    
    if (totalAllowances > 0) {
      earningsData.push(['Allowances', formatCurrency(totalAllowances)]);
    }
    if (payslip.earnings.overtimePay > 0) {
      earningsData.push(['Overtime Pay', formatCurrency(payslip.earnings.overtimePay)]);
    }
    earningsData.push(['Gross Pay', formatCurrency(payslip.earnings.grossPay)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Amount']],
      body: earningsData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, ...borderStyles },
      headStyles: { fillColor: [250, 250, 250], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // Allowance Breakdown
    if (Object.keys(payslip.earnings.allowances || {}).length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Allowance Breakdown', margin, yPos);
      yPos += 6;

      const allowanceRows = Object.entries(payslip.earnings.allowances).map(([name, value]) => [
        name,
        formatCurrency(Number(value) || 0)
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Allowance', 'Amount']],
        body: allowanceRows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, ...borderStyles },
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: margin, right: margin }
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Deductions Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Deductions', margin, yPos);
    yPos += 8;

    const totalOtherDeductions = Object.values(payslip.deductions.otherDeductions || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const deductionsData = [];
    
    if (payslip.deductions.paye > 0) {
      deductionsData.push(['PAYE (Income Tax)', formatCurrency(payslip.deductions.paye)]);
    }
    if (payslip.deductions.npsEmployee > 0) {
      deductionsData.push(['NPS Employee Contribution', formatCurrency(payslip.deductions.npsEmployee)]);
    }
    if (totalOtherDeductions > 0) {
      deductionsData.push(['Other Deductions', formatCurrency(totalOtherDeductions)]);
    }
    deductionsData.push(['Total Deductions', formatCurrency(payslip.deductions.totalDeductions)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Amount']],
      body: deductionsData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, ...borderStyles },
      headStyles: { fillColor: [250, 250, 250], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // Net Pay Highlight
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 24, 4, 4, 'F');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('NET PAY', margin + 10, yPos + 10);
    
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text(formatCurrency(payslip.netPay), pageWidth - margin - 10, yPos + 14, { align: 'right' });
    
    yPos += 32;

    // Footer
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('This is a computer-generated document and does not require a signature.', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('For any queries regarding this payslip, please contact the HR department.', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(`Generated on: ${formatDate(payslip.generatedAt)}`, pageWidth / 2, yPos, { align: 'center' });
  }

  // Convert to buffer
  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * GET - Generate payslips for a specific payroll period
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
    // Support both parameter names for compatibility
    const periodStart = searchParams.get('periodStart') || searchParams.get('startDate');
    const periodEnd = searchParams.get('periodEnd') || searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const format = (searchParams.get('format') || 'json').toLowerCase(); // json, pdf, excel - default to json for preview

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Period start and end dates are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // Find payrolls that overlap with the selected date range
    // A payroll overlaps if: periodStart <= endDate AND periodEnd >= startDate
    const where = {
      tenantId: user.tenantId,
      AND: [
        {
          periodStart: {
            lte: endDate
          }
        },
        {
          periodEnd: {
            gte: startDate
          }
        }
      ]
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const payrolls = await prisma.payroll.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            jobTitle: true,
            department: true,
            bankDetails: true
          }
        }
      },
      orderBy: {
        employee: {
          name: 'asc'
        }
      }
    });

    if (payrolls.length === 0) {
      return NextResponse.json(
        { error: 'No payroll records found for the specified period' },
        { status: 404 }
      );
    }

    // Generate payslips
    const payslips = payrolls.map(payroll => {
      // Parse additional info from notes field (stored as JSON)
      let additionalInfo = {};
      if (payroll.notes) {
        try {
          additionalInfo = JSON.parse(payroll.notes);
        } catch (e) {
          console.warn('Failed to parse payroll notes:', e);
        }
      }

      const payslip = {
        id: `Payslip-${payroll.id}`,
        employee: {
          id: payroll.employee.id,
          name: payroll.employee.name,
          email: payroll.employee.email,
          employeeId: payroll.employee.employeeId,
          jobTitle: payroll.employee.jobTitle,
          department: payroll.employee.department
        },
        period: {
          start: payroll.periodStart,
          end: payroll.periodEnd,
          paymentDate: payroll.paymentDate
        },
        earnings: {
          basicSalary: payroll.basicSalary,
          allowances: additionalInfo.allowances || {},
          overtimePay: additionalInfo.overtimePay || 0,
          grossPay: payroll.grossPay || 0
        },
        deductions: {
          paye: payroll.payeAmount || 0,
          npsEmployee: additionalInfo.npsEmployeeAmount || 0,
          otherDeductions: additionalInfo.otherDeductions || {},
          totalDeductions: payroll.deductions || 0
        },
        netPay: payroll.netPay || 0,
        hoursWorked: additionalInfo.hoursWorked || 0,
        overtimeHours: additionalInfo.overtimeHours || 0,
        status: payroll.status,
        generatedAt: new Date().toISOString()
      };

      return payslip;
    });

    if (format === 'pdf') {
      // Generate PDF with all payslips
      const pdfBuffer = await generatePayslipsPDF(payslips, user.tenantId);
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="payslips-${periodStart}-to-${periodEnd}.pdf"`,
        },
      });
    }

    if (format === 'excel' || format === 'xlsx') {
      // Prepare data for Excel
      const excelData = payslips.map(payslip => ({
        'Employee ID': payslip.employee.employeeId || payslip.employee.id,
        'Employee Name': payslip.employee.name,
        'Job Title': payslip.employee.jobTitle || '',
        'Department': payslip.employee.department || '',
        'Period Start': formatDate(payslip.period.start),
        'Period End': formatDate(payslip.period.end),
        'Payment Date': payslip.period.paymentDate ? formatDate(payslip.period.paymentDate) : '',
        'Basic Salary': payslip.earnings.basicSalary || 0,
        'Gross Pay': payslip.earnings.grossPay || 0,
        'PAYE': payslip.deductions.paye || 0,
        'NPS Employee': payslip.deductions.npsEmployee || 0,
        'Other Deductions': Object.values(payslip.deductions.otherDeductions || {}).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0),
        'Total Deductions': payslip.deductions.totalDeductions || 0,
        'Net Pay': payslip.netPay || 0,
        'Hours Worked': payslip.hoursWorked || 0,
        'Overtime Hours': payslip.overtimeHours || 0,
        'Status': payslip.status || ''
      }));

      // Add summary row
      const summary = {
        'Employee ID': 'SUMMARY',
        'Employee Name': '',
        'Job Title': '',
        'Department': '',
        'Period Start': '',
        'Period End': '',
        'Payment Date': '',
        'Basic Salary': payslips.reduce((sum, p) => sum + (p.earnings.basicSalary || 0), 0),
        'Gross Pay': payslips.reduce((sum, p) => sum + (p.earnings.grossPay || 0), 0),
        'PAYE': payslips.reduce((sum, p) => sum + (p.deductions.paye || 0), 0),
        'NPS Employee': payslips.reduce((sum, p) => sum + (p.deductions.npsEmployee || 0), 0),
        'Other Deductions': payslips.reduce((sum, p) => {
          return sum + Object.values(p.deductions.otherDeductions || {}).reduce((s, val) => s + (typeof val === 'number' ? val : 0), 0);
        }, 0),
        'Total Deductions': payslips.reduce((sum, p) => sum + (p.deductions.totalDeductions || 0), 0),
        'Net Pay': payslips.reduce((sum, p) => sum + (p.netPay || 0), 0),
        'Hours Worked': '',
        'Overtime Hours': '',
        'Status': ''
      };

      excelData.push(summary);

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payslips');
      
      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="payslips-${periodStart}-to-${periodEnd}.xlsx"`,
        },
      });
    }

    // Default: return JSON for preview
    return NextResponse.json({
      payslips,
      summary: {
        totalEmployees: payslips.length,
        totalGrossPay: payslips.reduce((sum, p) => sum + p.earnings.grossPay, 0),
        totalPAYE: payslips.reduce((sum, p) => sum + p.deductions.paye, 0),
        totalNPS: payslips.reduce((sum, p) => sum + p.deductions.npsEmployee, 0),
        totalNetPay: payslips.reduce((sum, p) => sum + p.netPay, 0)
      }
    });

  } catch (error) {
    console.error('Error generating payslips:', error);
    return NextResponse.json(
      { error: 'Failed to generate payslips', details: error.message },
      { status: 500 }
    );
  }
}

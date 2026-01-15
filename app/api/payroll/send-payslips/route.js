// app/api/payroll/send-payslips/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { sendEmail } from '@/lib/emailService';

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

// Generate PDF buffer for a single payslip
async function generatePayslipPDF(payslip, tenant) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Header with tenant logo/name
  const companyName = tenant?.name || 'Company';
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Payslip Title
  doc.setFontSize(16);
  doc.text('PAYSLIP', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Period
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const periodText = `Pay Period: ${formatDate(payslip.period.start)} - ${formatDate(payslip.period.end)}`;
  doc.text(periodText, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Employee Details
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
    head: [['Employee Information', '']],
    body: employeeDetails,
    theme: 'plain',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
  });
  yPos = doc.lastAutoTable.finalY + 10;

  // Earnings
  const earningsData = [
    ['Basic Salary', formatCurrency(payslip.earnings.basicSalary)]
  ];
  if (payslip.earnings.overtimePay > 0) {
    earningsData.push(['Overtime Pay', formatCurrency(payslip.earnings.overtimePay)]);
  }
  earningsData.push(['Gross Pay', formatCurrency(payslip.earnings.grossPay)]);

  autoTable(doc, {
    startY: yPos,
    head: [['Earnings', 'Amount']],
    body: earningsData,
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } }
  });
  yPos = doc.lastAutoTable.finalY + 10;

  // Deductions
  const deductionNames = payslip.deductions?.deductionNames || {};
  const deductionsData = [];
  
  // Add PAYE if applicable
  if (payslip.deductions.paye > 0) {
    deductionsData.push(['PAYE (Income Tax)', formatCurrency(payslip.deductions.paye)]);
  }
  
  // Add NPS if applicable
  if (payslip.deductions.npsEmployee > 0) {
    deductionsData.push(['NPS Employee Contribution', formatCurrency(payslip.deductions.npsEmployee)]);
  }
  
  // Add all other deductions with their names
  if (payslip.deductions.otherDeductions && typeof payslip.deductions.otherDeductions === 'object') {
    Object.entries(payslip.deductions.otherDeductions).forEach(([key, value]) => {
      const amount = Number(value) || 0;
      if (amount > 0) {
        // Get deduction name from stored names, or use a default name
        const deductionName = deductionNames[key] || 
          (key.startsWith('advance_') ? 'Salary Advance' :
           key.startsWith('leave_') ? 'Unpaid Leave' :
           key === 'gratuity' ? 'Gratuity Contribution' :
           `Deduction ${key.substring(0, 8)}`);
        deductionsData.push([deductionName, formatCurrency(amount)]);
      }
    });
  }
  
  deductionsData.push(['Total Deductions', formatCurrency(payslip.deductions.totalDeductions)]);

  autoTable(doc, {
    startY: yPos,
    head: [['Deductions', 'Amount']],
    body: deductionsData,
    theme: 'striped',
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } }
  });
  yPos = doc.lastAutoTable.finalY + 15;

  // Net Pay
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Net Pay:', margin, yPos);
  doc.text(formatCurrency(payslip.netPay), pageWidth - margin - 10, yPos, { align: 'right' });
  yPos += 20;

  // Footer
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('For any queries regarding this payslip, please contact the HR department.', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Generated on: ${formatDate(new Date())}`, pageWidth / 2, yPos, { align: 'center' });

  return doc.output('arraybuffer');
}

/**
 * POST - Send payslips to all employees in a payroll run
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { payrollRunId, periodStart, periodEnd } = body;

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Period start and period end are required' },
        { status: 400 }
      );
    }

    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId }
    });

    // Get all payroll entries for this period
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    
    // Set to start and end of day for accurate matching
    periodStartDate.setHours(0, 0, 0, 0);
    periodEndDate.setHours(23, 59, 59, 999);
    
    // Find payrolls that overlap with the specified period
    const payrollEntries = await prisma.payroll.findMany({
      where: {
        tenantId: user.tenantId,
        AND: [
          { periodStart: { lte: periodEndDate } },
          { periodEnd: { gte: periodStartDate } }
        ]
      },
      include: {
        employee: {
          include: {
            tenant: true
          }
        }
      },
      orderBy: {
        employee: {
          name: 'asc'
        }
      }
    });

    if (payrollEntries.length === 0) {
      return NextResponse.json(
        { error: 'No payroll entries found for the specified period' },
        { status: 404 }
      );
    }

    const monthName = new Date(periodStart).toLocaleString('default', { month: 'long' });
    const year = new Date(periodStart).getFullYear();
    const companyName = tenant?.name || 'Company';

    let emailsSent = 0;
    let skipped = 0;
    const errors = [];

    // Send payslip to each employee with email
    for (const payroll of payrollEntries) {
      const employee = payroll.employee;
      
      // Skip employees without email
      if (!employee.email || !employee.email.trim()) {
        skipped++;
        continue;
      }

      try {
        // Parse additional info from notes field
        let additionalInfo = {};
        if (payroll.notes) {
          try {
            additionalInfo = JSON.parse(payroll.notes);
          } catch (e) {
            console.warn(`Failed to parse payroll notes for employee ${employee.id}:`, e);
          }
        }

        // Generate payslip data
        const payslip = {
          id: `Payslip-${payroll.id}`,
          employee: {
            name: employee.name,
            employeeId: employee.employeeId,
            jobTitle: employee.jobTitle,
            department: employee.department
          },
          period: {
            start: payroll.periodStart,
            end: payroll.periodEnd,
            paymentDate: payroll.paymentDate
          },
          earnings: {
            basicSalary: Number(payroll.basicSalary) || 0,
            grossPay: Number(payroll.grossPay) || 0,
            overtimePay: additionalInfo.overtimePay || 0,
            allowances: additionalInfo.allowances || {}
          },
          deductions: {
            paye: Number(payroll.payeAmount) || 0,
            npsEmployee: additionalInfo.npsEmployeeAmount || 0,
            otherDeductions: additionalInfo.otherDeductions || {},
            deductionNames: additionalInfo.deductionNames || {},
            totalDeductions: Number(payroll.deductions) || 0
          },
          netPay: Number(payroll.netPay) || 0,
          hoursWorked: additionalInfo.hoursWorked || 0,
          overtimeHours: additionalInfo.overtimeHours || 0,
          status: payroll.status || 'Processed',
          generatedAt: new Date()
        };

        // Generate PDF
        const pdfBuffer = await generatePayslipPDF(payslip, employee.tenant || tenant);
        const pdfBufferForEmail = Buffer.from(pdfBuffer);

        // Send email with payslip PDF attachment
        await sendEmail({
          to: employee.email,
          subject: `Your Payslip for ${monthName} ${year} - ${companyName}`,
          template: 'payslip-email',
          data: {
            employeeName: employee.name,
            month: monthName,
            year: year,
            periodStart: formatDate(payslip.period.start),
            periodEnd: formatDate(payslip.period.end),
            netPay: formatCurrency(payslip.netPay),
            grossPay: formatCurrency(payslip.earnings.grossPay),
            totalDeductions: formatCurrency(payslip.deductions.totalDeductions),
            companyName: companyName,
            tenantName: employee.tenant?.name,
            tenantLogoUrl: employee.tenant?.logoUrl || tenant?.logoUrl || null
          },
          attachments: [
            {
              name: `payslip-${employee.name.replace(/\s+/g, '-')}-${monthName}-${year}.pdf`,
              content: pdfBufferForEmail,
              type: 'application/pdf'
            }
          ]
        });

        emailsSent++;
        console.log(`Payslip sent successfully to ${employee.name} (${employee.email})`);
      } catch (error) {
        console.error(`Error sending payslip to ${employee.name} (${employee.email}):`, error);
        errors.push({
          employee: employee.name,
          email: employee.email,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      skipped,
      total: payrollEntries.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Payslips sent: ${emailsSent}, Skipped (no email): ${skipped}${errors.length > 0 ? `, Failed: ${errors.length}` : ''}`
    });

  } catch (error) {
    console.error('Error sending payslip emails:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send payslip emails', 
        details: error.message
      },
      { status: 500 }
    );
  }
}


// app/api/payroll/[id]/details/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request, { params }) {
  const payrollId = String(params.id);

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
        { status: 500 }
      );
    }

    // Helper function to format date properly (matching frontend format)
    const formatDate = (date) => {
      if (!date) return null;
      try {
        return new Date(date).toISOString();
      } catch (error) {
        return null;
      }
    };

    // Calculate values exactly as frontend does
    const basicSalary = payroll.basicSalary || 0;
    const additions = payroll.additions || 0;
    const deductions = payroll.deductions || 0;
    const grossPay = basicSalary + additions;
    const tax = 0; // Tax field not available in current schema
    const netPay = payroll.netPay || 0;

    // Return payslip data EXACTLY matching frontend structure
    return NextResponse.json({
      success: true,
      payslip: {
        id: payroll.id,
        basicSalary: basicSalary,
        additions: additions,
        deductions: deductions,
        deductionsTotal: deductions,
        netPay: netPay,
        tax: tax,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        paymentDate: payroll.paymentDate,
        notes: payroll.notes,
        refNumber: `PS-${payroll.id.substring(0, 8).toUpperCase()}`,
        issueDate: formatDate(new Date()),
        payPeriod: `${new Date(payroll.periodStart).toLocaleString('default', { month: 'long' })} ${new Date(payroll.periodStart).getFullYear()}`,
        employee: {
          id: payroll.employee.id,
          name: payroll.employee.name,
          position: payroll.employee.position || 'N/A',
          department: payroll.employee.department || 'N/A',
          email: payroll.employee.email || 'N/A',
          phone: payroll.employee.phone || 'N/A',
          address: payroll.employee.address || 'N/A',
          taxID: 'N/A', // Add when available in schema
          bankAccount: 'N/A' // Add when available in schema
        },
        tenant: {
          name: payroll.employee.tenant.name,
          logoUrl: payroll.employee.tenant.logoUrl,
          settings: payroll.employee.tenant.settings
        },
        // Additional fields that frontend expects
        benefits: {}, // Empty object as frontend expects
        benefitsTotal: 0,
        grossPay: grossPay,
        yearToDate: {
          earnings: grossPay, // Using current payslip data as fallback
          tax: tax,
          netPay: netPay
        }
      },
    });
  } catch (error) {
    console.error('Error fetching payslip data:', error);
    return NextResponse.json(
      { error: `Failed to fetch payslip data: ${error.message}` },
      { status: 500 }
    );
  }
}
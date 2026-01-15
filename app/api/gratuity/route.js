// app/api/gratuity/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get all gratuity accounts for the tenant
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
    const employeeId = searchParams.get('employeeId');

    const where = {
      tenantId: user.tenantId
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const gratuityAccounts = await prisma.gratuityAccount.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            grossSalary: true,
            salary: true,
            startDate: true
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          },
          take: 10
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ gratuityAccounts });

  } catch (error) {
    console.error('Error fetching gratuity accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gratuity accounts', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or update gratuity account and calculate accruals
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
    const { employeeId, accrualRate, recalculate } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        grossSalary: true,
        salary: true,
        startDate: true,
        tenantId: true
      }
    });

    if (!employee || employee.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Check if gratuity account exists
    let gratuityAccount = await prisma.gratuityAccount.findUnique({
      where: { employeeId }
    });

    const baseSalary = employee.grossSalary || employee.salary || 0;
    const rate = accrualRate || 0.05; // Default 5% per month

    // Get total paid from existing account
    let totalPaid = 0;
    if (gratuityAccount) {
      const payments = await prisma.gratuityPayment.findMany({
        where: {
          gratuityAccountId: gratuityAccount.id
        }
      });
      totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    }

    if (gratuityAccount) {
      // Update existing account
      let totalAccrued = gratuityAccount.totalAccrued;
      let outstandingAmount = Math.max(0, totalAccrued - totalPaid);
      
      // Only recalculate if explicitly requested (for backdating purposes)
      if (recalculate) {
        // Calculate years of service for backdating
        const startDate = new Date(employee.startDate);
        const now = new Date();
        const yearsOfService = (now - startDate) / (1000 * 60 * 60 * 24 * 365.25);
        const monthlyAccrual = baseSalary * rate;
        totalAccrued = monthlyAccrual * Math.max(0, yearsOfService);
        outstandingAmount = Math.max(0, totalAccrued - totalPaid);
      }

      gratuityAccount = await prisma.gratuityAccount.update({
        where: { id: gratuityAccount.id },
        data: {
          accrualRate: rate,
          totalAccrued: recalculate ? totalAccrued : gratuityAccount.totalAccrued,
          totalPaid,
          outstandingAmount: recalculate ? outstandingAmount : gratuityAccount.outstandingAmount,
          lastCalculatedAt: recalculate ? new Date() : gratuityAccount.lastCalculatedAt
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
    } else {
      // Create new account - start with 0 accrued (will accumulate from payroll going forward)
      gratuityAccount = await prisma.gratuityAccount.create({
        data: {
          employeeId,
          tenantId: user.tenantId,
          accrualRate: rate,
          totalAccrued: 0, // Start fresh - no backdating
          totalPaid: 0,
          outstandingAmount: 0,
          lastCalculatedAt: null // Will be set when first payroll is processed
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
    }

    // Calculate monthly accrual for display purposes
    const monthlyAccrual = baseSalary * rate;

    return NextResponse.json({
      gratuityAccount,
      calculation: {
        baseSalary,
        monthlyAccrual,
        totalAccrued: gratuityAccount.totalAccrued,
        totalPaid: gratuityAccount.totalPaid,
        outstandingAmount: gratuityAccount.outstandingAmount
      }
    });

  } catch (error) {
    console.error('Error creating/updating gratuity account:', error);
    return NextResponse.json(
      { error: 'Failed to create/update gratuity account', details: error.message },
      { status: 500 }
    );
  }
}


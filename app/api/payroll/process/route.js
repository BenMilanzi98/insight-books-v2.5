// app/api/payroll/process/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { startOfMonth, endOfMonth } from '@/lib/dateUtils';

/**
 * GET - Fetch payrolls with filtering, sorting, and pagination
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'periodStart';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const search = searchParams.get('search');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      // Add tenant filter for multi-tenant security
      tenantId: user.tenantId,
    };
    
    // Add status filter if provided
    if (status) {
      where.status = status;
    }
    
    // Add employee filter if provided
    if (employeeId) {
      where.employeeId = employeeId;
    }
    
    // Add date range filters if provided
    if (fromDate) {
      where.periodStart = {
        ...where.periodStart,
        gte: new Date(fromDate),
      };
    }
    
    if (toDate) {
      where.periodEnd = {
        ...where.periodEnd,
        lte: new Date(toDate),
      };
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        {
          employee: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          notes: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.payroll.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch payrolls with employee information
    const payrolls = await prisma.payroll.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            position: true,
            department: true,
          },
        },
      },
    });
    
    // Return payrolls with pagination metadata
    return NextResponse.json({
      payrolls,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching payrolls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payrolls. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new payroll
 */
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.employeeId || !body.periodStart || !body.periodEnd || body.basicSalary === undefined) {
      return NextResponse.json(
        { error: 'Missing required payroll information' },
        { status: 400 }
      );
    }
    
    // Ensure the employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: body.employeeId },
    });
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Normalize to 1st and last day of month for correct monthly reporting
    const rawStart = new Date(body.periodStart);
    const rawEnd = new Date(body.periodEnd);
    const periodStart = startOfMonth(rawStart);
    const periodEnd = endOfMonth(rawEnd);

    // Prepare payroll data
    const payrollData = {
      employeeId: body.employeeId,
      periodStart,
      periodEnd,
      basicSalary: body.basicSalary,
      deductions: body.deductions || 0,
      additions: body.additions || 0,
      netPay: body.netPay || (body.basicSalary + (body.additions || 0) - (body.deductions || 0)),
      status: body.status || 'Draft', // String status as per schema
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
      notes: body.notes || '',
      tenantId: user.tenantId,
    };
    
    // Create the payroll record
    const newPayroll = await prisma.payroll.create({
      data: payrollData,
      include: {
        employee: true,
      },
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYROLL_CREATED',
        entityType: 'PAYROLL',
        entityId: newPayroll.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: employee.name,
          periodStart: payrollData.periodStart,
          periodEnd: payrollData.periodEnd,
          netPay: payrollData.netPay,
        }),
      },
    });
    
    // Return the created payroll
    return NextResponse.json(
      {
        message: 'Payroll created successfully',
        payroll: newPayroll,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating payroll:', error);
    return NextResponse.json(
      { error: `Failed to create payroll: ${error.message}` },
      { status: 500 }
    );
  }
}
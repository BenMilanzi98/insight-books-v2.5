// app/api/performance-goals/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - List performance goals with filters
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
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status && status !== 'All') {
      where.status = status;
    }

    if (category && category !== 'All') {
      where.category = category;
    }

    const [totalCount, goals] = await Promise.all([
      prisma.performanceGoal.count({ where }),
      prisma.performanceGoal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { targetDate: 'asc' },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              department: true,
              jobTitle: true
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      goals,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching performance goals:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    return NextResponse.json(
      { 
        error: 'Failed to fetch performance goals', 
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new performance goal
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

    const data = await request.json();
    const {
      employeeId,
      title,
      description,
      category,
      targetValue,
      targetUnit,
      startDate,
      targetDate
    } = data;

    if (!employeeId || !title || !startDate || !targetDate) {
      return NextResponse.json(
        { error: 'Employee ID, title, start date, and target date are required' },
        { status: 400 }
      );
    }

    // Verify employee belongs to tenant
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: user.tenantId,
        isActive: true
      }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found or inactive' },
        { status: 404 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const target = new Date(targetDate);

    if (start >= target) {
      return NextResponse.json(
        { error: 'Target date must be after start date' },
        { status: 400 }
      );
    }

    const goal = await prisma.performanceGoal.create({
      data: {
        employeeId,
        tenantId: user.tenantId,
        title,
        description: description || null,
        category: category || null,
        targetValue: targetValue ? parseFloat(targetValue) : null,
        targetUnit: targetUnit || null,
        startDate: start,
        targetDate: target,
        status: 'active',
        progress: 0
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
            jobTitle: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Performance goal created successfully',
      goal
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating performance goal:', error);
    return NextResponse.json(
      { error: 'Failed to create performance goal', details: error.message },
      { status: 500 }
    );
  }
}


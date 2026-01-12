// app/api/leave-policies/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Fetch leave policies with filtering and pagination
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
    const limit = parseInt(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';
    const leaveType = searchParams.get('leaveType');
    const isActive = searchParams.get('isActive');

    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (leaveType && leaveType !== 'All') {
      where.leaveType = leaveType;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const leavePolicies = await prisma.leavePolicy.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const totalCount = await prisma.leavePolicy.count({ where });

    return NextResponse.json({
      leavePolicies,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching leave policies:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    return NextResponse.json(
      { 
        error: 'Failed to fetch leave policies', 
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new leave policy
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

    // Validate required fields
    if (!data.name || !data.leaveType) {
      return NextResponse.json(
        { error: 'Name and leave type are required' },
        { status: 400 }
      );
    }

    // Check if policy with same name already exists
    const existingPolicy = await prisma.leavePolicy.findFirst({
      where: {
        name: data.name,
        tenantId: user.tenantId
      }
    });

    if (existingPolicy) {
      return NextResponse.json(
        { error: 'A leave policy with this name already exists' },
        { status: 400 }
      );
    }

    const leavePolicy = await prisma.leavePolicy.create({
      data: {
        name: data.name,
        description: data.description || null,
        leaveType: data.leaveType,
        maxDaysPerYear: data.maxDaysPerYear ? parseInt(data.maxDaysPerYear) : null,
        maxDaysPerRequest: data.maxDaysPerRequest ? parseInt(data.maxDaysPerRequest) : null,
        minDaysPerRequest: data.minDaysPerRequest ? parseInt(data.minDaysPerRequest) : null,
        requiresApproval: data.requiresApproval !== undefined ? data.requiresApproval : true,
        requiresDocumentation: data.requiresDocumentation !== undefined ? data.requiresDocumentation : false,
        isPaid: data.isPaid !== undefined ? data.isPaid : true,
        accrualRate: data.accrualRate ? parseFloat(data.accrualRate) : null,
        carryOverLimit: data.carryOverLimit ? parseInt(data.carryOverLimit) : null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        tenantId: user.tenantId
      }
    });

    return NextResponse.json({
      message: 'Leave policy created successfully',
      leavePolicy
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating leave policy:', error);
    return NextResponse.json(
      { error: 'Failed to create leave policy', details: error.message },
      { status: 500 }
    );
  }
}
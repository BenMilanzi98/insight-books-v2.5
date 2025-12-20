// app/api/attendance-policies/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Fetch attendance policies with filtering and pagination
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

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const attendancePolicies = await prisma.attendancePolicy.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            attendanceRecords: true
          }
        }
      }
    });

    const totalCount = await prisma.attendancePolicy.count({ where });

    return NextResponse.json({
      attendancePolicies,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching attendance policies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance policies', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new attendance policy
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
    if (!data.name || !data.workingHours) {
      return NextResponse.json(
        { error: 'Name and working hours are required' },
        { status: 400 }
      );
    }

    // Check if policy with same name already exists
    const existingPolicy = await prisma.attendancePolicy.findFirst({
      where: {
        name: data.name,
        tenantId: user.tenantId
      }
    });

    if (existingPolicy) {
      return NextResponse.json(
        { error: 'An attendance policy with this name already exists' },
        { status: 400 }
      );
    }

    const attendancePolicy = await prisma.attendancePolicy.create({
      data: {
        name: data.name,
        description: data.description || null,
        workingHours: data.workingHours,
        overtimeRules: data.overtimeRules || null,
        breakTime: data.breakTime || null,
        lateArrivalGrace: data.lateArrivalGrace ? parseInt(data.lateArrivalGrace) : null,
        earlyDepartureGrace: data.earlyDepartureGrace ? parseInt(data.earlyDepartureGrace) : null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        tenantId: user.tenantId
      }
    });

    return NextResponse.json({
      message: 'Attendance policy created successfully',
      attendancePolicy
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating attendance policy:', error);
    return NextResponse.json(
      { error: 'Failed to create attendance policy', details: error.message },
      { status: 500 }
    );
  }
}



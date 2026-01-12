// app/api/performance-feedback/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - List performance feedback with filters
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
    const feedbackType = searchParams.get('feedbackType');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (feedbackType && feedbackType !== 'All') {
      where.feedbackType = feedbackType;
    }

    if (status && status !== 'All') {
      where.status = status;
    }

    const [totalCount, feedback] = await Promise.all([
      prisma.performanceFeedback.count({ where }),
      prisma.performanceFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              department: true,
              jobTitle: true
            }
          },
          feedbackGiver: {
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
      feedback,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching performance feedback:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    return NextResponse.json(
      { 
        error: 'Failed to fetch performance feedback', 
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new performance feedback
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
      feedbackGiverId,
      feedbackType,
      reviewId,
      rating,
      strengths,
      areasForImprovement,
      suggestions,
      isAnonymous
    } = data;

    if (!employeeId || !feedbackGiverId) {
      return NextResponse.json(
        { error: 'Employee ID and feedback giver ID are required' },
        { status: 400 }
      );
    }

    // Verify both employees belong to tenant
    const [employee, feedbackGiver] = await Promise.all([
      prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: user.tenantId,
          isActive: true
        }
      }),
      prisma.employee.findFirst({
        where: {
          id: feedbackGiverId,
          tenantId: user.tenantId,
          isActive: true
        }
      })
    ]);

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found or inactive' },
        { status: 404 }
      );
    }

    if (!feedbackGiver) {
      return NextResponse.json(
        { error: 'Feedback giver not found or inactive' },
        { status: 404 }
      );
    }

    if (employeeId === feedbackGiverId) {
      return NextResponse.json(
        { error: 'Employee cannot give feedback to themselves' },
        { status: 400 }
      );
    }

    const feedback = await prisma.performanceFeedback.create({
      data: {
        employeeId,
        feedbackGiverId,
        tenantId: user.tenantId,
        feedbackType: feedbackType || 'peer',
        reviewId: reviewId || null,
        rating: rating ? parseFloat(rating) : null,
        strengths: strengths || null,
        areasForImprovement: areasForImprovement || null,
        suggestions: suggestions || null,
        isAnonymous: isAnonymous || false,
        status: 'submitted'
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
        },
        feedbackGiver: {
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
      message: 'Performance feedback submitted successfully',
      feedback
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating performance feedback:', error);
    return NextResponse.json(
      { error: 'Failed to create performance feedback', details: error.message },
      { status: 500 }
    );
  }
}


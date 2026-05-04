// app/api/performance-reviews/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

function parseRating(value, field = 'Rating') {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new Error(`${field} must be a number between 0 and 5`);
  }
  return rating;
}

/**
 * GET - List performance reviews with filters
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
    const reviewType = searchParams.get('reviewType');
    const year = searchParams.get('year');

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

    if (reviewType && reviewType !== 'All') {
      where.reviewType = reviewType;
    }

    if (year) {
      const yearNum = parseInt(year);
      if (!isNaN(yearNum)) {
        where.reviewDate = {
          gte: new Date(`${yearNum}-01-01`),
          lte: new Date(`${yearNum}-12-31T23:59:59.999Z`)
        };
      }
    }

    const [totalCount, reviews] = await Promise.all([
      prisma.performanceReview.count({ where }),
      prisma.performanceReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { reviewDate: 'desc' },
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
      reviews,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching performance reviews:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    return NextResponse.json(
      { 
        error: 'Failed to fetch performance reviews', 
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new performance review
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
      reviewPeriod,
      reviewType,
      reviewDate,
      overallRating,
      overallComments,
      strengths,
      areasForImprovement,
      reviewCriteria,
      goalIds
    } = data;

    if (!employeeId || !reviewPeriod || !reviewDate || overallRating === undefined || overallRating === null || overallRating === '') {
      return NextResponse.json(
        { error: 'Employee ID, review period, review date, and overall rating are required' },
        { status: 400 }
      );
    }

    let parsedOverallRating;
    try {
      parsedOverallRating = parseRating(overallRating, 'Overall rating');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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

    // Calculate goals achieved if goalIds provided
    let goalsAchieved = 0;
    let goalsTotal = 0;
    
    if (goalIds && Array.isArray(goalIds) && goalIds.length > 0) {
      const goals = await prisma.performanceGoal.findMany({
        where: {
          id: { in: goalIds },
          employeeId: employeeId,
          tenantId: user.tenantId
        }
      });
      
      goalsTotal = goals.length;
      goalsAchieved = goals.filter(g => g.status === 'completed').length;
    }

    let normalizedCriteria = [];
    if (reviewCriteria && Array.isArray(reviewCriteria) && reviewCriteria.length > 0) {
      try {
        normalizedCriteria = reviewCriteria
          .filter(c => c.criteriaName && c.rating !== undefined && c.rating !== null && c.rating !== '')
          .map(criteria => ({
            criteriaName: String(criteria.criteriaName).trim(),
            rating: parseRating(criteria.rating, `Rating for ${criteria.criteriaName}`),
            comments: criteria.comments || null,
            weight: Number.isFinite(Number(criteria.weight)) ? Number(criteria.weight) : 1.0
          }))
          .filter(criteria => criteria.criteriaName);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // Create review
    const review = await prisma.performanceReview.create({
      data: {
        employeeId,
        reviewerId: user.id,
        tenantId: user.tenantId,
        reviewPeriod,
        reviewType: reviewType || 'annual',
        reviewDate: new Date(reviewDate),
        overallRating: parsedOverallRating,
        overallComments: overallComments || null,
        strengths: strengths || null,
        areasForImprovement: areasForImprovement || null,
        goalsAchieved,
        goalsTotal,
        status: 'draft',
        reviewCriteria: normalizedCriteria.length > 0 ? { create: normalizedCriteria } : undefined
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
        reviewCriteria: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    // Link goals to review if provided
    if (goalIds && Array.isArray(goalIds) && goalIds.length > 0) {
      await prisma.performanceGoal.updateMany({
        where: {
          id: { in: goalIds },
          employeeId: employeeId,
          tenantId: user.tenantId
        },
        data: {
          reviewId: review.id
        }
      });
    }

    return NextResponse.json({
      message: 'Performance review created successfully',
      review
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating performance review:', error);
    return NextResponse.json(
      { error: 'Failed to create performance review', details: error.message },
      { status: 500 }
    );
  }
}


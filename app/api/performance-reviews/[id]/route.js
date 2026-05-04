// app/api/performance-reviews/[id]/route.js
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
 * GET - Get a specific performance review
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const review = await prisma.performanceReview.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
            jobTitle: true,
            email: true
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reviewCriteria: {
          orderBy: { createdAt: 'asc' }
        },
        goals: {
          orderBy: { targetDate: 'asc' }
        },
        acknowledger: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!review) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ review });

  } catch (error) {
    console.error('Error fetching performance review:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance review', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a performance review
 */
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const data = await request.json();

    // Check if review exists and belongs to tenant
    const existingReview = await prisma.performanceReview.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 }
      );
    }

    let normalizedCriteria = null;
    if (data.reviewCriteria) {
      if (!Array.isArray(data.reviewCriteria)) {
        return NextResponse.json({ error: 'Review criteria must be an array' }, { status: 400 });
      }
      try {
        normalizedCriteria = data.reviewCriteria
          .filter(criteria => criteria.criteriaName && criteria.rating !== undefined && criteria.rating !== null && criteria.rating !== '')
          .map(criteria => ({
            reviewId: id,
            criteriaName: String(criteria.criteriaName).trim(),
            rating: parseRating(criteria.rating, `Rating for ${criteria.criteriaName}`),
            comments: criteria.comments || null,
            weight: Number.isFinite(Number(criteria.weight)) ? Number(criteria.weight) : 1.0
          }))
          .filter(criteria => criteria.criteriaName);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Delete existing criteria
      await prisma.performanceReviewCriteria.deleteMany({
        where: { reviewId: id }
      });

      // Create new criteria
      if (normalizedCriteria.length > 0) {
        await prisma.performanceReviewCriteria.createMany({
          data: normalizedCriteria
        });
      }
    }

    // Calculate goals if goalIds provided
    let goalsAchieved = existingReview.goalsAchieved;
    let goalsTotal = existingReview.goalsTotal;
    
    if (data.goalIds && Array.isArray(data.goalIds)) {
      const goals = await prisma.performanceGoal.findMany({
        where: {
          id: { in: data.goalIds },
          employeeId: existingReview.employeeId,
          tenantId: user.tenantId
        }
      });
      
      goalsTotal = goals.length;
      goalsAchieved = goals.filter(g => g.status === 'completed').length;
    }

    let parsedOverallRating;
    if (data.overallRating !== undefined) {
      try {
        parsedOverallRating = parseRating(data.overallRating, 'Overall rating');
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // Update review
    const updatedReview = await prisma.performanceReview.update({
      where: { id },
      data: {
        reviewPeriod: data.reviewPeriod,
        reviewType: data.reviewType,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : undefined,
        overallRating: parsedOverallRating,
        overallComments: data.overallComments,
        strengths: data.strengths,
        areasForImprovement: data.areasForImprovement,
        goalsAchieved,
        goalsTotal,
        status: data.status || existingReview.status
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
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reviewCriteria: {
          orderBy: { createdAt: 'asc' }
        },
        goals: true
      }
    });

    // Update goal links if provided
    if (data.goalIds && Array.isArray(data.goalIds)) {
      // Remove review link from goals not in the list
      await prisma.performanceGoal.updateMany({
        where: {
          reviewId: id,
          id: { notIn: data.goalIds }
        },
        data: {
          reviewId: null
        }
      });

      // Add review link to goals in the list
      await prisma.performanceGoal.updateMany({
        where: {
          id: { in: data.goalIds },
          employeeId: existingReview.employeeId,
          tenantId: user.tenantId
        },
        data: {
          reviewId: id
        }
      });
    }

    return NextResponse.json({
      message: 'Performance review updated successfully',
      review: updatedReview
    });

  } catch (error) {
    console.error('Error updating performance review:', error);
    return NextResponse.json(
      { error: 'Failed to update performance review', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a performance review
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existingReview = await prisma.performanceReview.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 }
      );
    }

    // Delete review (cascade will delete criteria)
    await prisma.performanceReview.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Performance review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting performance review:', error);
    return NextResponse.json(
      { error: 'Failed to delete performance review', details: error.message },
      { status: 500 }
    );
  }
}


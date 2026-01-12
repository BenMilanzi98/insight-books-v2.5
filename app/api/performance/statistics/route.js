// app/api/performance/statistics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get performance statistics and history
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
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();

    const where = {
      tenantId: user.tenantId
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    // Get reviews for the year
    const reviewsWhere = {
      ...where,
      reviewDate: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`)
      }
    };

    const [reviews, goals, feedback] = await Promise.all([
      prisma.performanceReview.findMany({
        where: reviewsWhere,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeId: true
            }
          }
        }
      }),
      prisma.performanceGoal.findMany({
        where: {
          ...where,
          startDate: {
            lte: new Date(`${year}-12-31`)
          },
          targetDate: {
            gte: new Date(`${year}-01-01`)
          }
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
      }),
      prisma.performanceFeedback.findMany({
        where: {
          ...where,
          createdAt: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`)
          }
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
      })
    ]);

    // Calculate statistics
    const stats = {
      totalReviews: reviews.length,
      completedReviews: reviews.filter(r => r.status === 'completed').length,
      averageRating: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.overallRating || 0), 0) / reviews.length
        : 0,
      totalGoals: goals.length,
      activeGoals: goals.filter(g => g.status === 'active').length,
      completedGoals: goals.filter(g => g.status === 'completed').length,
      averageGoalProgress: goals.length > 0
        ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
        : 0,
      totalFeedback: feedback.length,
      averageFeedbackRating: feedback.length > 0
        ? feedback.filter(f => f.rating).reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.filter(f => f.rating).length
        : 0
    };

    // Group by employee if employeeId not specified
    let employeeStats = {};
    if (!employeeId) {
      const allEmployees = [...new Set([
        ...reviews.map(r => r.employeeId),
        ...goals.map(g => g.employeeId),
        ...feedback.map(f => f.employeeId)
      ])];

      for (const empId of allEmployees) {
        const empReviews = reviews.filter(r => r.employeeId === empId);
        const empGoals = goals.filter(g => g.employeeId === empId);
        const empFeedback = feedback.filter(f => f.employeeId === empId);

        employeeStats[empId] = {
          employee: empReviews[0]?.employee || empGoals[0]?.employee || empFeedback[0]?.employee,
          reviews: empReviews.length,
          averageRating: empReviews.length > 0
            ? empReviews.reduce((sum, r) => sum + (r.overallRating || 0), 0) / empReviews.length
            : 0,
          goals: empGoals.length,
          completedGoals: empGoals.filter(g => g.status === 'completed').length,
          averageGoalProgress: empGoals.length > 0
            ? empGoals.reduce((sum, g) => sum + g.progress, 0) / empGoals.length
            : 0,
          feedback: empFeedback.length
        };
      }
    }

    return NextResponse.json({
      statistics: stats,
      employeeStats: Object.values(employeeStats),
      year
    });

  } catch (error) {
    console.error('Error fetching performance statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance statistics', details: error.message },
      { status: 500 }
    );
  }
}


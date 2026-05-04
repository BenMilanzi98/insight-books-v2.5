// app/api/performance-feedback/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

function parseOptionalRating(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new Error('Rating must be a number between 0 and 5');
  }
  return rating;
}

/**
 * GET - Get a specific performance feedback
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

    const feedback = await prisma.performanceFeedback.findFirst({
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

    if (!feedback) {
      return NextResponse.json(
        { error: 'Performance feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ feedback });

  } catch (error) {
    console.error('Error fetching performance feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance feedback', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update performance feedback
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

    const existingFeedback = await prisma.performanceFeedback.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingFeedback) {
      return NextResponse.json(
        { error: 'Performance feedback not found' },
        { status: 404 }
      );
    }

    let parsedRating;
    try {
      parsedRating = parseOptionalRating(data.rating);
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const updatedFeedback = await prisma.performanceFeedback.update({
      where: { id },
      data: {
        rating: parsedRating,
        strengths: data.strengths,
        areasForImprovement: data.areasForImprovement,
        suggestions: data.suggestions,
        status: data.status || existingFeedback.status
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
      message: 'Performance feedback updated successfully',
      feedback: updatedFeedback
    });

  } catch (error) {
    console.error('Error updating performance feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update performance feedback', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete performance feedback
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

    const existingFeedback = await prisma.performanceFeedback.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingFeedback) {
      return NextResponse.json(
        { error: 'Performance feedback not found' },
        { status: 404 }
      );
    }

    await prisma.performanceFeedback.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Performance feedback deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting performance feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete performance feedback', details: error.message },
      { status: 500 }
    );
  }
}


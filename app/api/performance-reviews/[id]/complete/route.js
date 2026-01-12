// app/api/performance-reviews/[id]/complete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Mark a performance review as completed
 */
export async function POST(request, { params }) {
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
      }
    });

    if (!review) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 }
      );
    }

    const updatedReview = await prisma.performanceReview.update({
      where: { id },
      data: {
        status: 'completed'
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Performance review marked as completed',
      review: updatedReview
    });

  } catch (error) {
    console.error('Error completing performance review:', error);
    return NextResponse.json(
      { error: 'Failed to complete performance review', details: error.message },
      { status: 500 }
    );
  }
}


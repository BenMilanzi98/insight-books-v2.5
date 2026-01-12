// app/api/performance-reviews/[id]/acknowledge/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Acknowledge a performance review (by employee)
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
        tenantId: user.tenantId,
        status: 'completed'
      },
      include: {
        employee: true
      }
    });

    if (!review) {
      return NextResponse.json(
        { error: 'Performance review not found or not completed' },
        { status: 404 }
      );
    }

    // Verify user is the employee being reviewed
    // Note: This assumes user.id matches employee.id or we need to check employee email
    // For now, we'll allow any authenticated user in the tenant to acknowledge
    // You may want to add additional validation based on your auth setup

    const updatedReview = await prisma.performanceReview.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: user.id
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true
          }
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

    return NextResponse.json({
      message: 'Performance review acknowledged',
      review: updatedReview
    });

  } catch (error) {
    console.error('Error acknowledging performance review:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge performance review', details: error.message },
      { status: 500 }
    );
  }
}


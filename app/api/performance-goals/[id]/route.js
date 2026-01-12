// app/api/performance-goals/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get a specific performance goal
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

    const goal = await prisma.performanceGoal.findFirst({
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
        }
      }
    });

    if (!goal) {
      return NextResponse.json(
        { error: 'Performance goal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ goal });

  } catch (error) {
    console.error('Error fetching performance goal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance goal', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a performance goal
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

    // Check if goal exists
    const existingGoal = await prisma.performanceGoal.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingGoal) {
      return NextResponse.json(
        { error: 'Performance goal not found' },
        { status: 404 }
      );
    }

    // Calculate progress if currentValue and targetValue are provided
    let progress = existingGoal.progress;
    if (data.currentValue !== undefined && existingGoal.targetValue) {
      progress = Math.min(100, Math.max(0, (data.currentValue / existingGoal.targetValue) * 100));
    } else if (data.progress !== undefined) {
      progress = Math.min(100, Math.max(0, parseFloat(data.progress)));
    }

    // Auto-update status based on progress
    let status = data.status || existingGoal.status;
    if (progress >= 100 && status === 'active') {
      status = 'completed';
    }

    const updatedGoal = await prisma.performanceGoal.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        targetValue: data.targetValue !== undefined ? parseFloat(data.targetValue) : undefined,
        targetUnit: data.targetUnit,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        status,
        progress,
        currentValue: data.currentValue !== undefined ? parseFloat(data.currentValue) : undefined,
        notes: data.notes,
        completedAt: status === 'completed' && existingGoal.status !== 'completed' ? new Date() : existingGoal.completedAt
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
      message: 'Performance goal updated successfully',
      goal: updatedGoal
    });

  } catch (error) {
    console.error('Error updating performance goal:', error);
    return NextResponse.json(
      { error: 'Failed to update performance goal', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a performance goal
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

    const existingGoal = await prisma.performanceGoal.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingGoal) {
      return NextResponse.json(
        { error: 'Performance goal not found' },
        { status: 404 }
      );
    }

    await prisma.performanceGoal.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Performance goal deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting performance goal:', error);
    return NextResponse.json(
      { error: 'Failed to delete performance goal', details: error.message },
      { status: 500 }
    );
  }
}


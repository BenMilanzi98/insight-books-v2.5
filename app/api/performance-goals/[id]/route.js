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

    const nextTargetValue =
      data.targetValue !== undefined ? Number(data.targetValue) : existingGoal.targetValue;
    if (data.targetValue !== undefined && (!Number.isFinite(nextTargetValue) || nextTargetValue < 0)) {
      return NextResponse.json(
        { error: 'Target value must be a non-negative number' },
        { status: 400 }
      );
    }

    const nextCurrentValue =
      data.currentValue !== undefined ? Number(data.currentValue) : existingGoal.currentValue;
    if (data.currentValue !== undefined && !Number.isFinite(nextCurrentValue)) {
      return NextResponse.json(
        { error: 'Current value must be a valid number' },
        { status: 400 }
      );
    }

    const nextStartDate = data.startDate ? new Date(data.startDate) : existingGoal.startDate;
    const nextTargetDate = data.targetDate ? new Date(data.targetDate) : existingGoal.targetDate;
    if (Number.isNaN(nextStartDate.getTime()) || Number.isNaN(nextTargetDate.getTime())) {
      return NextResponse.json(
        { error: 'Start date and target date must be valid dates' },
        { status: 400 }
      );
    }
    if (nextStartDate >= nextTargetDate) {
      return NextResponse.json(
        { error: 'Target date must be after start date' },
        { status: 400 }
      );
    }

    // Calculate progress if currentValue and targetValue are provided
    let progress = existingGoal.progress;
    if (data.currentValue !== undefined && nextTargetValue) {
      progress = Math.min(100, Math.max(0, (nextCurrentValue / nextTargetValue) * 100));
    } else if (data.progress !== undefined) {
      const parsedProgress = Number(data.progress);
      if (!Number.isFinite(parsedProgress)) {
        return NextResponse.json(
          { error: 'Progress must be a valid number' },
          { status: 400 }
        );
      }
      progress = Math.min(100, Math.max(0, parsedProgress));
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
        targetValue: data.targetValue !== undefined ? nextTargetValue : undefined,
        targetUnit: data.targetUnit,
        startDate: data.startDate ? nextStartDate : undefined,
        targetDate: data.targetDate ? nextTargetDate : undefined,
        status,
        progress,
        currentValue: data.currentValue !== undefined ? nextCurrentValue : undefined,
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


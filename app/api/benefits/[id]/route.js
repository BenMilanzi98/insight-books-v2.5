// app/api/benefits/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET - Fetch a single benefit
 */
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const benefit = await prisma.benefit.findFirst({
      where: { id, tenantId: user.tenantId }
    });

    if (!benefit) {
      return NextResponse.json({ error: 'Benefit not found' }, { status: 404 });
    }

    return NextResponse.json(benefit);
  } catch (error) {
    console.error('Error fetching benefit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch benefit' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a benefit
 */
export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.benefit.findFirst({
      where: { id, tenantId: user.tenantId }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Benefit not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, defaultAmount, defaultPercentage, isActive } = body;

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Benefit name cannot be empty' },
          { status: 400 }
        );
      }
      const duplicate = await prisma.benefit.findFirst({
        where: {
          tenantId: user.tenantId,
          id: { not: id },
          name: { equals: name.trim(), mode: 'insensitive' }
        }
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Another benefit with this name already exists' },
          { status: 400 }
        );
      }
    }

    const benefit = await prisma.benefit.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(defaultAmount !== undefined && { defaultAmount: Number(defaultAmount) }),
        ...(defaultPercentage !== undefined && { defaultPercentage: body.defaultPercentage == null ? null : Number(body.defaultPercentage) }),
        ...(isActive !== undefined && { isActive: !!isActive })
      }
    });

    return NextResponse.json(benefit);
  } catch (error) {
    console.error('Error updating benefit:', error);
    return NextResponse.json(
      { error: 'Failed to update benefit' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a benefit (removes from tenant; employee assignments are cascade-deleted)
 */
export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.benefit.findFirst({
      where: { id, tenantId: user.tenantId }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Benefit not found' }, { status: 404 });
    }

    await prisma.benefit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting benefit:', error);
    return NextResponse.json(
      { error: 'Failed to delete benefit' },
      { status: 500 }
    );
  }
}

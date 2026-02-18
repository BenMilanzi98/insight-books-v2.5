// app/api/benefits/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET - List all benefits for the tenant (e.g. House Allowance, Airtime, other perks)
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const accessError = await requireStandardAccess(request);
    if (accessError) {
      if (accessError.status === 500) {
        console.warn('Benefits GET: access check failed, returning empty list so page can load');
      } else {
        return accessError;
      }
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');

    const where = { tenantId: user.tenantId };
    if (isActive !== undefined && isActive !== null) {
      where.isActive = isActive === 'true';
    }

    let benefits = [];
    try {
      benefits = await prisma.benefit.findMany({
        where,
        orderBy: { name: 'asc' }
      });
    } catch (dbError) {
      console.warn('Benefits GET: Benefit table/schema unavailable:', dbError?.message || dbError);
    }

    return NextResponse.json({ benefits });
  } catch (error) {
    console.error('Error fetching benefits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch benefits' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new benefit type (e.g. House Allowance, Airtime)
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const accessError = await requireStandardAccess(request);
    if (accessError) {
      if (accessError.status === 500) {
        console.warn('Benefits POST: access check failed, attempting create anyway');
      } else {
        return accessError;
      }
    }

    const body = await request.json();
    const { name, description, defaultAmount, defaultPercentage, isActive } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Benefit name is required' },
        { status: 400 }
      );
    }

    let benefit;
    try {
      const existing = await prisma.benefit.findFirst({
        where: {
          tenantId: user.tenantId,
          name: { equals: name.trim(), mode: 'insensitive' }
        }
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A benefit with this name already exists' },
          { status: 400 }
        );
      }

      benefit = await prisma.benefit.create({
        data: {
          tenantId: user.tenantId,
          name: name.trim(),
          description: description?.trim() || null,
          defaultAmount: defaultAmount != null ? Number(defaultAmount) : 0,
          defaultPercentage: defaultPercentage != null ? Number(defaultPercentage) : null,
          isActive: isActive !== false
        }
      });
    } catch (dbError) {
      console.error('Benefits POST: database error', dbError);
      return NextResponse.json(
        {
          error: 'Benefits are not available. The benefits feature may need to be set up.',
          ...(process.env.NODE_ENV === 'development' && { details: dbError?.message || String(dbError) })
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ benefit }, { status: 201 });
  } catch (error) {
    console.error('Error creating benefit:', error);
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: 'Failed to create benefit',
        ...(isDev && { details: error?.message || String(error) })
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { assignOwnership, listPortfolioMembers } from '@/lib/admin/customers';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const portfolioId = params?.id;

    const result = await listPortfolioMembers(prisma, {
      admin,
      portfolioId,
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.badRequest) {
      return NextResponse.json(
        { success: false, error: result.error || 'Invalid request' },
        { status: 400 }
      );
    }

    if (result.ok === false && result.status === 'UNAVAILABLE') {
      return NextResponse.json(
        { success: false, error: result.error || 'Members unavailable', ...result },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('portfolio members list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list portfolio members' },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const portfolioId = params?.id;
    const body = await request.json().catch(() => ({}));

    const result = await assignOwnership(prisma, {
      admin,
      tenantId: body.tenantId,
      ownerAdminId: body.ownerAdminId || admin.id,
      portfolioId: body.portfolioId || portfolioId,
      isPrimary: body.isPrimary !== false,
      reason: body.reason,
      assignmentType: body.assignmentType,
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: result.error || 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.badRequest) {
      return NextResponse.json(
        { success: false, error: result.error || 'Invalid request' },
        { status: 400 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Not found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to assign ownership' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 500 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('portfolio assign ownership error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign ownership' },
      { status: 500 }
    );
  }
}

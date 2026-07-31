import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createPortfolio, listPortfolios } from '@/lib/admin/customers';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === '1';

    const result = await listPortfolios(prisma, { admin, includeArchived });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.ok === false && result.status === 'UNAVAILABLE') {
      return NextResponse.json(
        { success: false, error: result.error || 'Portfolios unavailable', ...result },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer portfolios list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list portfolios' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await createPortfolio(prisma, {
      admin,
      code: body.code,
      name: body.name,
      description: body.description,
      type: body.type,
      ownerAdminId: body.ownerAdminId,
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

    if (result.conflict) {
      return NextResponse.json(
        { success: false, error: result.error || 'Portfolio code already exists' },
        { status: 409 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create portfolio' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 500 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('customer portfolios create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create portfolio' },
      { status: 500 }
    );
  }
}

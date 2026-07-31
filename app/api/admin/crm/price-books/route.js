import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  activatePriceBookVersion,
  approvePriceBookVersion,
  createPriceBook,
  listPriceBooks,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await listPriceBooks(prisma, { admin, actorContext: { admin } });
    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list price books' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, priceBooks: result.priceBooks, domain: result.domain });
  } catch (error) {
    console.error('CRM price books list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM price books' },
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
    const action = String(body.action || 'create').trim().toLowerCase();

    let result;
    if (action === 'approve') {
      result = await approvePriceBookVersion(prisma, {
        admin,
        actorContext: { admin },
        priceBookVersionId: body.priceBookVersionId,
      });
    } else if (action === 'activate') {
      result = await activatePriceBookVersion(prisma, {
        admin,
        actorContext: { admin },
        priceBookVersionId: body.priceBookVersionId,
      });
    } else {
      result = await createPriceBook(prisma, {
        admin,
        actorContext: { admin },
        name: body.name,
        bookType: body.bookType,
        currency: body.currency,
        entries: body.entries,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Price book action failed', reason: result.reason },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    console.error('CRM price books action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed CRM price book action' },
      { status: 500 }
    );
  }
}

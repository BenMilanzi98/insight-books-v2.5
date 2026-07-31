import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  upsertAdoptionChampion,
  listAdoptionChampions,
  hasCustomerAdoptionChampionModel,
} from '@/lib/admin/customerSuccess/adoption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasCustomerAdoptionChampionModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_champion_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId') || searchParams.get('adoptionPlanId');
    const result = await listAdoptionChampions(prisma, {
      admin,
      actorContext: { admin },
      planId,
    });
    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption champions list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list adoption champions' },
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
    // Never accept engagementScore from HTTP
    const result = await upsertAdoptionChampion(prisma, {
      admin,
      actorContext: { admin },
      planId: body.planId || body.adoptionPlanId,
      contactId: body.contactId,
      role: body.role,
      enablementStatus: body.enablementStatus,
      lastEvidenceRef: body.lastEvidenceRef,
      idempotencyKey: body.idempotencyKey,
    });

    if (result?.forbidden) {
      return NextResponse.json(
        { success: false, error: result.reason || result.error || 'Forbidden' },
        { status: 403 }
      );
    }
    if (!result?.ok) {
      return NextResponse.json({ success: false, ...result }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption champions upsert error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upsert adoption champion' },
      { status: 500 }
    );
  }
}

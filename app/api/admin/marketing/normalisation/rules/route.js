import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listNormalisationRules, createNormalisationRule } from '@/lib/admin/marketing';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listNormalisationRules(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list rules' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Marketing normalisation rules list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list normalisation rules' },
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
    const result = await createNormalisationRule(prisma, {
      admin,
      ruleCode: body.ruleCode,
      rawSourcePattern: body.rawSourcePattern,
      rawMediumPattern: body.rawMediumPattern,
      channelCode: body.channelCode,
      sourceCode: body.sourceCode,
      mediumCode: body.mediumCode,
      priority: body.priority,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create rule' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('Marketing normalisation rule create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create normalisation rule' },
      { status: 500 }
    );
  }
}

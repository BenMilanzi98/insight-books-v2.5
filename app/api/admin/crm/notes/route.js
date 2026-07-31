import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createNote, listNotes } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listNotes(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || 'LEAD',
      subjectId: searchParams.get('subjectId') || searchParams.get('leadId') || '',
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list notes' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM notes list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM notes' },
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
    const result = await createNote(prisma, {
      admin,
      subjectType: body.subjectType || 'LEAD',
      subjectId: body.subjectId || body.leadId,
      body: body.body,
      visibility: body.visibility,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create note' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, note: result.note }, { status: 201 });
  } catch (error) {
    console.error('CRM notes create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM note' },
      { status: 500 }
    );
  }
}

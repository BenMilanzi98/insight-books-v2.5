import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createContact, listContacts } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listContacts(prisma, {
      admin,
      accountId: searchParams.get('accountId') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM contacts list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM contacts' },
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
    const result = await createContact(prisma, {
      admin,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      role: body.role,
      accountId: body.accountId || null,
      ownerAdminId: body.ownerAdminId || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create contact', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, contact: result.contact, contactNumber: result.contact?.contactNumber },
      { status: 201 }
    );
  } catch (error) {
    console.error('CRM contacts create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM contact' },
      { status: 500 }
    );
  }
}

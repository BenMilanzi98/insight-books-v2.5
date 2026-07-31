import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getCommercialDomainContract, hasCrmCommercialRecipientModel } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasCrmCommercialRecipientModel(prisma)) {
      return NextResponse.json(
        { success: false, error: 'crm_commercial_recipient_model_unavailable' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId') || undefined;
    const where = documentId ? { documentId } : {};
    const rows = await prisma.crmCommercialRecipient.findMany({ where });
    return NextResponse.json({
      success: true,
      recipients: rows,
      domain: getCommercialDomainContract(),
    });
  } catch (error) {
    console.error('CRM commercial recipients list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list recipients' },
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
    if (!hasCrmCommercialRecipientModel(prisma)) {
      return NextResponse.json(
        { success: false, error: 'crm_commercial_recipient_model_unavailable' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const row = await prisma.crmCommercialRecipient.create({
      data: {
        documentId: body.documentId || null,
        email: body.email != null ? String(body.email).trim().slice(0, 320) : null,
        name: body.name != null ? String(body.name).trim().slice(0, 200) : null,
        authorityRole: body.authorityRole
          ? String(body.authorityRole).trim().toUpperCase().slice(0, 64)
          : 'SIGNATORY',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json(
      { success: true, recipient: row, domain: getCommercialDomainContract() },
      { status: 201 }
    );
  } catch (error) {
    console.error('CRM commercial recipient create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create recipient' },
      { status: 500 }
    );
  }
}

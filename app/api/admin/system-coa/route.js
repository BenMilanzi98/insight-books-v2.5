import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  buildDefaultSystemCoaPayload,
  validateSystemCoaPayload,
} from '@/lib/systemCoaPayload';

const DEFAULT_ID = 'default';

async function ensureDefinitionRow() {
  let row = await prisma.systemCoaDefinition.findUnique({
    where: { id: DEFAULT_ID },
  });
  if (!row) {
    const payload = buildDefaultSystemCoaPayload();
    row = await prisma.systemCoaDefinition.create({
      data: {
        id: DEFAULT_ID,
        payload,
      },
    });
  }
  return row;
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const row = await ensureDefinitionRow();
    return NextResponse.json({
      id: row.id,
      payload: row.payload,
      updatedAt: row.updatedAt,
      updatedByEmail: row.updatedByEmail,
    });
  } catch (error) {
    console.error('admin system-coa GET:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load system chart of accounts' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const raw = body.payload ?? body;
    const validated = validateSystemCoaPayload(raw);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const row = await prisma.systemCoaDefinition.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        payload: validated.payload,
        updatedByEmail: admin.email || null,
      },
      update: {
        payload: validated.payload,
        updatedByEmail: admin.email || null,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'UPDATE_SYSTEM_COA_DEFINITION',
        entityType: 'SystemCoaDefinition',
        entityId: row.id,
        details: JSON.stringify({ accountCount: validated.payload.accounts?.length || 0 }),
      },
    });

    return NextResponse.json({
      id: row.id,
      payload: row.payload,
      updatedAt: row.updatedAt,
      updatedByEmail: row.updatedByEmail,
    });
  } catch (error) {
    console.error('admin system-coa PUT:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save system chart of accounts' },
      { status: 500 }
    );
  }
}

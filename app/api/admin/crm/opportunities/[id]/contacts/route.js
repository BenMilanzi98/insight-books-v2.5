import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listOpportunityContactRoles,
  upsertOpportunityContactRole,
  listOpportunityContactRoleHistory,
} from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = params?.id;
    const { searchParams } = new URL(request.url);
    const wantHistory = searchParams.get('history') === '1';

    if (wantHistory) {
      const result = await listOpportunityContactRoleHistory(prisma, {
        admin,
        opportunityId: id,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      if (result.notFound) {
        return NextResponse.json(
          { success: false, error: 'Opportunity not found' },
          { status: 404 }
        );
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to list contact role history' },
          { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
        );
      }
      return NextResponse.json({ success: true, history: result.history });
    }

    const result = await listOpportunityContactRoles(prisma, {
      admin,
      opportunityId: id,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list contact roles' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      roles: result.roles,
      platformPermissionGrant: false,
    });
  } catch (error) {
    console.error('CRM opportunity contacts GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list opportunity contact roles' },
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
    const id = params?.id;
    const body = await request.json().catch(() => ({}));

    const result = await upsertOpportunityContactRole(prisma, {
      admin,
      opportunityId: id,
      contactId: body.contactId,
      role: body.role,
      note: body.note,
      reason: body.reason,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to upsert contact role', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      role: result.role,
      idempotent: Boolean(result.idempotent),
      platformPermissionGrant: false,
    });
  } catch (error) {
    console.error('CRM opportunity contacts POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upsert opportunity contact role' },
      { status: 500 }
    );
  }
}

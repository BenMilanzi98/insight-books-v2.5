import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  approveChecklistVersion,
  createChecklistVersion,
  executeDemoChecklist,
  listChecklistVersions,
  pinChecklistToDemo,
  requestChecklistApproval,
  updateChecklistVersion,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listChecklistVersions(prisma, {
      admin,
      code: searchParams.get('code') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo checklists list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list demo checklists' },
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

    if (action === 'update') {
      result = await updateChecklistVersion(prisma, {
        admin,
        checklistId: body.checklistId || body.id,
        patch: body.patch || body,
      });
    } else if (action === 'request-approval') {
      result = await requestChecklistApproval(prisma, {
        admin,
        checklistId: body.checklistId || body.id,
      });
    } else if (action === 'approve') {
      result = await approveChecklistVersion(prisma, {
        admin,
        checklistId: body.checklistId || body.id,
      });
    } else if (action === 'pin') {
      result = await pinChecklistToDemo(prisma, {
        admin,
        demoId: body.demoId,
        checklistId: body.checklistId || body.id,
      });
    } else if (action === 'execute') {
      result = await executeDemoChecklist(prisma, {
        admin,
        demoId: body.demoId,
        checklistId: body.checklistId,
        results: body.results,
        idempotencyKey: body.idempotencyKey,
      });
    } else {
      result = await createChecklistVersion(prisma, {
        admin,
        code: body.code,
        name: body.name,
        itemsJson: body.itemsJson,
        version: body.version,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
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
        { success: false, error: result.error || 'Failed checklist action' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo checklists action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed demo checklist action' },
      { status: 500 }
    );
  }
}

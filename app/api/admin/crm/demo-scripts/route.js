import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  approveScriptVersion,
  createScriptVersion,
  listScriptVersions,
  projectScriptForSurface,
  requestScriptApproval,
  updateScriptVersion,
  CRM_DEMO_PROJECTION_SURFACE,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const surface = searchParams.get('surface');
    const result = await listScriptVersions(prisma, {
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

    // Customer / invitation surfaces re-project fail-closed (RESTRICTED never included).
    if (
      surface &&
      (surface.toUpperCase() === CRM_DEMO_PROJECTION_SURFACE.CUSTOMER ||
        surface.toUpperCase() === CRM_DEMO_PROJECTION_SURFACE.INVITATION)
    ) {
      const projected = (result.items || [])
        .map((s) => projectScriptForSurface(s, { surface: surface.toUpperCase() }))
        .filter((p) => p.allowed && p.script)
        .map((p) => p.script);
      return NextResponse.json({
        success: true,
        items: projected,
        meta: {
          ...(result.meta || {}),
          surface: surface.toUpperCase(),
          restrictedOmitted: true,
        },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo scripts list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list demo scripts' },
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
      result = await updateScriptVersion(prisma, {
        admin,
        scriptId: body.scriptId || body.id,
        patch: body.patch || body,
      });
    } else if (action === 'request-approval') {
      result = await requestScriptApproval(prisma, {
        admin,
        scriptId: body.scriptId || body.id,
      });
    } else if (action === 'approve') {
      result = await approveScriptVersion(prisma, {
        admin,
        scriptId: body.scriptId || body.id,
      });
    } else {
      result = await createScriptVersion(prisma, {
        admin,
        code: body.code,
        name: body.name,
        classification: body.classification,
        bodyInternal: body.bodyInternal,
        bodyCustomerSafe: body.bodyCustomerSafe,
        labelsJson: body.labelsJson,
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
        { success: false, error: result.error || 'Failed script action' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo scripts action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed demo script action' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listActivityTemplates,
  createActivityTemplateVersion,
  updateActivityTemplate,
  getActiveActivityTemplate,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeCode = searchParams.get('activeCode');
    if (activeCode) {
      const result = await getActiveActivityTemplate(prisma, {
        admin,
        code: activeCode,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await listActivityTemplates(prisma, {
      admin,
      code: searchParams.get('code') || undefined,
      kind: searchParams.get('kind') || undefined,
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
    console.error('CRM activity templates list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list activity templates' },
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

    if (action === 'update') {
      const result = await updateActivityTemplate(prisma, {
        admin,
        templateId: body.templateId || body.id,
        patch: body.patch || body,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges', reason: result.reason },
          { status: 403 }
        );
      }
      if (result.notFound) {
        return NextResponse.json({ success: false, error: result.error }, { status: 404 });
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'update_failed', ...result },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await createActivityTemplateVersion(prisma, {
      admin,
      code: body.code,
      kind: body.kind,
      name: body.name,
      titleTemplate: body.titleTemplate,
      bodyTemplate: body.bodyTemplate,
      defaultsJson: body.defaultsJson,
      status: body.status,
      version: body.version,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'create_failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM activity templates mutate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mutate activity template' },
      { status: 500 }
    );
  }
}

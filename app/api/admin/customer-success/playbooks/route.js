import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listPlaybooks,
  createPlaybook,
  executePlaybook,
  listPlaybookExecutions,
} from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = String(searchParams.get('view') || 'definitions').toLowerCase();

    const result =
      view === 'executions'
        ? await listPlaybookExecutions(prisma, {
            admin,
            tenantId: searchParams.get('tenantId') || undefined,
            playbookId: searchParams.get('playbookId') || undefined,
            limit: searchParams.get('limit') || '50',
          })
        : await listPlaybooks(prisma, {
            admin,
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
    console.error('CS playbooks list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list playbooks' },
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
    const mode = String(body.mode || 'create').toLowerCase();

    const result =
      mode === 'execute'
        ? await executePlaybook(prisma, {
            admin,
            playbookId: body.playbookId,
            tenantId: body.tenantId,
            caseId: body.caseId || null,
          })
        : await createPlaybook(prisma, {
            admin,
            key: body.key,
            name: body.name,
            version: body.version,
            description: body.description,
            steps: body.steps,
            status: body.status,
          });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Playbook action failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : result.notFound ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, ...result },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error('CS playbooks action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process playbook action' },
      { status: 500 }
    );
  }
}

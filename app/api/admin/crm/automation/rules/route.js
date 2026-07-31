import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listAutomationRules,
  createAutomationRule,
  requestAutomationApproval,
  approveAutomationRule,
  executeAutomationRule,
} from '@/lib/admin/crm';

const LIFECYCLE = new Set(['create', 'request-approval', 'approve', 'execute']);

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listAutomationRules(prisma, {
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
    console.error('CRM automation rules list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list automation rules' },
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
    const lifecycle = String(body.lifecycle || body.op || 'create')
      .trim()
      .toLowerCase();

    if (lifecycle === 'request-approval') {
      const result = await requestAutomationApproval(prisma, {
        admin,
        ruleId: body.ruleId || body.id,
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
          { success: false, error: result.error || 'request_failed', ...result },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (lifecycle === 'approve') {
      const result = await approveAutomationRule(prisma, {
        admin,
        ruleId: body.ruleId || body.id,
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
          { success: false, error: result.error || 'approve_failed', ...result },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (lifecycle === 'execute') {
      const result = await executeAutomationRule(prisma, {
        admin,
        ruleId: body.ruleId || body.id,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        occurrenceKey: body.occurrenceKey,
        stageCode: body.stageCode,
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
          { success: false, error: result.error || 'execute_failed', ...result },
          { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (!LIFECYCLE.has(lifecycle)) {
      return NextResponse.json(
        { success: false, error: 'invalid_lifecycle', allowed: [...LIFECYCLE] },
        { status: 400 }
      );
    }

    const result = await createAutomationRule(prisma, {
      admin,
      code: body.code,
      name: body.name,
      trigger: body.trigger,
      action: body.ruleAction || body.automationAction || body.action,
      configJson: body.configJson,
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
    console.error('CRM automation rules mutate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mutate automation rule' },
      { status: 500 }
    );
  }
}

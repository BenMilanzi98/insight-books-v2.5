import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listCases,
  createManualCase,
  openCaseFromSignal,
  openCaseFromHealth,
} from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listCases(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      tenantId: searchParams.get('tenantId') || undefined,
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
    console.error('CS cases list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list cases' },
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
    const mode = String(body.mode || body.source || 'manual').toLowerCase();

    let result;
    if (mode === 'signal') {
      result = await openCaseFromSignal(prisma, {
        admin,
        tenantId: body.tenantId,
        signalCode: body.signalCode || body.code,
        signalId: body.signalId || null,
        portfolioId: body.portfolioId || null,
      });
    } else if (mode === 'health') {
      result = await openCaseFromHealth(prisma, {
        admin,
        tenantId: body.tenantId,
        band: body.band,
        snapshotId: body.snapshotId,
        definitionVersion: body.definitionVersion,
        portfolioId: body.portfolioId || null,
      });
    } else {
      result = await createManualCase(prisma, {
        admin,
        tenantId: body.tenantId,
        title: body.title,
        summary: body.summary,
        priority: body.priority,
        severity: body.severity,
        portfolioId: body.portfolioId || null,
        idempotencyKey: body.idempotencyKey,
        payload: body.payload,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || result.reason || 'Failed to open case', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error('CS cases create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create case' },
      { status: 500 }
    );
  }
}

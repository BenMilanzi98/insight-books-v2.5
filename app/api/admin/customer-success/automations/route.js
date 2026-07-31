import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { runCsAutomation } from '@/lib/admin/customerSuccess';

/**
 * Deterministic CS automations (signal/health → case). Idempotent.
 * POST body: { kind: 'signal'|'signals'|'health', tenantId, ... }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await runCsAutomation(prisma, {
      admin,
      kind: body.kind || body.type,
      tenantId: body.tenantId,
      signalCode: body.signalCode || body.code,
      signalId: body.signalId,
      signals: body.signals,
      band: body.band,
      snapshotId: body.snapshotId,
      definitionVersion: body.definitionVersion,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok && !result.skipped) {
      return NextResponse.json(
        { success: false, error: result.error || result.reason || 'Automation failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS automation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run automation' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    kinds: ['signal', 'signals', 'health'],
    note: 'POST to run deterministic idempotent automations. Never mutates source facts.',
  });
}

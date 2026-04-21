import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { mergeWizardStep, SETUP_WIZARD_STEP_DEFS } from '@/lib/setupWizardService';

const STEP_IDS = new Set(SETUP_WIZARD_STEP_DEFS.map((s) => s.id));

/**
 * POST body:
 * - { action: 'complete' | 'skip', stepId: string }
 * - { action: 'snooze', days?: number } (default 7)
 * - { action: 'complete', stepId: 'fiscalYear', fiscalYearStartMonth: 1-12 }
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { ownerUserId: true },
    });
    if (tenant?.ownerUserId !== user.id) {
      return NextResponse.json(
        { error: 'Only the business owner can update setup wizard progress.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'snooze') {
      const days = Math.min(30, Math.max(1, parseInt(String(body.days || '7'), 10) || 7));
      const until = new Date();
      until.setDate(until.getDate() + days);
      await prisma.tenantSettings.upsert({
        where: { tenantId: user.tenantId },
        create: {
          tenantId: user.tenantId,
          enabledModules: [],
          setupReminderSnoozedUntil: until,
        },
        update: { setupReminderSnoozedUntil: until },
      });
      return NextResponse.json({ success: true, setupReminderSnoozedUntil: until.toISOString() });
    }

    if (action === 'clearSnooze') {
      await prisma.tenantSettings.updateMany({
        where: { tenantId: user.tenantId },
        data: { setupReminderSnoozedUntil: null },
      });
      return NextResponse.json({ success: true });
    }

    if (action !== 'complete' && action !== 'skip') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const stepId = body.stepId;
    if (!stepId || !STEP_IDS.has(stepId)) {
      return NextResponse.json({ error: 'Invalid or missing stepId' }, { status: 400 });
    }

    if (stepId === 'fiscalYear' && action === 'complete') {
      const m = parseInt(String(body.fiscalYearStartMonth ?? ''), 10);
      if (!Number.isFinite(m) || m < 1 || m > 12) {
        return NextResponse.json(
          { error: 'fiscalYearStartMonth must be between 1 and 12' },
          { status: 400 }
        );
      }
      const existing = await prisma.tenantSettings.findUnique({
        where: { tenantId: user.tenantId },
        select: { setupWizardState: true },
      });
      const nextState = mergeWizardStep(existing?.setupWizardState, 'complete', 'fiscalYear');
      await prisma.tenantSettings.upsert({
        where: { tenantId: user.tenantId },
        create: {
          tenantId: user.tenantId,
          enabledModules: [],
          fiscalYearStartMonth: m,
          setupWizardState: nextState,
        },
        update: {
          fiscalYearStartMonth: m,
          setupWizardState: nextState,
        },
      });
      return NextResponse.json({ success: true, setupWizardState: nextState, fiscalYearStartMonth: m });
    }

    const existing = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
      select: { setupWizardState: true },
    });
    const nextState = mergeWizardStep(existing?.setupWizardState, action === 'complete' ? 'complete' : 'skip', stepId);

    await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        enabledModules: [],
        setupWizardState: nextState,
      },
      update: { setupWizardState: nextState },
    });

    return NextResponse.json({ success: true, setupWizardState: nextState });
  } catch (e) {
    console.error('setup-wizard step:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to update setup wizard' },
      { status: 500 }
    );
  }
}

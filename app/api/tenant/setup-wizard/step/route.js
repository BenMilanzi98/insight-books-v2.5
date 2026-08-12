import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { mergeWizardStep, mergeSkipAllSteps, SETUP_WIZARD_STEP_DEFS } from '@/lib/setupWizardService';

const STEP_IDS = new Set(SETUP_WIZARD_STEP_DEFS.map((s) => s.id));

/**
 * POST body:
 * - { action: 'complete' | 'skip', stepId: string }
 * - { action: 'skipAll', stepIds?: string[] } — skip all listed (or all wizard steps)
 * - { action: 'snooze', days?: number } (default 7)
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

    if (action === 'skipAll') {
      const requested = Array.isArray(body.stepIds) ? body.stepIds.map(String) : SETUP_WIZARD_STEP_DEFS.map((s) => s.id);
      const stepIds = requested.filter((id) => STEP_IDS.has(id));
      const existing = await prisma.tenantSettings.findUnique({
        where: { tenantId: user.tenantId },
        select: { setupWizardState: true },
      });
      const nextState = mergeSkipAllSteps(existing?.setupWizardState, stepIds);
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
    }

    if (action !== 'complete' && action !== 'skip') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const aliases = { clients: 'customers', openingStock: 'inventory', openingBalancesReview: 'openingBalances' };
    const stepId = aliases[body.stepId] || body.stepId;
    if (!stepId || !STEP_IDS.has(stepId)) {
      return NextResponse.json({ error: 'Invalid or missing stepId' }, { status: 400 });
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

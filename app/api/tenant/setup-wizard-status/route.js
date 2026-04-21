import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { SETUP_WIZARD_STEP_DEFS } from '@/lib/setupWizardStepsMeta';
import {
  parseSetupWizardState,
  deriveSetupWizardFacts,
  effectiveStepStatus,
} from '@/lib/setupWizardService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { ownerUserId: true },
    });
    const isTenantOwner = tenant?.ownerUserId === user.id;

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
      select: {
        fiscalYearStartMonth: true,
        setupReminderSnoozedUntil: true,
        setupWizardState: true,
      },
    });

    const state = parseSetupWizardState(settings?.setupWizardState);
    const facts = await deriveSetupWizardFacts(prisma, user.tenantId);

    const steps = SETUP_WIZARD_STEP_DEFS.map((def) => ({
      ...def,
      status: effectiveStepStatus(def.id, state, facts),
    }));

    const pendingSteps = steps.filter((s) => s.status === 'pending');
    const snoozeUntil = settings?.setupReminderSnoozedUntil
      ? new Date(settings.setupReminderSnoozedUntil)
      : null;
    const snoozeActive = !!(snoozeUntil && snoozeUntil.getTime() > Date.now());

    const showDashboardReminder =
      isTenantOwner && pendingSteps.length > 0 && !snoozeActive;

    const allStepsStillPending =
      pendingSteps.length === SETUP_WIZARD_STEP_DEFS.length && pendingSteps.length > 0;

    /** First-time owner: no step completed/skipped in UI and no derived completions yet */
    const showWelcomeSetupModal =
      isTenantOwner && allStepsStillPending && !snoozeActive;

    return NextResponse.json({
      isTenantOwner,
      fiscalYearStartMonth: Number(settings?.fiscalYearStartMonth) || 1,
      setupReminderSnoozedUntil: settings?.setupReminderSnoozedUntil ?? null,
      setupWizardState: settings?.setupWizardState ?? null,
      steps,
      pendingStepIds: pendingSteps.map((s) => s.id),
      pendingCount: pendingSteps.length,
      showDashboardReminder,
      showWelcomeSetupModal,
      allComplete: pendingSteps.length === 0,
    });
  } catch (e) {
    console.error('setup-wizard-status:', e);
    return NextResponse.json({ error: 'Failed to load setup wizard status' }, { status: 500 });
  }
}

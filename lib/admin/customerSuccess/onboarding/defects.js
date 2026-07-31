/**
 * Onboarding defects — Critical blocks go-live.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingDefectModel,
  serializeOnboardingDefect,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';

export const DEFECT_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export async function recordOnboardingDefect(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_defect_forbidden' };
  }
  if (!hasCustomerOnboardingDefectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_defect_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const severity = String(args.severity || DEFECT_SEVERITY.MEDIUM)
    .trim()
    .toUpperCase();
  const now = args.now || new Date();

  const row = await prisma.customerOnboardingDefect.create({
    data: {
      projectId: loaded.project.id,
      title: String(args.title || 'Untitled defect').trim().slice(0, 500),
      description: args.description != null ? String(args.description) : null,
      severity,
      status: String(args.status || 'OPEN').trim().toUpperCase(),
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    defect: serializeOnboardingDefect(row),
    domain: getOnboardingDomainContract(),
  };
}

function isOpenBlockingStatus(status) {
  const s = String(status || 'OPEN').toUpperCase();
  return s === 'OPEN' || s === 'IN_PROGRESS' || s === 'BLOCKING';
}

export async function listOpenCriticalDefects(prisma, projectId) {
  if (typeof prisma?.customerOnboardingDefect?.findMany !== 'function') {
    return [];
  }
  const rows = await prisma.customerOnboardingDefect.findMany({
    where: { projectId, severity: DEFECT_SEVERITY.CRITICAL },
  });
  return (rows || []).filter((d) => isOpenBlockingStatus(d.status));
}

/**
 * Critical + High open defects block go-live (Phase 21 Wave 3 / G21-15).
 * High may later gain approved-exception path; default is block.
 * Filter severities in JS so harnesses without Prisma `in` filters still work.
 */
export async function listOpenBlockingDefects(prisma, projectId) {
  if (typeof prisma?.customerOnboardingDefect?.findMany !== 'function') {
    return [];
  }
  const rows = await prisma.customerOnboardingDefect.findMany({
    where: { projectId },
  });
  const blockingSeverities = new Set([
    DEFECT_SEVERITY.CRITICAL,
    DEFECT_SEVERITY.HIGH,
  ]);
  return (rows || []).filter((d) => {
    const sev = String(d.severity || '').toUpperCase();
    return blockingSeverities.has(sev) && isOpenBlockingStatus(d.status);
  });
}

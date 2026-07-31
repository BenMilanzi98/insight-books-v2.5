/**
 * Deterministic onboarding health — versioned rules; no ML.
 * Does not overwrite Phase 8 Customer Health.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import { getOnboardingDomainContract } from './catalogue.js';
import { listOpenCriticalDefects } from './defects.js';
import { calculateOnboardingProgress } from './progress.js';

export const HEALTH_RULES_VERSION = 'onboarding-health-v1';

export const ONBOARDING_HEALTH_STATUS = Object.freeze({
  HEALTHY: 'HEALTHY',
  HEALTHY_WITH_WARNINGS: 'HEALTHY_WITH_WARNINGS',
  AT_RISK: 'AT_RISK',
  HIGH_RISK: 'HIGH_RISK',
  BLOCKED: 'BLOCKED',
  UNKNOWN: 'UNKNOWN',
  NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA',
});

export async function calculateOnboardingHealth(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;

  const progress = await calculateOnboardingProgress(prisma, {
    ...args,
    projectId: loaded.project.id,
  });
  if (!progress.ok) return progress;

  const critical = await listOpenCriticalDefects(prisma, loaded.project.id);
  const projectStatus = String(loaded.project.status || '').toUpperCase();

  let status = ONBOARDING_HEALTH_STATUS.NOT_ENOUGH_DATA;

  if (critical.length > 0 || projectStatus === 'BLOCKED') {
    status = ONBOARDING_HEALTH_STATUS.BLOCKED;
  } else if (projectStatus === 'FAILED') {
    status = ONBOARDING_HEALTH_STATUS.HIGH_RISK;
  } else if (progress.percent < 25 && projectStatus === 'IN_PROGRESS') {
    status = ONBOARDING_HEALTH_STATUS.AT_RISK;
  } else if (progress.percent >= 60) {
    status = ONBOARDING_HEALTH_STATUS.HEALTHY;
  } else if (progress.percent > 0) {
    status = ONBOARDING_HEALTH_STATUS.HEALTHY_WITH_WARNINGS;
  } else {
    status = ONBOARDING_HEALTH_STATUS.NOT_ENOUGH_DATA;
  }

  return {
    ok: true,
    projectId: loaded.project.id,
    status,
    progressPercent: progress.percent,
    criticalDefectCount: critical.length,
    rulesVersion: HEALTH_RULES_VERSION,
    ml: false,
    domain: getOnboardingDomainContract(),
  };
}

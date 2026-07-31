/**
 * Adoption permission helpers — Phase 19 Wave 1.
 * Reuses systemAdmin.customerSuccess.read | .manageCases via authz.
 */

import { canManageAdoption, canViewAdoption, resolveAdoptionActor } from './model.js';

export const ADOPTION_PERMISSION_NOTES = Object.freeze({
  overview: 'customerSuccess.read',
  requests: 'customerSuccess.read',
  plans: 'customerSuccess.read',
  manage: 'customerSuccess.manageCases || Super Admin',
  completion: 'customerSuccess.manageCases (Wave 2+ evaluation)',
});

export function assertCanManageAdoption(args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_manage_forbidden' };
  }
  return { ok: true, admin };
}

export function assertCanViewAdoption(args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) && !canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_view_forbidden' };
  }
  return { ok: true, admin };
}

export { canManageAdoption, canViewAdoption, resolveAdoptionActor };

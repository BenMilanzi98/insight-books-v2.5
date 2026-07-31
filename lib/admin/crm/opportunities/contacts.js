/**
 * Opportunity Contact roles — Phase 12 Wave 2.
 * Roles are Opportunity-specific; never grant platform User permissions.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { hasCrmOpportunityModel } from './model.js';

export const CRM_OPPORTUNITY_CONTACT_ROLE = Object.freeze({
  PRIMARY: 'PRIMARY',
  CHAMPION: 'CHAMPION',
  ECONOMIC_BUYER: 'ECONOMIC_BUYER',
  INFLUENCER: 'INFLUENCER',
  DECISION_MAKER: 'DECISION_MAKER',
  BLOCKER: 'BLOCKER',
});

export const CRM_OPPORTUNITY_CONTACT_ROLES = Object.freeze(
  Object.values(CRM_OPPORTUNITY_CONTACT_ROLE)
);

export function hasCrmOpportunityContactRoleModel(prisma) {
  return typeof prisma?.crmOpportunityContactRole?.findMany === 'function';
}

export function hasCrmOpportunityContactRoleHistoryModel(prisma) {
  return typeof prisma?.crmOpportunityContactRoleHistory?.create === 'function';
}

function serializeRole(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    contactId: row.contactId,
    role: row.role,
    note: row.note || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    /** Explicit honesty: Opportunity role ≠ platform permission grant */
    platformPermissionGrant: false,
  };
}

async function loadOpportunity(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id) return null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    }
    return await prisma.crmOpportunity.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Whether Opportunity has an active PRIMARY contact role.
 */
export async function hasPrimaryContactRole(prisma, opportunityId) {
  if (!hasCrmOpportunityContactRoleModel(prisma)) return false;
  const opp = await loadOpportunity(prisma, opportunityId);
  if (!opp) return false;
  try {
    const row = await prisma.crmOpportunityContactRole.findFirst({
      where: { opportunityId: opp.id, role: CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY },
    });
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * Seed PRIMARY from Opportunity.contactId (create path / repair). Idempotent.
 */
export async function seedPrimaryContactFromOpportunity(prisma, args = {}) {
  if (!hasCrmOpportunityContactRoleModel(prisma)) {
    return { ok: false, skipped: true, reason: 'model_unavailable' };
  }
  const opp = args.opportunity || (await loadOpportunity(prisma, args.opportunityId));
  if (!opp?.id) return { ok: false, error: 'opportunity_not_found' };
  if (!opp.contactId) return { ok: true, seeded: false, reason: 'no_contact_id' };

  const existing = await prisma.crmOpportunityContactRole.findFirst({
    where: { opportunityId: opp.id, role: CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY },
  });
  if (existing) {
    return { ok: true, seeded: false, idempotent: true, role: serializeRole(existing) };
  }

  const now = args.now || new Date();
  const row = await prisma.crmOpportunityContactRole.create({
    data: {
      opportunityId: opp.id,
      contactId: String(opp.contactId),
      role: CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY,
      note: 'seeded_from_opportunity_contactId',
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (hasCrmOpportunityContactRoleHistoryModel(prisma)) {
    await prisma.crmOpportunityContactRoleHistory.create({
      data: {
        opportunityId: opp.id,
        contactId: row.contactId,
        role: row.role,
        action: 'SEED_PRIMARY',
        changedByAdminId: args.admin?.id || null,
        reason: 'seeded_from_opportunity_contactId',
        at: now,
      },
    });
  }

  return { ok: true, seeded: true, role: serializeRole(row) };
}

/**
 * List Opportunity contact roles.
 */
export async function listOpportunityContactRoles(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }
  if (!hasCrmOpportunityContactRoleModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_contact_role_model_unavailable', status: 'UNAVAILABLE' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const rows = await prisma.crmOpportunityContactRole.findMany({
    where: { opportunityId: opp.id },
    orderBy: { createdAt: 'asc' },
  });

  return {
    ok: true,
    opportunityId: opp.id,
    roles: (rows || []).map(serializeRole),
    platformPermissionGrant: false,
  };
}

/**
 * Upsert / add a contact role on an Opportunity.
 * Enforces at most one PRIMARY.
 */
export async function upsertOpportunityContactRole(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_edit_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }
  if (!hasCrmOpportunityContactRoleModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_contact_role_model_unavailable', status: 'UNAVAILABLE' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const contactId = args.contactId != null ? String(args.contactId).trim() : '';
  if (!contactId) return { ok: false, error: 'contactId_required' };

  const role = String(args.role || '').trim().toUpperCase();
  if (!CRM_OPPORTUNITY_CONTACT_ROLES.includes(role)) {
    return {
      ok: false,
      error: 'invalid_role',
      allowed: CRM_OPPORTUNITY_CONTACT_ROLES,
    };
  }

  const now = args.now || new Date();

  if (role === CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY) {
    const existingPrimary = await prisma.crmOpportunityContactRole.findFirst({
      where: { opportunityId: opp.id, role: CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY },
    });
    if (existingPrimary && existingPrimary.contactId !== contactId) {
      await prisma.crmOpportunityContactRole.update({
        where: { id: existingPrimary.id },
        data: {
          contactId,
          note: args.note != null ? String(args.note) : existingPrimary.note,
          updatedAt: now,
        },
      });
      const updated = await prisma.crmOpportunityContactRole.findUnique({
        where: { id: existingPrimary.id },
      });
      if (hasCrmOpportunityContactRoleHistoryModel(prisma)) {
        await prisma.crmOpportunityContactRoleHistory.create({
          data: {
            opportunityId: opp.id,
            contactId,
            role,
            action: 'REPLACE_PRIMARY',
            previousContactId: existingPrimary.contactId,
            changedByAdminId: args.admin?.id || null,
            reason: args.reason != null ? String(args.reason) : 'primary_replaced',
            at: now,
          },
        });
      }
      if (typeof prisma.crmOpportunity.update === 'function') {
        await prisma.crmOpportunity.update({
          where: { id: opp.id },
          data: { contactId, updatedAt: now },
        });
      }
      return {
        ok: true,
        role: serializeRole(updated),
        platformPermissionGrant: false,
      };
    }
  }

  const dup = await prisma.crmOpportunityContactRole.findFirst({
    where: { opportunityId: opp.id, contactId, role },
  });
  if (dup) {
    return {
      ok: true,
      idempotent: true,
      role: serializeRole(dup),
      platformPermissionGrant: false,
    };
  }

  const row = await prisma.crmOpportunityContactRole.create({
    data: {
      opportunityId: opp.id,
      contactId,
      role,
      note: args.note != null ? String(args.note) : null,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (hasCrmOpportunityContactRoleHistoryModel(prisma)) {
    await prisma.crmOpportunityContactRoleHistory.create({
      data: {
        opportunityId: opp.id,
        contactId,
        role,
        action: 'ADD',
        changedByAdminId: args.admin?.id || null,
        reason: args.reason != null ? String(args.reason) : null,
        at: now,
      },
    });
  }

  if (
    role === CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY &&
    typeof prisma.crmOpportunity.update === 'function'
  ) {
    await prisma.crmOpportunity.update({
      where: { id: opp.id },
      data: { contactId, updatedAt: now },
    });
  }

  return {
    ok: true,
    role: serializeRole(row),
    platformPermissionGrant: false,
  };
}

/**
 * List immutable contact-role history.
 */
export async function listOpportunityContactRoleHistory(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }
  if (!hasCrmOpportunityContactRoleHistoryModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_contact_role_history_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const rows = await prisma.crmOpportunityContactRoleHistory.findMany({
    where: { opportunityId: opp.id },
    orderBy: { at: 'asc' },
  });

  return {
    ok: true,
    history: (rows || []).map((h) => ({
      id: h.id,
      contactId: h.contactId,
      role: h.role,
      action: h.action,
      previousContactId: h.previousContactId || null,
      reason: h.reason || null,
      changedByAdminId: h.changedByAdminId || null,
      at: h.at ? new Date(h.at).toISOString() : null,
    })),
  };
}

/**
 * Adoption champions — contact-verified enablement records (Phase 19 Wave 3).
 * No fabricated engagement scores.
 */

import {
  ADOPTION_CHAMPION_ENABLEMENT_STATUS,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCrmContactModel,
  hasCustomerAdoptionChampionModel,
  resolveAdoptionActor,
  serializeAdoptionChampion,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';

async function loadContact(prisma, contactId) {
  if (!contactId || !hasCrmContactModel(prisma)) return null;
  if (typeof prisma.crmContact.findUnique === 'function') {
    const byId = await prisma.crmContact.findUnique({ where: { id: contactId } });
    if (byId) return byId;
  }
  if (typeof prisma.crmContact.findFirst === 'function') {
    return prisma.crmContact.findFirst({ where: { id: contactId } });
  }
  return null;
}

function isContactVerified(contact) {
  if (!contact) return false;
  const status = String(
    contact.verificationStatus || contact.verifiedStatus || contact.status || ''
  )
    .trim()
    .toUpperCase();
  if (status === 'VERIFIED' || status === 'APPROVED') return true;
  if (contact.verified === true || contact.isVerified === true) return true;
  if (contact.verifiedAt) return true;
  return false;
}

/**
 * Upsert a champion on a Plan. Requires verified CRM contact.
 * Rejects any engagementScore / fabricated score fields.
 */
export async function upsertAdoptionChampion(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_champion_forbidden' };
  }
  if (!hasCustomerAdoptionChampionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_champion_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  if (
    args.engagementScore != null ||
    args.engagement_score != null ||
    args.healthScore != null ||
    args.score != null
  ) {
    return {
      ok: false,
      error: 'engagement_score_forbidden',
      message: 'Fabricated engagement scores are forbidden on adoption champions',
    };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required' };

  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;
  const plan = access.planRow || access.plan;

  const contactId = args.contactId ? String(args.contactId).trim() : '';
  if (!contactId) return { ok: false, error: 'contactId_required' };

  const role = args.role
    ? String(args.role).trim().toUpperCase()
    : 'CHAMPION';
  if (!role) return { ok: false, error: 'role_required' };

  const contact = await loadContact(prisma, contactId);
  if (!contact) {
    return { ok: false, error: 'CONTACT_IDENTITY_UNRESOLVED' };
  }
  if (!isContactVerified(contact)) {
    return { ok: false, error: 'CONTACT_NOT_VERIFIED' };
  }

  const enablementStatus = args.enablementStatus
    ? String(args.enablementStatus).trim().toUpperCase()
    : ADOPTION_CHAMPION_ENABLEMENT_STATUS.IDENTIFIED;
  const allowed = new Set(Object.values(ADOPTION_CHAMPION_ENABLEMENT_STATUS));
  if (!allowed.has(enablementStatus)) {
    return { ok: false, error: 'invalid_enablement_status' };
  }

  const now = args.now || new Date();
  const existing =
    (await prisma.customerAdoptionChampion.findUnique?.({
      where: { planId_contactId_role: { planId, contactId, role } },
    })) ||
    (await prisma.customerAdoptionChampion.findFirst({
      where: { planId, contactId, role },
    }));

  if (existing) {
    const updated = await prisma.customerAdoptionChampion.update({
      where: { id: existing.id },
      data: {
        enablementStatus,
        lastEvidenceRef:
          args.lastEvidenceRef != null
            ? String(args.lastEvidenceRef).trim()
            : existing.lastEvidenceRef,
        updatedAt: now,
      },
    });
    return {
      ok: true,
      champion: serializeAdoptionChampion(updated),
      updated: true,
      domain: getAdoptionDomainContract(),
    };
  }

  const row = await prisma.customerAdoptionChampion.create({
    data: {
      planId,
      contactId,
      role,
      enablementStatus,
      lastEvidenceRef:
        args.lastEvidenceRef != null ? String(args.lastEvidenceRef).trim() : null,
      tenantId: plan.tenantId || null,
      customerId: plan.customerId || null,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    champion: serializeAdoptionChampion(row),
    created: true,
    domain: getAdoptionDomainContract(),
  };
}

export async function listAdoptionChampions(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin) && !args.admin) {
    // view allowed via plan access
  }
  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required', items: [] };

  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
  });
  if (!access.ok) return { ...access, items: [] };

  if (!hasCustomerAdoptionChampionModel(prisma)) {
    return {
      ok: true,
      items: [],
      status: 'UNAVAILABLE',
      meta: { unavailable: true },
    };
  }

  const rows = await prisma.customerAdoptionChampion.findMany({
    where: { planId },
  });
  return {
    ok: true,
    items: (rows || []).map(serializeAdoptionChampion),
    domain: getAdoptionDomainContract(),
  };
}

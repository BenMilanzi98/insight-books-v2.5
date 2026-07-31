/**
 * Onboarding stakeholders — Contact verification gate for required Customer roles.
 */

import { getOnboardingDomainContract } from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingStakeholderModel,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingStakeholder,
} from './model.js';

async function loadContact(prisma, contactId) {
  if (!contactId) return null;
  if (typeof prisma.crmContact?.findUnique === 'function') {
    const byId = await prisma.crmContact.findUnique({ where: { id: contactId } });
    if (byId) return byId;
  }
  if (typeof prisma.crmContact?.findFirst === 'function') {
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
 * Assign stakeholder; required Customer-facing roles need verified Contact.
 */
export async function assignOnboardingStakeholder(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_stakeholder_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingStakeholderModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_stakeholder_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  const contactId = args.contactId ? String(args.contactId).trim() : '';
  const role = args.role ? String(args.role).trim().toUpperCase() : '';
  const required = args.required !== false;
  if (!projectId) return { ok: false, error: 'projectId_required' };
  if (!contactId) return { ok: false, error: 'contactId_required' };
  if (!role) return { ok: false, error: 'role_required' };

  const project = await prisma.customerOnboardingProject.findUnique({
    where: { id: projectId },
  });
  if (!project) return { ok: false, error: 'project_not_found' };

  const contact = await loadContact(prisma, contactId);
  if (!contact) {
    return { ok: false, error: 'CONTACT_IDENTITY_UNRESOLVED' };
  }

  const customerFacing =
    role.startsWith('CUSTOMER_') ||
    role === 'TENANT_ADMIN' ||
    role === 'EXECUTIVE_SPONSOR';
  if ((required || customerFacing) && !isContactVerified(contact)) {
    return { ok: false, error: 'CONTACT_NOT_VERIFIED' };
  }

  const existing = await prisma.customerOnboardingStakeholder.findFirst({
    where: { projectId, contactId, role },
  });
  if (existing) {
    return {
      ok: true,
      stakeholder: serializeOnboardingStakeholder(existing),
      alreadyExists: true,
      domain: getOnboardingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const row = await prisma.customerOnboardingStakeholder.create({
    data: {
      projectId,
      contactId,
      role,
      party: args.party || (customerFacing ? 'CUSTOMER' : 'INSIGHTBOOKS'),
      required,
      status: 'ACTIVE',
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    stakeholder: serializeOnboardingStakeholder(row),
    created: true,
    domain: getOnboardingDomainContract(),
  };
}

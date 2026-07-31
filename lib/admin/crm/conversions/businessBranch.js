/**
 * Primary Business / Branch + contact linking — Phase 16 Wave 2 / Phase 20 Wave 2.
 * Business via conversionBusiness when present; else typed NOT_AVAILABLE (no fabricated biz-proxy).
 * Branch via existing Branch model. Cross-tenant denied.
 * Contact: link vs create; consent preserved; cross-Customer denied.
 */

import { CRM_CONSENT_STATUS } from '../catalogue.js';
import {
  CRM_CONTACT_LINK_DECISION,
  CRM_CONVERSION_RESOURCE_TYPE,
} from './catalogue.js';
import { assertTenantIsolation } from './isolation.js';
import { resolveConversionActor } from './model.js';

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

/**
 * Create primary Business + Branch bound to locked conversion Tenant.
 */
export async function createPrimaryBusinessBranch(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const lockedTenantId = args.lockedTenantId || args.tenantId;
  const tenantId = args.tenantId || args.lockedTenantId;
  const requireBusiness = args.requireBusiness !== false;
  const requireBranch = args.requireBranch !== false;
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId ? `bizbranch:${conversionId}` : null);

  const isolation = assertTenantIsolation({
    lockedTenantId,
    requestedTenantId: tenantId,
    resource: 'BUSINESS',
  });
  if (!isolation.ok) {
    return {
      ok: false,
      error: isolation.error,
      isolation,
    };
  }

  if (hasResourceModel(prisma) && conversionId && idempotencyKey) {
    const existing = await prisma.crmConversionResource.findFirst({
      where: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.BUSINESS,
        idempotencyKey,
      },
    });
    if (existing) {
      return {
        ok: true,
        idempotentReplay: true,
        businessId: existing.resourceId,
        branchId: existing.metaJson?.branchId || null,
        skippedBusiness: existing.metaJson?.skippedBusiness || false,
      };
    }
  }

  let businessId = null;
  let skippedBusiness = false;
  let businessStatus = null;

  if (requireBusiness) {
    if (typeof prisma?.conversionBusiness?.create === 'function') {
      const biz = await prisma.conversionBusiness.create({
        data: {
          tenantId,
          conversionId,
          name: args.businessName || args.name || 'Primary Business',
          status: 'PROVISIONING',
          createdByAdminId: admin?.id || null,
          createdAt: args.now || new Date(),
        },
      });
      businessId = biz.id;
      businessStatus = 'CREATED';
    } else {
      // No first-class Business model — typed NOT_AVAILABLE (never fabricate biz-proxy success).
      return {
        ok: false,
        error: 'business_model_unavailable',
        status: 'NOT_AVAILABLE',
        skippedBusiness: true,
        businessId: null,
        businessCreated: false,
      };
    }
  } else {
    skippedBusiness = true;
    businessStatus = 'SKIPPED_NOT_APPLICABLE';
  }

  let branchId = null;
  if (requireBranch) {
    if (typeof prisma?.branch?.create !== 'function') {
      return {
        ok: false,
        error: 'branch_model_unavailable',
        status: 'NOT_AVAILABLE',
        businessId,
      };
    }
    const branchName = args.branchName || 'Headquarters';
    const existingBranch = await prisma.branch.findFirst({
      where: { tenantId, name: branchName },
    });
    if (existingBranch) {
      branchId = existingBranch.id;
    } else {
      const branch = await prisma.branch.create({
        data: {
          tenantId,
          name: branchName,
          code: args.branchCode || 'HQ',
          isActive: true,
          createdAt: args.now || new Date(),
          updatedAt: args.now || new Date(),
        },
      });
      branchId = branch.id;
    }
  }

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.BUSINESS,
        resourceId: businessId || `skip:${conversionId}`,
        action: skippedBusiness ? 'SKIP' : 'CREATE',
        status: businessStatus || 'CREATED',
        idempotencyKey,
        metaJson: {
          tenantId,
          branchId,
          skippedBusiness,
          requireBranch,
        },
        actorAdminId: admin?.id || null,
        createdAt: args.now || new Date(),
        updatedAt: args.now || new Date(),
      },
    });
    if (branchId) {
      await prisma.crmConversionResource.create({
        data: {
          conversionId,
          resourceType: CRM_CONVERSION_RESOURCE_TYPE.BRANCH,
          resourceId: branchId,
          action: 'CREATE',
          status: 'CREATED',
          idempotencyKey: `${idempotencyKey}:branch`,
          metaJson: { tenantId },
          actorAdminId: admin?.id || null,
          createdAt: args.now || new Date(),
          updatedAt: args.now || new Date(),
        },
      });
    }
  }

  return {
    ok: true,
    businessId,
    branchId,
    skippedBusiness,
    tenantId,
    status: 'COMPLETED',
  };
}

async function resolveContactConsent(prisma, contactId) {
  if (!contactId) {
    return { consentStatus: CRM_CONSENT_STATUS.UNKNOWN, consentPreserved: false };
  }
  if (typeof prisma?.crmConsentRecord?.findFirst === 'function') {
    const row = await prisma.crmConsentRecord.findFirst({
      where: { contactId },
    });
    if (row) {
      return {
        consentStatus: row.status || CRM_CONSENT_STATUS.UNKNOWN,
        consentPreserved: true,
        purposes: row.purposes || row.consentPurposes || null,
      };
    }
  }
  return { consentStatus: CRM_CONSENT_STATUS.UNKNOWN, consentPreserved: true };
}

async function resolveContactBoundCustomerId(prisma, contact) {
  if (!contact) return null;
  if (contact.customerId) return String(contact.customerId);
  if (contact.accountId && typeof prisma?.crmAccount?.findUnique === 'function') {
    const account = await prisma.crmAccount.findUnique({
      where: { id: contact.accountId },
    });
    if (account?.customerId) return String(account.customerId);
  }
  return null;
}

/**
 * Decide contact LINK vs CREATE for conversion. Cross-Customer binding denied.
 * Consent status is read and preserved (never overwritten / inferred GRANTED).
 */
export async function decideContactCreateOrLink(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const customerId = args.customerId ? String(args.customerId) : null;
  const contactId = args.contactId ? String(args.contactId) : null;
  const email = args.email ? String(args.email).trim().toLowerCase() : null;

  let contact = null;
  if (contactId && typeof prisma?.crmContact?.findUnique === 'function') {
    contact = await prisma.crmContact.findUnique({ where: { id: contactId } });
  }
  if (!contact && email && typeof prisma?.crmContact?.findMany === 'function') {
    const rows = await prisma.crmContact.findMany({ where: { email } });
    contact = (rows || [])[0] || null;
  }

  if (contact) {
    const boundCustomerId = await resolveContactBoundCustomerId(prisma, contact);
    if (
      customerId &&
      boundCustomerId &&
      String(boundCustomerId) !== String(customerId)
    ) {
      const audited = Boolean(conversionId);
      if (
        conversionId &&
        typeof prisma?.crmConversionMatchDecision?.create === 'function'
      ) {
        await prisma.crmConversionMatchDecision.create({
          data: {
            conversionId,
            decisionType: 'CONTACT',
            matchState: 'CROSS_CUSTOMER',
            decision: CRM_CONTACT_LINK_DECISION.DENIED_CROSS_CUSTOMER,
            actionRequested: 'LINK',
            ok: false,
            errorCode: 'cross_customer_contact_denied',
            candidateJson: [
              {
                contactId: contact.id,
                boundCustomerId,
                requestedCustomerId: customerId,
              },
            ],
            actorAdminId: admin?.id || null,
            createdAt: args.now || new Date(),
          },
        });
      }
      return {
        ok: false,
        decision: CRM_CONTACT_LINK_DECISION.DENIED_CROSS_CUSTOMER,
        error: 'cross_customer_contact_denied',
        contactId: contact.id,
        boundCustomerId,
        customerId,
        audited,
        consentStatus: CRM_CONSENT_STATUS.UNKNOWN,
        consentPreserved: false,
      };
    }

    const consent = await resolveContactConsent(prisma, contact.id);
    return {
      ok: true,
      decision: CRM_CONTACT_LINK_DECISION.LINK,
      contactId: contact.id,
      customerId,
      role: args.role || contact.role || 'PRIMARY',
      consentStatus: consent.consentStatus,
      consentPreserved: consent.consentPreserved !== false,
      purposes: consent.purposes || null,
    };
  }

  // No existing contact → CREATE path (caller may materialise CRM Contact)
  const consent = {
    consentStatus: CRM_CONSENT_STATUS.UNKNOWN,
    consentPreserved: true,
  };
  return {
    ok: true,
    decision: CRM_CONTACT_LINK_DECISION.CREATE,
    contactId: null,
    customerId,
    email,
    firstName: args.firstName || null,
    lastName: args.lastName || null,
    role: args.role || 'PRIMARY',
    consentStatus: consent.consentStatus,
    consentPreserved: true,
  };
}

/**
 * Link CRM Contacts as invite targets for the conversion Tenant (no User invent).
 * Cross-Customer denied. Consent preserved on link resource meta.
 */
export async function linkContactsForConversion(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const tenantId = args.tenantId;
  const accountId = args.accountId;
  const contactId = args.contactId;
  const customerId = args.customerId || null;

  const isolation = assertTenantIsolation({
    lockedTenantId: tenantId,
    requestedTenantId: tenantId,
    resource: 'CONTACT_LINK',
  });
  if (!isolation.ok) {
    return { ok: false, error: isolation.error };
  }

  const contacts = [];
  if (contactId && typeof prisma?.crmContact?.findUnique === 'function') {
    const c = await prisma.crmContact.findUnique({ where: { id: contactId } });
    if (c) contacts.push(c);
  }
  if (
    accountId &&
    typeof prisma?.crmContact?.findMany === 'function' &&
    contacts.length === 0
  ) {
    const rows = await prisma.crmContact.findMany({ where: { accountId } });
    contacts.push(...(rows || []));
  }

  const linked = [];
  for (const c of contacts) {
    const decision = await decideContactCreateOrLink(prisma, {
      conversionId,
      customerId,
      contactId: c.id,
      accountId,
      admin,
      now: args.now,
    });
    if (!decision.ok) {
      return {
        ok: false,
        error: decision.error || 'contact_link_denied',
        decision: decision.decision,
        contactId: c.id,
      };
    }

    linked.push({
      contactId: c.id,
      email: c.email || null,
      tenantId,
      role: decision.role || c.role || 'PRIMARY',
      decision: decision.decision,
      consentStatus: decision.consentStatus,
      consentPreserved: decision.consentPreserved === true,
    });
    if (hasResourceModel(prisma) && conversionId) {
      const key = `contact:${conversionId}:${c.id}`;
      const existing = await prisma.crmConversionResource.findFirst({
        where: {
          conversionId,
          resourceType: CRM_CONVERSION_RESOURCE_TYPE.CONTACT_LINK,
          idempotencyKey: key,
        },
      });
      if (!existing) {
        await prisma.crmConversionResource.create({
          data: {
            conversionId,
            resourceType: CRM_CONVERSION_RESOURCE_TYPE.CONTACT_LINK,
            resourceId: c.id,
            action: decision.decision || 'LINK',
            status: 'LINKED',
            idempotencyKey: key,
            metaJson: {
              tenantId,
              email: c.email || null,
              customerId: customerId || null,
              role: decision.role || c.role || 'PRIMARY',
              consentStatus: decision.consentStatus,
              consentPreserved: decision.consentPreserved === true,
            },
            actorAdminId: admin?.id || null,
            createdAt: args.now || new Date(),
            updatedAt: args.now || new Date(),
          },
        });
      }
    }
  }

  return {
    ok: true,
    linkedContacts: linked,
    count: linked.length,
  };
}


/**
 * CREATE_OR_LINK_TENANT — Phase 16 Wave 2.
 * Wraps Tenant create carefully: reserved slug block, unique subdomain,
 * status PROVISIONING (never ACTIVE before Wave 3 activation), step idempotency.
 * Does NOT call admin tenants POST (which sets active + trial subscription).
 * Accounting-boundary failure after create → FAILED_PROVISIONING resource + idempotent retry.
 */

import {
  CRM_CONVERSION_RESOURCE_TYPE,
  CRM_TENANT_PROVISION_STATUS,
  RESERVED_TENANT_SLUGS,
} from './catalogue.js';
import { assertNoTenantAccountingSideEffects } from './accountingBoundary.js';
import { resolveConversionActor } from './model.js';
import { stripFabricatedProvisionArgs } from './requestHonesty.js';

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isReservedTenantSlug(slug) {
  const s = normalizeSlug(slug);
  return !s || RESERVED_TENANT_SLUGS.includes(s);
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

function hasTenantModel(prisma) {
  return (
    typeof prisma?.tenant?.create === 'function' &&
    typeof prisma?.tenant?.findUnique === 'function'
  );
}

function isFailedProvisionStatus(status) {
  return (
    status === 'FAILED' ||
    status === CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING ||
    status === 'FAILED_PROVISIONING'
  );
}

function isClaimableTenantStatus(status) {
  return (
    status === CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING ||
    status === CRM_TENANT_PROVISION_STATUS.PROVISIONING ||
    status === 'FAILED_PROVISIONING' ||
    status === 'PROVISIONING' ||
    status === 'pending' ||
    status === 'PENDING'
  );
}

async function markTenantFailedProvisioning(prisma, tenantId, now) {
  if (!tenantId || typeof prisma?.tenant?.update !== 'function') return;
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING,
        updatedAt: now || new Date(),
      },
    });
  } catch {
    /* best-effort compensation marker */
  }
}

async function writeOrUpdateTenantResource(prisma, {
  conversionId,
  tenantId,
  action,
  status,
  idempotencyKey,
  slug,
  customerId,
  admin,
  now,
  existingRes = null,
  metaExtra = {},
}) {
  if (!hasResourceModel(prisma) || !conversionId || !tenantId) return null;
  const payload = {
    resourceId: tenantId,
    action: action || 'CREATE',
    status,
    metaJson: {
      slug,
      customerId: customerId || null,
      ...metaExtra,
    },
    actorAdminId: admin?.id || null,
    updatedAt: now || new Date(),
  };
  if (existingRes?.id && typeof prisma.crmConversionResource.update === 'function') {
    return prisma.crmConversionResource.update({
      where: { id: existingRes.id },
      data: payload,
    });
  }
  return prisma.crmConversionResource.create({
    data: {
      conversionId,
      resourceType: CRM_CONVERSION_RESOURCE_TYPE.TENANT,
      idempotencyKey,
      createdAt: now || new Date(),
      ...payload,
    },
  });
}

async function findForeignTenantOwner(prisma, tenantId, conversionId) {
  if (!hasResourceModel(prisma) || !tenantId) return null;
  if (typeof prisma.crmConversionResource.findMany === 'function') {
    const rows = await prisma.crmConversionResource.findMany({
      where: { resourceType: CRM_CONVERSION_RESOURCE_TYPE.TENANT },
    });
    return (
      (rows || []).find(
        (r) => r.resourceId === tenantId && r.conversionId !== conversionId
      ) || null
    );
  }
  return null;
}

async function resumeFailedTenantProvision(prisma, {
  existingRes,
  conversionId,
  slug,
  customerId,
  admin,
  now,
  initFinancialDefaults,
  seedRoles,
}) {
  const tenantId = existingRes.resourceId;
  if (!tenantId) {
    return {
      ok: false,
      error: 'tenant_resource_missing_id',
      status: 'FAILED',
      retryable: true,
    };
  }

  if (initFinancialDefaults === true) {
    try {
      const { initializeNewTenantFinancialDefaults } = await import(
        '@/lib/initializeNewTenantFinancialDefaults.js'
      );
      if (typeof initializeNewTenantFinancialDefaults === 'function') {
        await initializeNewTenantFinancialDefaults(tenantId, prisma);
      }
    } catch {
      /* optional */
    }
  }

  const boundary = await assertNoTenantAccountingSideEffects(prisma, {
    tenantId,
    conversionId,
  });
  if (!boundary.ok) {
    await markTenantFailedProvisioning(prisma, tenantId, now);
    await writeOrUpdateTenantResource(prisma, {
      conversionId,
      tenantId,
      action: existingRes.action || 'CREATE',
      status: CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING,
      idempotencyKey: existingRes.idempotencyKey,
      slug,
      customerId,
      admin,
      now,
      existingRes,
      metaExtra: { accountingBoundary: boundary },
    });
    return {
      ok: false,
      error: boundary.error,
      tenantId,
      status: 'FAILED',
      retryable: true,
      accountingBoundary: boundary,
      idempotentReplay: true,
    };
  }

  if (typeof prisma?.tenant?.update === 'function') {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: CRM_TENANT_PROVISION_STATUS.PROVISIONING,
          updatedAt: now || new Date(),
        },
      });
    } catch {
      /* ignore */
    }
  }

  await writeOrUpdateTenantResource(prisma, {
    conversionId,
    tenantId,
    action: existingRes.action || 'CREATE',
    status: CRM_TENANT_PROVISION_STATUS.PROVISIONING,
    idempotencyKey: existingRes.idempotencyKey,
    slug,
    customerId,
    admin,
    now,
    existingRes,
  });

  if (seedRoles === true) {
    try {
      const { seedDefaultRolesForTenant } = await import('@/lib/seedTenantRoles.js');
      if (typeof seedDefaultRolesForTenant === 'function') {
        await seedDefaultRolesForTenant(tenantId, prisma);
      }
    } catch {
      /* optional */
    }
  }

  return {
    ok: true,
    action: existingRes.action || 'CREATE',
    tenantId,
    status: CRM_TENANT_PROVISION_STATUS.PROVISIONING,
    idempotentReplay: true,
    tenantCreated: (existingRes.action || 'CREATE') === 'CREATE',
    tenantLinked: existingRes.action === 'LINK',
    accountingBoundary: boundary,
    recoveredFromFailedProvisioning: true,
  };
}

/**
 * Claim existing slug tenant for this conversion when it is an orphan /
 * failed-provisioning row (idempotent retry after accounting-boundary fail).
 */
async function claimOrResumeSlugTenant(prisma, {
  collision,
  conversionId,
  slug,
  customerId,
  admin,
  now,
  idempotencyKey,
  initFinancialDefaults,
  seedRoles,
}) {
  if (!collision || !conversionId || !isClaimableTenantStatus(collision.status)) {
    return null;
  }

  const foreign = await findForeignTenantOwner(prisma, collision.id, conversionId);
  if (foreign) return null;

  let existingRes = null;
  if (hasResourceModel(prisma)) {
    existingRes = await prisma.crmConversionResource.findFirst({
      where: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.TENANT,
        idempotencyKey,
      },
    });
    if (!existingRes) {
      const byTenantRows =
        typeof prisma.crmConversionResource.findMany === 'function'
          ? await prisma.crmConversionResource.findMany({
              where: {
                conversionId,
                resourceType: CRM_CONVERSION_RESOURCE_TYPE.TENANT,
              },
            })
          : [];
      existingRes =
        (byTenantRows || []).find((r) => r.resourceId === collision.id) || null;
    }
    if (!existingRes) {
      existingRes = await writeOrUpdateTenantResource(prisma, {
        conversionId,
        tenantId: collision.id,
        action: 'CREATE',
        status: isFailedProvisionStatus(collision.status)
          ? CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING
          : CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING,
        idempotencyKey,
        slug,
        customerId,
        admin,
        now,
        metaExtra: { claimedOrphan: true },
      });
    }
  }

  return resumeFailedTenantProvision(prisma, {
    existingRes: {
      id: existingRes?.id,
      resourceId: collision.id,
      action: 'CREATE',
      status: CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING,
      idempotencyKey,
      metaJson: { slug, customerId: customerId || null },
    },
    conversionId,
    slug,
    customerId,
    admin,
    now,
    initFinancialDefaults,
    seedRoles,
  });
}

/**
 * Audited tenant create-or-link decision.
 */
export async function decideTenantCreateOrLink(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const action = String(args.action || 'CREATE').toUpperCase();
  const slug = normalizeSlug(args.slug);
  let ok = true;
  let error = null;
  let decision = action === 'LINK' ? 'LINK' : 'CREATE';

  if (action === 'CREATE') {
    if (isReservedTenantSlug(slug)) {
      ok = false;
      error = 'tenant_slug_reserved';
      decision = 'BLOCKED';
    } else if (args.existingTenantId) {
      ok = false;
      error = 'existing_tenant_requires_link';
      decision = 'LINK_REQUIRED';
    } else if (hasTenantModel(prisma) && slug) {
      const existing = await prisma.tenant.findUnique({ where: { subdomain: slug } });
      if (existing && !isClaimableTenantStatus(existing.status)) {
        ok = false;
        error = 'tenant_slug_collision';
        decision = 'BLOCKED';
      }
    }
  } else if (action === 'LINK') {
    if (!args.existingTenantId) {
      ok = false;
      error = 'link_target_missing';
      decision = 'CREATE_REQUIRED';
    }
  }

  const audited = Boolean(args.conversionId);
  if (
    args.conversionId &&
    typeof prisma?.crmConversionMatchDecision?.create === 'function'
  ) {
    await prisma.crmConversionMatchDecision.create({
      data: {
        conversionId: args.conversionId,
        decisionType: 'TENANT',
        matchState: args.existingTenantId ? 'EXACT_EXISTING' : 'NO_MATCH',
        decision,
        actionRequested: action,
        ok,
        errorCode: error,
        candidateJson: args.existingTenantId
          ? [{ tenantId: args.existingTenantId, slug }]
          : [{ slug }],
        actorAdminId: admin?.id || null,
        createdAt: args.now || new Date(),
      },
    });
  }

  return {
    ok,
    decision,
    error,
    audited,
    slug,
    tenantId: args.existingTenantId || null,
  };
}

/**
 * Create or link Tenant for conversion. Status = PROVISIONING (not ACTIVE).
 */
export async function createOrLinkTenant(prisma, args = {}) {
  // Never honour forceActive / PROVISIONED / ACTIVATED without provider result.
  args = stripFabricatedProvisionArgs(args);
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const slug = normalizeSlug(args.slug);
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId ? `tenant:${conversionId}:${slug || 'link'}` : null);
  const now = args.now || new Date();

  if (hasResourceModel(prisma) && conversionId && idempotencyKey) {
    const existingRes = await prisma.crmConversionResource.findFirst({
      where: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.TENANT,
        idempotencyKey,
      },
    });
    if (existingRes?.resourceId) {
      if (isFailedProvisionStatus(existingRes.status)) {
        return resumeFailedTenantProvision(prisma, {
          existingRes,
          conversionId,
          slug: existingRes.metaJson?.slug || slug,
          customerId: args.customerId || existingRes.metaJson?.customerId || null,
          admin,
          now,
          initFinancialDefaults: args.initFinancialDefaults,
          seedRoles: args.seedRoles,
        });
      }
      return {
        ok: true,
        action: existingRes.action || 'CREATE',
        tenantId: existingRes.resourceId,
        status: existingRes.status || CRM_TENANT_PROVISION_STATUS.PROVISIONING,
        idempotentReplay: true,
        tenantCreated: existingRes.action === 'CREATE',
        tenantLinked: existingRes.action === 'LINK',
      };
    }
  }

  let decision = args.decision;
  if (!decision || decision.ok === undefined) {
    decision = await decideTenantCreateOrLink(prisma, {
      conversionId,
      slug,
      existingTenantId: args.existingTenantId || null,
      admin,
      action: args.action || (args.existingTenantId ? 'LINK' : 'CREATE'),
      now,
    });
  }

  // Enforce reserved / collision even if caller passed a loose decision
  if (isReservedTenantSlug(slug) && (decision.decision === 'CREATE' || !args.existingTenantId)) {
    return { ok: false, error: 'tenant_slug_reserved', status: 'BLOCKED' };
  }

  if (!hasTenantModel(prisma)) {
    return {
      ok: false,
      error: 'tenant_model_unavailable',
      status: 'NOT_AVAILABLE',
    };
  }

  if (args.existingTenantId || decision.decision === 'LINK') {
    const tenantId = args.existingTenantId || decision.tenantId;
    if (!tenantId) {
      return { ok: false, error: 'link_target_missing', status: 'NOT_AVAILABLE' };
    }
    if (hasResourceModel(prisma) && conversionId) {
      await prisma.crmConversionResource.create({
        data: {
          conversionId,
          resourceType: CRM_CONVERSION_RESOURCE_TYPE.TENANT,
          resourceId: tenantId,
          action: 'LINK',
          status: 'LINKED',
          idempotencyKey,
          metaJson: { slug },
          actorAdminId: admin?.id || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    return {
      ok: true,
      action: 'LINK',
      tenantId,
      status: 'LINKED',
      tenantCreated: false,
      tenantLinked: true,
    };
  }

  if (decision.ok === false && decision.error) {
    return {
      ok: false,
      error: decision.error,
      status: 'BLOCKED',
    };
  }

  const collision = await prisma.tenant.findUnique({ where: { subdomain: slug } });
  if (collision) {
    const recovered = await claimOrResumeSlugTenant(prisma, {
      collision,
      conversionId,
      slug,
      customerId: args.customerId,
      admin,
      now,
      idempotencyKey,
      initFinancialDefaults: args.initFinancialDefaults,
      seedRoles: args.seedRoles,
    });
    if (recovered) return recovered;
    return { ok: false, error: 'tenant_slug_collision', status: 'BLOCKED' };
  }

  let tenant;
  try {
    tenant = await prisma.tenant.create({
      data: {
        name: (args.name || slug || 'Conversion Tenant').trim(),
        subdomain: slug,
        subscriptionPlan: args.subscriptionPlan || '1month',
        // Never ACTIVE before Wave 3 activation policy
        status: CRM_TENANT_PROVISION_STATUS.PROVISIONING,
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const raced = await prisma.tenant.findUnique({ where: { subdomain: slug } });
      if (raced) {
        const recovered = await claimOrResumeSlugTenant(prisma, {
          collision: raced,
          conversionId,
          slug,
          customerId: args.customerId,
          admin,
          now,
          idempotencyKey,
          initFinancialDefaults: args.initFinancialDefaults,
          seedRoles: args.seedRoles,
        });
        if (recovered) return recovered;
      }
      return { ok: false, error: 'tenant_slug_collision', status: 'BLOCKED' };
    }
    return {
      ok: false,
      error: err?.message || 'tenant_create_failed',
      status: 'NOT_AVAILABLE',
    };
  }

  // Optional CoA/period init — never journals. Opt-in (orchestrator enables explicitly).
  if (args.initFinancialDefaults === true) {
    try {
      const { initializeNewTenantFinancialDefaults } = await import(
        '@/lib/initializeNewTenantFinancialDefaults.js'
      );
      if (typeof initializeNewTenantFinancialDefaults === 'function') {
        await initializeNewTenantFinancialDefaults(tenant.id, prisma);
      }
    } catch {
      /* CoA init optional in unit tests / EPERM environments */
    }
  }

  const boundary = await assertNoTenantAccountingSideEffects(prisma, {
    tenantId: tenant.id,
    conversionId,
  });
  if (!boundary.ok) {
    await markTenantFailedProvisioning(prisma, tenant.id, now);
    await writeOrUpdateTenantResource(prisma, {
      conversionId,
      tenantId: tenant.id,
      action: 'CREATE',
      status: CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING,
      idempotencyKey,
      slug,
      customerId: args.customerId,
      admin,
      now,
      metaExtra: { accountingBoundary: boundary },
    });
    return {
      ok: false,
      error: boundary.error,
      tenantId: tenant.id,
      status: 'FAILED',
      retryable: true,
      accountingBoundary: boundary,
    };
  }

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.TENANT,
        resourceId: tenant.id,
        action: 'CREATE',
        status: CRM_TENANT_PROVISION_STATUS.PROVISIONING,
        idempotencyKey,
        metaJson: { slug, customerId: args.customerId || null },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // Isolation / security baseline — seed roles when available (opt-in)
  if (args.seedRoles === true) {
    try {
      const { seedDefaultRolesForTenant } = await import('@/lib/seedTenantRoles.js');
      if (typeof seedDefaultRolesForTenant === 'function') {
        await seedDefaultRolesForTenant(tenant.id, prisma);
      }
    } catch {
      /* optional in unit tests */
    }
  }

  return {
    ok: true,
    action: 'CREATE',
    tenantId: tenant.id,
    status: tenant.status || CRM_TENANT_PROVISION_STATUS.PROVISIONING,
    tenantCreated: true,
    tenantLinked: false,
    slug,
    accountingBoundary: boundary,
  };
}

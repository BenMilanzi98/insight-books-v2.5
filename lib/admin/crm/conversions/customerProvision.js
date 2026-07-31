/**
 * CREATE_OR_LINK_PLATFORM_CUSTOMER step — Phase 16 Wave 2 / Phase 20 Wave 2.
 * Reuses platformCustomer when present; else typed NOT_AVAILABLE (no fabricate ACTIVE).
 * EXACT_MATCH always blocks auto-create (server gate; no forged CREATE / fallthrough).
 * Concurrent resume: re-read resource before CREATE; P2002 → idempotent replay.
 */

import { CRM_CUSTOMER_MATCH_STATE, CRM_CONVERSION_RESOURCE_TYPE } from './catalogue.js';
import {
  decideCustomerCreateOrLink,
  isExactCustomerMatch,
  isExactOrHighConfidenceMatch,
  matchPlatformCustomer,
} from './customerMatch.js';
import { resolveConversionActor } from './model.js';

function normalizeDecisionAction(decision) {
  const d = String(decision?.decision || decision?.action || '').toUpperCase();
  if (
    d === 'LINK' ||
    d === CRM_CUSTOMER_MATCH_STATE.LINK_EXISTING ||
    d === 'LINK_EXISTING'
  ) {
    return 'LINK';
  }
  if (
    d === 'CREATE' ||
    d === CRM_CUSTOMER_MATCH_STATE.CREATE_NEW ||
    d === 'CREATE_NEW'
  ) {
    return 'CREATE';
  }
  return d || null;
}

function isUniqueConstraintError(err) {
  return Boolean(
    err &&
      typeof err === 'object' &&
      (err.code === 'P2002' ||
        /unique constraint/i.test(String(err.message || '')))
  );
}

function hasPlatformCustomerModel(prisma) {
  return typeof prisma?.platformCustomer?.create === 'function';
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

async function findExistingResource(prisma, conversionId, idempotencyKey) {
  if (!hasResourceModel(prisma) || !idempotencyKey) return null;
  return prisma.crmConversionResource.findFirst({
    where: {
      conversionId,
      resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_CUSTOMER,
      idempotencyKey,
    },
  });
}

function replayFromResource(existingRes) {
  return {
    ok: true,
    action: existingRes.action || 'LINK',
    customerId: existingRes.resourceId,
    idempotentReplay: true,
    status: existingRes.status || 'LINKED',
    customerCreated: existingRes.action === 'CREATE',
    customerLinked: existingRes.action === 'LINK',
  };
}

/**
 * Create or link platform customer from audited decision.
 */
export async function createOrLinkPlatformCustomer(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : conversionId
      ? `customer:${conversionId}`
      : null;

  const existingRes = await findExistingResource(
    prisma,
    conversionId,
    idempotencyKey
  );
  if (existingRes?.resourceId) {
    return replayFromResource(existingRes);
  }

  let match = args.match;
  if (!match) {
    match = await matchPlatformCustomer(prisma, {
      accountId: args.accountId,
      evidence: args.evidence,
    });
  }

  let decision = args.decision;
  if (!decision || decision.ok === undefined) {
    const inferredAction =
      match.matchState === CRM_CUSTOMER_MATCH_STATE.NO_MATCH ? 'CREATE' : 'LINK';
    decision = await decideCustomerCreateOrLink(prisma, {
      conversionId,
      match,
      admin,
      action: args.action || inferredAction,
      now: args.now,
    });
  }

  const decisionAction = normalizeDecisionAction(decision);

  // Exact / high-confidence identity: LINK only — never CREATE and never fall through.
  if (isExactOrHighConfidenceMatch(match.matchState)) {
    if (decisionAction !== 'LINK') {
      return {
        ok: false,
        error: isExactCustomerMatch(match.matchState)
          ? 'exact_match_blocks_auto_create'
          : 'exact_or_high_confidence_requires_link',
        requiresReview: isExactCustomerMatch(match.matchState),
        matchState: match.matchState,
        status: 'BLOCKED',
      };
    }
  }

  if (!decision.ok) {
    return {
      ok: false,
      error: decision.error || 'customer_decision_blocked',
      requiresReview: decision.requiresReview,
      matchState: match.matchState,
      status: 'BLOCKED',
    };
  }

  // Fail closed: only LINK_EXISTING or explicit approved CREATE_NEW.
  if (decisionAction !== 'LINK' && decisionAction !== 'CREATE') {
    return {
      ok: false,
      error: 'invalid_customer_decision',
      requiresReview: true,
      matchState: match.matchState,
      status: 'BLOCKED',
    };
  }

  if (decisionAction === 'LINK') {
    const customerId = decision.customerId || match.primaryCandidateId;
    if (!customerId) {
      return { ok: false, error: 'link_target_missing', status: 'NOT_AVAILABLE' };
    }
    if (hasResourceModel(prisma) && conversionId) {
      try {
        await prisma.crmConversionResource.create({
          data: {
            conversionId,
            resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_CUSTOMER,
            resourceId: customerId,
            action: 'LINK',
            status: 'LINKED',
            idempotencyKey,
            actorAdminId: admin?.id || null,
            createdAt: args.now || new Date(),
            updatedAt: args.now || new Date(),
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          const raced = await findExistingResource(
            prisma,
            conversionId,
            idempotencyKey
          );
          if (raced?.resourceId) return replayFromResource(raced);
        }
        throw err;
      }
    }
    if (
      args.accountId &&
      typeof prisma?.crmAccount?.update === 'function'
    ) {
      try {
        await prisma.crmAccount.update({
          where: { id: args.accountId },
          data: { customerId },
        });
      } catch {
        /* best-effort link on CRM Account */
      }
    }
    return {
      ok: true,
      action: 'LINK',
      customerId,
      customerLinked: true,
      customerCreated: false,
      status: 'LINKED',
    };
  }

  // CREATE — only reached for explicit CREATE / CREATE_NEW after gates above.
  if (!hasPlatformCustomerModel(prisma)) {
    return {
      ok: false,
      error: 'platform_customer_model_unavailable',
      status: 'NOT_AVAILABLE',
    };
  }

  // TOCTOU: re-read resource immediately before create (concurrent resume).
  const racedBeforeCreate = await findExistingResource(
    prisma,
    conversionId,
    idempotencyKey
  );
  if (racedBeforeCreate?.resourceId) {
    return replayFromResource(racedBeforeCreate);
  }

  const evidence = match.evidence || args.evidence || {};
  const created = await prisma.platformCustomer.create({
    data: {
      displayName:
        evidence.displayName || args.displayName || 'Conversion Customer',
      registrationNumber: evidence.registrationNumber || null,
      taxId: evidence.taxId || null,
      domain: evidence.domain || null,
      accountId: args.accountId || null,
      status: 'PROVISIONING',
      createdByAdminId: admin?.id || null,
      createdAt: args.now || new Date(),
      updatedAt: args.now || new Date(),
    },
  });

  if (hasResourceModel(prisma) && conversionId) {
    try {
      await prisma.crmConversionResource.create({
        data: {
          conversionId,
          resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_CUSTOMER,
          resourceId: created.id,
          action: 'CREATE',
          status: 'PROVISIONING',
          idempotencyKey,
          actorAdminId: admin?.id || null,
          createdAt: args.now || new Date(),
          updatedAt: args.now || new Date(),
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        const raced = await findExistingResource(
          prisma,
          conversionId,
          idempotencyKey
        );
        if (raced?.resourceId) {
          return replayFromResource(raced);
        }
      }
      throw err;
    }
  }

  if (args.accountId && typeof prisma?.crmAccount?.update === 'function') {
    try {
      await prisma.crmAccount.update({
        where: { id: args.accountId },
        data: { customerId: created.id },
      });
    } catch {
      /* best-effort */
    }
  }

  return {
    ok: true,
    action: 'CREATE',
    customerId: created.id,
    customerCreated: true,
    customerLinked: false,
    status: created.status || 'PROVISIONING',
  };
}

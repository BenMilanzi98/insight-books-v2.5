/**
 * Closed-Won readiness evaluation — Phase 15 Wave 4 / Phase 20 Wave 1 harden.
 * Driven by acceptance evidence (version + checksum + authority status).
 * Acceptance ≠ Closed Won. Never auto-mutates Opportunity.
 * Expired / superseded / UNKNOWN authority / unapproved discounts block READY.
 */

import { CRM_READINESS_STATUS, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import {
  CRM_ACCEPTANCE_AUTHORITY_STATUS,
  evaluateAcceptanceAuthorityStatus,
} from './acceptance.js';
import {
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  CRM_DISCOUNT_REQUEST_STATUS,
  getCommercialDomainContract,
} from './catalogue.js';
import { hasCrmCommercialAcceptanceModel } from './model.js';

export const CLOSED_WON_READINESS_VERSION = 'crm-closed-won-readiness-v2-2026-07-31';

const TERMINAL_BAD_VERSION = new Set([
  CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.WITHDRAWN,
  CRM_COMMERCIAL_DOCUMENT_STATUS.REJECTED,
]);

function item(key, ok, severity, detail, blocker = false) {
  return {
    key,
    ok: Boolean(ok),
    severity: severity || (ok ? 'INFO' : 'WARN'),
    detail: detail || null,
    blocker: Boolean(blocker),
  };
}

function deriveStatus(items) {
  const blockers = items.filter((i) => i.blocker && !i.ok);
  if (blockers.some((i) => i.key === 'acceptance_authority_status')) {
    const auth = blockers.find((i) => i.key === 'acceptance_authority_status');
    if (String(auth?.detail || '').includes('UNKNOWN')) {
      return CRM_READINESS_STATUS.UNKNOWN;
    }
  }
  if (
    blockers.some(
      (i) =>
        i.key === 'discount_approvals' ||
        i.key === 'material_discount_approved' ||
        i.key === 'discount_approval_sod'
    )
  ) {
    return CRM_READINESS_STATUS.APPROVAL_REQUIRED;
  }
  if (blockers.length > 0) return CRM_READINESS_STATUS.BLOCKED;
  const failed = items.filter((i) => !i.ok);
  if (failed.length === 0) return CRM_READINESS_STATUS.READY;
  const requiredFailed = failed.filter((i) => i.severity !== 'INFO');
  if (requiredFailed.length === 0) return CRM_READINESS_STATUS.PARTIALLY_READY;
  const allSoft = requiredFailed.every((i) => i.severity === 'WARN');
  if (allSoft && requiredFailed.length < items.length) {
    return CRM_READINESS_STATUS.PARTIALLY_READY;
  }
  return CRM_READINESS_STATUS.NOT_READY;
}

export function hasCrmClosedWonConversionHandoffModel(prisma) {
  return typeof prisma?.crmClosedWonConversionHandoff?.create === 'function';
}

/**
 * Policy (Phase 20): only PENDING / open required-unapproved material discounts
 * block READY. REJECTED and CANCELLED are terminal non-applied and must not
 * keep READY blocked. APPROVED rows are re-checked for SoD (requester ≠ approver).
 */
function isMaterialDiscount(r) {
  return (
    r.requiresApproval === true ||
    (Number.isFinite(Number(r.percent)) && Number(r.percent) > 10)
  );
}

function isPendingUnapprovedDiscount(r) {
  if (!isMaterialDiscount(r)) return false;
  const status = String(r.status || '').toUpperCase();
  if (
    status === CRM_DISCOUNT_REQUEST_STATUS.REJECTED ||
    status === CRM_DISCOUNT_REQUEST_STATUS.CANCELLED ||
    status === CRM_DISCOUNT_REQUEST_STATUS.APPROVED
  ) {
    return false;
  }
  // PENDING or unrecognized open status → blocks
  return (
    status === CRM_DISCOUNT_REQUEST_STATUS.PENDING ||
    status === '' ||
    !status
  );
}

function violatesDiscountApprovalSod(r) {
  if (!isMaterialDiscount(r)) return false;
  const status = String(r.status || '').toUpperCase();
  if (status !== CRM_DISCOUNT_REQUEST_STATUS.APPROVED) return false;
  const requesterId = r.requestedByAdminId ? String(r.requestedByAdminId) : '';
  const approverId = r.approvedByAdminId ? String(r.approvedByAdminId) : '';
  if (!approverId) return true;
  if (requesterId && requesterId === approverId) return true;
  return false;
}

async function collectDiscountApprovalItems(prisma, args, acceptance) {
  const items = [];
  const requireDiscounts =
    args.requireDiscountApprovals === true ||
    args.requireDiscountApprovals == null; // default on when model present

  if (!requireDiscounts) return items;
  if (typeof prisma?.crmDiscountRequest?.findMany !== 'function') return items;

  // CrmDiscountRequest is keyed by documentVersionId (no opportunityId column).
  const documentVersionId = acceptance?.documentVersionId
    ? String(acceptance.documentVersionId).trim()
    : null;

  if (!documentVersionId) {
    items.push(
      item(
        'discount_approvals',
        true,
        'INFO',
        'No document version for discount scope',
        false
      )
    );
    return items;
  }

  let rows = [];
  try {
    rows = await prisma.crmDiscountRequest.findMany({
      where: { documentVersionId },
    });
  } catch {
    rows = [];
  }

  const materialPending = (rows || []).filter(isPendingUnapprovedDiscount);
  const sodViolations = (rows || []).filter(violatesDiscountApprovalSod);

  if (materialPending.length === 0 && sodViolations.length === 0) {
    items.push(
      item(
        'discount_approvals',
        true,
        'INFO',
        'No pending/required-unapproved material discounts',
        false
      )
    );
    return items;
  }

  if (materialPending.length > 0) {
    items.push(
      item(
        'discount_approvals',
        false,
        'CRITICAL',
        `${materialPending.length} pending/required-unapproved material discount(s)`,
        true
      )
    );
    items.push(
      item(
        'material_discount_approved',
        false,
        'CRITICAL',
        materialPending.map((r) => r.id).join(',') || 'pending',
        true
      )
    );
  }

  if (sodViolations.length > 0) {
    items.push(
      item(
        'discount_approval_sod',
        false,
        'CRITICAL',
        `SoD failed on ${sodViolations.length} approved discount(s) — requester must differ from approver`,
        true
      )
    );
  }

  return items;
}

/**
 * Evaluate Closed-Won readiness from an acceptance record.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ acceptanceId: string, admin?: object, opportunityId?: string, requireDiscountApprovals?: boolean }} args
 */
export async function evaluateClosedWonReadiness(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewOpportunities &&
    !access.canView &&
    !access.isSuperAdmin
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_closed_won_readiness_forbidden',
    };
  }

  if (!hasCrmCommercialAcceptanceModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_acceptance_model_unavailable',
      status: 'UNAVAILABLE',
      readinessStatus: CRM_READINESS_STATUS.UNKNOWN,
    };
  }

  const acceptanceId = args.acceptanceId ? String(args.acceptanceId).trim() : '';
  if (!acceptanceId) {
    return {
      ok: false,
      error: 'acceptanceId_required',
      readinessStatus: CRM_READINESS_STATUS.UNKNOWN,
    };
  }

  const acceptance = await prisma.crmCommercialAcceptance.findUnique({
    where: { id: acceptanceId },
  });
  if (!acceptance) {
    return {
      ok: false,
      notFound: true,
      error: 'acceptance_not_found',
      readinessStatus: CRM_READINESS_STATUS.UNKNOWN,
    };
  }

  // Prior handoff is historical signal only — still re-check commercial version
  // expiry/supersede and authority. HANDED_OFF must not invent READY when truth is bad.
  let priorHandoff = null;
  if (hasCrmClosedWonConversionHandoffModel(prisma)) {
    priorHandoff = await prisma.crmClosedWonConversionHandoff.findFirst({
      where: { acceptanceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  const versionOk = Boolean(acceptance.documentVersionId);
  const checksumOk = Boolean(
    acceptance.checksumSha256 && String(acceptance.checksumSha256).trim()
  );
  const authorityRoleOk = Boolean(
    acceptance.authorityRole && String(acceptance.authorityRole).trim()
  );
  const authorityEval = evaluateAcceptanceAuthorityStatus(acceptance);
  const authorityStatusOk = authorityEval.ok === true;
  const artifactOk = Boolean(acceptance.artifactId);

  const items = [
    item(
      'acceptance_version',
      versionOk,
      versionOk ? 'INFO' : 'CRITICAL',
      versionOk
        ? `Version ${acceptance.documentVersionId}`
        : 'Acceptance missing documentVersionId',
      !versionOk
    ),
    item(
      'acceptance_checksum',
      checksumOk,
      checksumOk ? 'INFO' : 'CRITICAL',
      checksumOk ? 'Checksum bound' : 'Acceptance missing checksum',
      !checksumOk
    ),
    item(
      'acceptance_authority',
      authorityRoleOk,
      authorityRoleOk ? 'INFO' : 'CRITICAL',
      authorityRoleOk
        ? `Authority ${acceptance.authorityRole}`
        : 'Acceptance missing authority role',
      !authorityRoleOk
    ),
    item(
      'acceptance_authority_status',
      authorityStatusOk,
      authorityStatusOk ? 'INFO' : 'CRITICAL',
      authorityStatusOk
        ? `Authority ${CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED}`
        : `Authority ${authorityEval.status} — blocks Closed-Won`,
      !authorityStatusOk
    ),
    item(
      'acceptance_artifact',
      artifactOk,
      artifactOk ? 'INFO' : 'WARN',
      artifactOk ? `Artifact ${acceptance.artifactId}` : 'Artifact missing (soft)',
      false
    ),
  ];

  // Version existence + expired/superseded/withdrawn hard blocks
  if (
    versionOk &&
    typeof prisma.crmCommercialDocumentVersion?.findUnique === 'function'
  ) {
    const version = await prisma.crmCommercialDocumentVersion.findUnique({
      where: { id: acceptance.documentVersionId },
    });
    const versionStatusOk = Boolean(version);
    items.push(
      item(
        'version_exists',
        versionStatusOk,
        versionStatusOk ? 'INFO' : 'CRITICAL',
        versionStatusOk ? 'Document version present' : 'Document version missing',
        !versionStatusOk
      )
    );

    if (version) {
      const status = String(version.status || '').toUpperCase();
      const expired = status === CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED;
      const superseded = status === CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED;
      const bad = TERMINAL_BAD_VERSION.has(status);

      items.push(
        item(
          'commercial_version_status',
          !bad,
          bad ? 'CRITICAL' : 'INFO',
          bad ? `Version status ${status} blocks Closed-Won` : `Version status ${status}`,
          bad
        )
      );
      items.push(
        item(
          'version_not_expired',
          !expired,
          expired ? 'CRITICAL' : 'INFO',
          expired ? 'Commercial version expired' : 'Version not expired',
          expired
        )
      );
      items.push(
        item(
          'version_not_superseded',
          !superseded,
          superseded ? 'CRITICAL' : 'INFO',
          superseded ? 'Commercial version superseded' : 'Version not superseded',
          superseded
        )
      );

      // expiresAt in the past even if status not yet flipped
      if (version.expiresAt && new Date(version.expiresAt) < (args.now || new Date())) {
        items.push(
          item(
            'version_not_expired',
            false,
            'CRITICAL',
            'Commercial version expiresAt passed',
            true
          )
        );
      }
    }
  }

  const discountItems = await collectDiscountApprovalItems(prisma, args, acceptance);
  items.push(...discountItems);

  if (priorHandoff) {
    items.push(
      item(
        'phase16_handoff',
        true,
        'INFO',
        'Handoff already emitted (historical; commercial truth re-checked)',
        false
      )
    );
  }

  let readinessStatus = deriveStatus(items);
  // HANDED_OFF only when commercial truth still passes; expired/superseded/authority
  // blockers keep BLOCKED/NOT_READY/UNKNOWN even if a prior handoff exists.
  if (
    priorHandoff &&
    readinessStatus === CRM_READINESS_STATUS.READY
  ) {
    readinessStatus = CRM_READINESS_STATUS.HANDED_OFF;
  }

  const passesReady =
    readinessStatus === CRM_READINESS_STATUS.READY ||
    readinessStatus === CRM_READINESS_STATUS.HANDED_OFF;

  return {
    ok: true,
    readinessStatus,
    ready: passesReady,
    checklist: items,
    acceptanceId,
    documentVersionId: acceptance.documentVersionId,
    artifactId: acceptance.artifactId,
    checksumSha256: acceptance.checksumSha256,
    authorityRole: acceptance.authorityRole,
    authorityStatus: authorityEval.status,
    handoffId: priorHandoff?.id || null,
    closedWon: false,
    conversionExecuted: false,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    domain: getCommercialDomainContract(),
    meta: {
      definitionVersion: CLOSED_WON_READINESS_VERSION,
      inventClosedWonForbidden: true,
      autoOpportunityMutationForbidden: true,
      unknownNeverReady: true,
      handedOffDoesNotBypassCommercialTruth: true,
      eventTypeHint: CRM_TIMELINE_EVENT_TYPE.CLOSED_WON_READINESS,
    },
  };
}

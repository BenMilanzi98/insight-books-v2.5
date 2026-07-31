/**
 * Commercial document acceptance — Phase 15 Wave 3 / Phase 20 Wave 1 harden.
 * Requires exact version + artifact + checksum + recipient + authority.
 * Idempotent. Never fabricates. Acceptance ≠ Closed Won.
 * View / open / silence never count as acceptance.
 */

import {
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
} from './catalogue.js';
import { loadArtifactChecksum } from './artifacts.js';
import { resolveReviewAccessByToken } from './reviewAccess.js';
import {
  buildCommercialAcceptanceWriteData,
  hasCrmCommercialAcceptanceAuthorityStatusField,
  hasCrmCommercialAcceptanceModel as hasAcceptanceModel,
  normalizeAcceptanceAuthorityStatus,
  serializeCommercialAcceptance,
} from './model.js';

/** Phase 20 — authority presence ≠ VERIFIED */
export const CRM_ACCEPTANCE_AUTHORITY_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  UNKNOWN: 'UNKNOWN',
});

export function hasCrmCommercialAcceptanceModel(prisma) {
  return hasAcceptanceModel(prisma);
}

export function serializeAcceptance(row) {
  if (!row) return null;
  const base = serializeCommercialAcceptance(row);
  return {
    ...base,
    // Prefer persisted column; never invent VERIFIED from role alone
    authorityStatus: normalizeAcceptanceAuthorityStatus(
      row.authorityStatus != null
        ? row.authorityStatus
        : evaluateAcceptanceAuthorityStatus(row).status
    ),
  };
}

/**
 * Resolve authority status. Role string alone never implies VERIFIED.
 * @param {{ authorityStatus?: string, authorityRole?: string }} input
 */
export function evaluateAcceptanceAuthorityStatus(input = {}) {
  const explicit = String(input?.authorityStatus || '')
    .trim()
    .toUpperCase();
  if (explicit === CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED) {
    return { ok: true, status: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED };
  }
  if (explicit === CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFICATION_REQUIRED) {
    return {
      ok: false,
      status: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFICATION_REQUIRED,
      error: 'authority_verification_required',
    };
  }
  if (explicit === CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN) {
    return {
      ok: false,
      status: CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN,
      error: 'authority_unknown',
    };
  }
  // Missing / unrecognized status — UNKNOWN ≠ VERIFIED even if role present
  return {
    ok: false,
    status: CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN,
    error: 'authority_unknown',
  };
}

/**
 * Engagement (view/open/silence) must never be treated as acceptance.
 * @param {{ engagementType?: string, documentVersionId?: string }} args
 */
export function assertEngagementIsNotAcceptance(args = {}) {
  const type = String(args.engagementType || args.type || '')
    .trim()
    .toUpperCase();
  const blocked = new Set([
    'VIEW',
    'VIEWED',
    'OPEN',
    'OPENED',
    'SILENCE',
    'NO_RESPONSE',
    'EMAIL_OPEN',
    'LINK_OPEN',
  ]);
  if (!type || blocked.has(type)) {
    return {
      ok: false,
      error: 'engagement_is_not_acceptance',
      engagementType: type || 'UNKNOWN',
      documentVersionId: args.documentVersionId || null,
      acceptance: null,
    };
  }
  return {
    ok: false,
    error: 'engagement_is_not_acceptance',
    engagementType: type,
    documentVersionId: args.documentVersionId || null,
    acceptance: null,
  };
}

const ACCEPTABLE = new Set([
  CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.DELIVERED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.VIEWED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.CUSTOMER_REVIEW,
]);

/**
 * Authority for protected acceptance must come from the verified recipient role.
 * Empty / missing role is UNVERIFIED and never satisfies acceptance.
 */
export function evaluateAcceptanceAuthority(recipient, claimedRole = '') {
  const verifiedRole = String(recipient?.authorityRole || '')
    .trim()
    .toUpperCase();
  if (!verifiedRole) {
    return {
      ok: false,
      error: 'authority_unverified',
      status: 'UNVERIFIED',
    };
  }
  const claimed = claimedRole ? String(claimedRole).trim().toUpperCase() : '';
  if (claimed && claimed !== verifiedRole) {
    return { ok: false, error: 'authority_mismatch' };
  }
  return { ok: true, authorityRole: verifiedRole };
}

export async function acceptCommercialDocument(prisma, args = {}) {
  if (!hasCrmCommercialAcceptanceModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_acceptance_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  // Critical: authorityStatus must persist — refuse mock-only / pre-column clients
  if (!hasCrmCommercialAcceptanceAuthorityStatusField(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_acceptance_authority_status_unavailable',
      status: 'UNAVAILABLE',
      detail:
        'CrmCommercialAcceptance.authorityStatus required — apply prisma schema / scripts/sql/crm-commercial-phase20-wave1.sql',
    };
  }

  // Hard deny: view/open/silence inference paths never create acceptance
  if (
    args.inferFromView === true ||
    args.silenceAsAcceptance === true ||
    args.inferFromOpen === true ||
    args.inferFromEngagement === true
  ) {
    return {
      ok: false,
      error: 'engagement_is_not_acceptance',
      inferred: false,
      acceptance: null,
    };
  }

  const now = args.now || new Date();
  let documentVersionId = args.documentVersionId || args.commercialDocumentVersionId || null;
  let artifactId = args.artifactId || null;
  let checksumSha256 = args.checksumSha256
    ? String(args.checksumSha256).trim().toLowerCase()
    : '';
  let recipientId = args.recipientId || null;
  const claimedAuthorityRole = args.authorityRole
    ? String(args.authorityRole).trim().toUpperCase()
    : '';

  // Token path: resolve → bind version/recipient/artifact/checksum; reject unknown/expired/revoked
  if (args.token) {
    const resolved = await resolveReviewAccessByToken(prisma, args.token, { now });
    if (!resolved.ok) return resolved;
    const access = resolved.reviewAccess;
    if (documentVersionId && documentVersionId !== access.documentVersionId) {
      return { ok: false, error: 'document_version_token_mismatch' };
    }
    if (recipientId && access.recipientId && recipientId !== access.recipientId) {
      return { ok: false, error: 'recipient_token_mismatch' };
    }
    if (artifactId && access.artifactId && artifactId !== access.artifactId) {
      return { ok: false, error: 'artifact_token_mismatch' };
    }
    if (
      checksumSha256 &&
      access.checksumSha256 &&
      checksumSha256 !== String(access.checksumSha256).trim().toLowerCase()
    ) {
      return { ok: false, error: 'checksum_token_mismatch' };
    }
    documentVersionId = access.documentVersionId;
    recipientId = access.recipientId;
    artifactId = access.artifactId || artifactId;
    checksumSha256 = access.checksumSha256
      ? String(access.checksumSha256).trim().toLowerCase()
      : checksumSha256;
  }

  if (!documentVersionId) return { ok: false, error: 'documentVersionId_required' };
  if (!artifactId) return { ok: false, error: 'artifactId_required' };
  if (!checksumSha256) return { ok: false, error: 'checksum_required' };
  if (!recipientId) return { ok: false, error: 'recipientId_required' };

  const idempotencyKey = args.idempotencyKey ? String(args.idempotencyKey).trim() : '';
  if (idempotencyKey) {
    const existing = await prisma.crmCommercialAcceptance.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        alreadyExists: true,
        acceptance: serializeAcceptance(existing),
        domain: getCommercialDomainContract(),
      };
    }
  }

  const version = await prisma.crmCommercialDocumentVersion.findUnique({
    where: { id: documentVersionId },
  });
  if (!version) return { ok: false, error: 'document_version_not_found' };

  if (version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED) {
    return { ok: false, error: 'version_superseded' };
  }
  if (version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.WITHDRAWN) {
    return { ok: false, error: 'version_withdrawn' };
  }
  if (version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED) {
    return { ok: false, error: 'version_expired' };
  }
  if (version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.REJECTED) {
    return { ok: false, error: 'version_rejected' };
  }
  if (version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.ACCEPTED) {
    // Idempotent accept of already accepted if same binding
    const prior = await prisma.crmCommercialAcceptance.findFirst({
      where: { documentVersionId },
      orderBy: { createdAt: 'desc' },
    });
    if (prior && prior.checksumSha256 === checksumSha256 && prior.artifactId === artifactId) {
      return {
        ok: true,
        alreadyExists: true,
        acceptance: serializeAcceptance(prior),
        domain: getCommercialDomainContract(),
      };
    }
    return { ok: false, error: 'version_already_accepted' };
  }
  if (!ACCEPTABLE.has(version.status)) {
    return { ok: false, error: `version_not_acceptable:${version.status}` };
  }

  // Review access must be active (not revoked, not expired) for this version+recipient
  if (typeof prisma.crmCommercialReviewAccess?.findFirst === 'function') {
    const access = await prisma.crmCommercialReviewAccess.findFirst({
      where: {
        documentVersionId,
        recipientId,
        revokedAt: null,
      },
    });
    if (!access) {
      return { ok: false, error: 'review_access_revoked' };
    }
    if (access.expiresAt && new Date(access.expiresAt) < now) {
      return { ok: false, error: 'review_access_expired' };
    }
  }

  const artifact = await prisma.crmCommercialArtifact.findUnique({
    where: { id: artifactId },
  });
  if (!artifact) return { ok: false, error: 'artifact_not_found' };
  if ((artifact.versionId || artifact.documentVersionId) !== documentVersionId) {
    return { ok: false, error: 'artifact_version_mismatch' };
  }

  const stored = await loadArtifactChecksum(prisma, artifactId);
  if (!stored?.sha256) return { ok: false, error: 'checksum_missing_on_artifact' };
  if (String(stored.sha256).toLowerCase() !== checksumSha256) {
    return { ok: false, error: 'checksum_mismatch' };
  }

  // Authority: evaluate from verified recipient role only (never default empty → SIGNATORY)
  if (typeof prisma.crmCommercialRecipient?.findUnique !== 'function') {
    return { ok: false, error: 'recipient_model_unavailable', status: 'UNAVAILABLE' };
  }
  const recipient = await prisma.crmCommercialRecipient.findUnique({
    where: { id: recipientId },
  });
  if (!recipient) return { ok: false, error: 'recipient_not_found' };
  const authority = evaluateAcceptanceAuthority(recipient, claimedAuthorityRole);
  if (!authority.ok) return authority;
  const authorityRole = authority.authorityRole;

  const row = await prisma.crmCommercialAcceptance.create({
    data: buildCommercialAcceptanceWriteData({
      documentVersionId,
      artifactId,
      checksumSha256,
      recipientId,
      authorityRole,
      authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
      acceptedAt: now,
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
      updatedAt: now,
    }),
  });

  await prisma.crmCommercialDocumentVersion.update({
    where: { id: documentVersionId },
    data: {
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.ACCEPTED,
      immutable: true,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    acceptance: serializeAcceptance(row),
    closedWon: false,
    domain: getCommercialDomainContract(),
  };
}

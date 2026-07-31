/**
 * Commercial document versioning + issued immutability foundation — Phase 15 Wave 1.
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
  isIssuedOrBeyond,
} from './catalogue.js';
import { canEditCommercial, loadCommercialDocument } from './documents.js';
import { formatDocumentVersionLabel } from './numbering.js';
import {
  hasCrmCommercialDocumentVersionModel,
  resolveCommercialActor,
  serializeDocumentVersion,
} from './model.js';

export async function loadDocumentVersion(prisma, documentVersionId) {
  const id = documentVersionId ? String(documentVersionId).trim() : '';
  if (!id || !hasCrmCommercialDocumentVersionModel(prisma)) return null;
  try {
    return await prisma.crmCommercialDocumentVersion.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Create next draft version. Prior issued versions remain immutable.
 */
export async function createDocumentVersion(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_version_create_forbidden' };
  }
  if (!hasCrmCommercialDocumentVersionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_document_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const document = await loadCommercialDocument(prisma, args.documentId);
  if (!document) return { ok: false, notFound: true, error: 'commercial_document_not_found' };

  const now = args.now || new Date();
  const latest =
    (await prisma.crmCommercialDocumentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { versionNumber: 'desc' },
    })) || null;
  const nextNumber = (latest?.versionNumber || document.latestVersionNumber || 0) + 1;
  const versionLabel = formatDocumentVersionLabel(document.documentNumber, nextNumber);

  let contentJson = args.contentJson ?? null;
  if (contentJson == null && latest?.contentJson != null) {
    contentJson = latest.contentJson;
  }

  const version = await prisma.crmCommercialDocumentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: nextNumber,
      versionLabel,
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.DRAFT,
      contentJson,
      revisionReason:
        args.revisionReason != null
          ? String(args.revisionReason).trim().slice(0, 1000)
          : null,
      immutable: false,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.crmCommercialDocument.update({
    where: { id: document.id },
    data: {
      currentVersionId: version.id,
      latestVersionNumber: nextNumber,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: document.opportunityId
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: document.opportunityId || document.accountId || document.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.COMMERCIAL_DOCUMENT_VERSION_CREATED,
    summary: `Commercial document version ${versionLabel} created`,
    payload: {
      documentId: document.id,
      versionId: version.id,
      versionNumber: nextNumber,
    },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    version: serializeDocumentVersion(version),
    domain: getCommercialDomainContract(),
  };
}

/**
 * Mutate draft/non-issued version content. Issued → throws.
 */
export async function updateDocumentVersionContent(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_version_edit_forbidden' };
  }

  const version = await loadDocumentVersion(prisma, args.documentVersionId);
  if (!version) return { ok: false, notFound: true, error: 'document_version_not_found' };

  if (version.immutable === true || isIssuedOrBeyond(version.status)) {
    throw new Error(
      `issued_version_immutable: cannot mutate content of ${version.versionLabel || version.id} (status=${version.status})`
    );
  }

  const now = args.now || new Date();
  const updated = await prisma.crmCommercialDocumentVersion.update({
    where: { id: version.id },
    data: {
      contentJson: args.contentJson ?? version.contentJson,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    version: serializeDocumentVersion(updated),
    domain: getCommercialDomainContract(),
  };
}

export function assertVersionMutable(version) {
  if (!version) throw new Error('document_version_not_found');
  if (version.immutable === true || isIssuedOrBeyond(version.status)) {
    throw new Error(
      `issued_version_immutable: version ${version.versionLabel || version.id} is issued/immutable`
    );
  }
  return true;
}

/**
 * CRM consent records — Phase 11 Wave 3.
 * Source-traceable; never infer GRANTED from email/phone presence alone.
 */

import {
  CRM_CONSENT_PURPOSE,
  CRM_CONSENT_PURPOSES,
  CRM_CONSENT_STATUS,
  CRM_CONSENT_STATUSES,
  CRM_DNC_FLAG,
  CRM_DNC_FLAGS,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';

const PURPOSE_SET = new Set(CRM_CONSENT_PURPOSES);
const STATUS_SET = new Set(CRM_CONSENT_STATUSES);
const DNC_SET = new Set(CRM_DNC_FLAGS);

export function hasCrmConsentRecordModel(prisma) {
  return typeof prisma?.crmConsentRecord?.create === 'function';
}

export function hasCrmDoNotContactModel(prisma) {
  return typeof prisma?.crmDoNotContact?.create === 'function';
}

export function hasCrmCommunicationPreferenceModel(prisma) {
  return typeof prisma?.crmCommunicationPreference?.create === 'function';
}

function serializeConsent(row) {
  if (!row) return null;
  return {
    id: row.id,
    contactId: row.contactId,
    purpose: row.purpose,
    status: row.status,
    source: row.source || null,
    evidence: row.evidence || null,
    channel: row.channel || null,
    grantedAt: row.grantedAt ? new Date(row.grantedAt).toISOString() : null,
    withdrawnAt: row.withdrawnAt ? new Date(row.withdrawnAt).toISOString() : null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

function serializeDnc(row) {
  if (!row) return null;
  return {
    id: row.id,
    contactId: row.contactId,
    flag: row.flag,
    reason: row.reason || null,
    source: row.source || null,
    active: row.active !== false,
    setAt: row.setAt ? new Date(row.setAt).toISOString() : null,
    setByAdminId: row.setByAdminId || null,
  };
}

/**
 * Record explicit consent (never inferred).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   contactId: string,
 *   purpose: string,
 *   status: string,
 *   source: string,
 *   evidence?: string|null,
 *   channel?: string|null,
 *   now?: Date,
 * }} args
 */
export async function recordConsent(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canManageConsent) {
    return { ok: false, forbidden: true, reason: 'crm_manage_consent_forbidden' };
  }

  if (!hasCrmConsentRecordModel(prisma)) {
    return { ok: false, error: 'crm_consent_model_unavailable', status: 'UNAVAILABLE' };
  }

  const contactId = args.contactId ? String(args.contactId).trim() : '';
  const purpose = args.purpose ? String(args.purpose).trim().toUpperCase() : '';
  const status = args.status ? String(args.status).trim().toUpperCase() : '';
  const source = args.source != null ? String(args.source).trim() : '';

  if (!contactId) return { ok: false, error: 'contactId_required' };
  if (!PURPOSE_SET.has(purpose)) return { ok: false, error: 'invalid_purpose', purpose };
  if (!STATUS_SET.has(status)) return { ok: false, error: 'invalid_status', status };
  if (!source) return { ok: false, error: 'source_required' };

  // Never silently coerce UNKNOWN → GRANTED
  if (status === CRM_CONSENT_STATUS.GRANTED && !source) {
    return { ok: false, error: 'source_required_for_granted' };
  }

  const now = args.now || new Date();
  const data = {
    contactId,
    purpose,
    status,
    source,
    evidence: args.evidence != null ? String(args.evidence) : null,
    channel: args.channel != null ? String(args.channel).toUpperCase() : null,
    createdByAdminId: args.admin?.id || null,
    grantedAt: status === CRM_CONSENT_STATUS.GRANTED ? now : null,
    withdrawnAt:
      status === CRM_CONSENT_STATUS.WITHDRAWN || status === CRM_CONSENT_STATUS.DENIED
        ? now
        : null,
    createdAt: now,
  };

  try {
    if (typeof prisma.crmConsentRecord.upsert === 'function') {
      const row = await prisma.crmConsentRecord.upsert({
        where: {
          contactId_purpose: { contactId, purpose },
        },
        create: data,
        update: {
          status,
          source,
          evidence: data.evidence,
          channel: data.channel,
          grantedAt: data.grantedAt,
          withdrawnAt: data.withdrawnAt,
          createdByAdminId: data.createdByAdminId,
        },
      });
      return { ok: true, consent: serializeConsent(row) };
    }
  } catch {
    // fall through to create
  }

  const row = await prisma.crmConsentRecord.create({ data });
  return { ok: true, consent: serializeConsent(row) };
}

/**
 * Set / clear a DNC flag (source-traceable).
 */
export async function setDoNotContact(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canManageConsent) {
    return { ok: false, forbidden: true, reason: 'crm_manage_consent_forbidden' };
  }

  if (!hasCrmDoNotContactModel(prisma)) {
    return { ok: false, error: 'crm_dnc_model_unavailable', status: 'UNAVAILABLE' };
  }

  const contactId = args.contactId ? String(args.contactId).trim() : '';
  const flag = args.flag ? String(args.flag).trim().toUpperCase() : '';
  const source = args.source != null ? String(args.source).trim() : '';
  const active = args.active !== false;

  if (!contactId) return { ok: false, error: 'contactId_required' };
  if (!DNC_SET.has(flag)) return { ok: false, error: 'invalid_dnc_flag', flag };
  if (!source) return { ok: false, error: 'source_required' };

  const now = args.now || new Date();
  const data = {
    contactId,
    flag,
    reason: args.reason != null ? String(args.reason) : null,
    source,
    active,
    setAt: now,
    setByAdminId: args.admin?.id || null,
  };

  try {
    if (typeof prisma.crmDoNotContact.upsert === 'function') {
      const row = await prisma.crmDoNotContact.upsert({
        where: { contactId_flag: { contactId, flag } },
        create: data,
        update: {
          reason: data.reason,
          source,
          active,
          setAt: now,
          setByAdminId: data.setByAdminId,
        },
      });
      return { ok: true, dnc: serializeDnc(row) };
    }
  } catch {
    // fall through
  }

  const row = await prisma.crmDoNotContact.create({ data });
  return { ok: true, dnc: serializeDnc(row) };
}

/**
 * Latest consent status for contact+purpose (UNKNOWN if none — never inferred GRANTED).
 */
export async function getConsentStatus(prisma, contactId, purpose) {
  const id = String(contactId || '').trim();
  const p = String(purpose || '').trim().toUpperCase();
  if (!id || !PURPOSE_SET.has(p)) {
    return { status: CRM_CONSENT_STATUS.UNKNOWN, source: null, inferred: false };
  }

  if (!hasCrmConsentRecordModel(prisma)) {
    return { status: CRM_CONSENT_STATUS.UNKNOWN, source: null, inferred: false };
  }

  try {
    const row = await prisma.crmConsentRecord.findFirst({
      where: { contactId: id, purpose: p },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      return { status: CRM_CONSENT_STATUS.UNKNOWN, source: null, inferred: false };
    }
    return {
      status: row.status || CRM_CONSENT_STATUS.UNKNOWN,
      source: row.source || null,
      evidence: row.evidence || null,
      inferred: false,
      consent: serializeConsent(row),
    };
  } catch {
    return { status: CRM_CONSENT_STATUS.UNKNOWN, source: null, inferred: false };
  }
}

/**
 * Active DNC flags for a contact.
 */
export async function listActiveDncFlags(prisma, contactId) {
  const id = String(contactId || '').trim();
  if (!id || !hasCrmDoNotContactModel(prisma)) return [];
  try {
    const rows = await prisma.crmDoNotContact.findMany({
      where: { contactId: id, active: true },
    });
    return (rows || []).map(serializeDnc);
  } catch {
    return [];
  }
}

export {
  serializeConsent,
  serializeDnc,
  CRM_CONSENT_PURPOSE,
  CRM_CONSENT_STATUS,
  CRM_DNC_FLAG,
};

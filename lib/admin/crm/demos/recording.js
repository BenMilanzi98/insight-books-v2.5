/**
 * Demo recording governance — Phase 14 Wave 4.
 * Request / consent / approve / deny only. Provider NOT_AVAILABLE.
 * Never fabricates recording files. RSVP ≠ recording consent. UNKNOWN ≠ GRANTED.
 */

import {
  CRM_CONSENT_PURPOSE,
  CRM_CONSENT_STATUS,
  CRM_DEMO_RECORDING_GOV_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { getConsentStatus, recordConsent } from '../consent.js';
import { appendTimelineEvent } from '../timeline.js';
import { getDemoDomainContract } from './catalogue.js';
import { canEditDemos, canViewDemos, loadDemo } from './service.js';

export const CRM_DEMO_RECORDING_PROVIDER_STATUS = 'NOT_AVAILABLE';

export function hasCrmDemoRecordingGovModel(prisma) {
  return typeof prisma?.crmDemoRecordingGov?.create === 'function';
}

export function serializeRecordingGov(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    status: row.status,
    consentStatus: row.consentStatus || CRM_CONSENT_STATUS.UNKNOWN,
    contactId: row.contactId || null,
    requestedByAdminId: row.requestedByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    deniedByAdminId: row.deniedByAdminId || null,
    requestedAt: row.requestedAt ? new Date(row.requestedAt).toISOString() : null,
    decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
    providerStatus: row.providerStatus || CRM_DEMO_RECORDING_PROVIDER_STATUS,
    mediaFileId: null,
    mediaAvailable: false,
    notes: row.notes || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function loadOrCreateGov(prisma, demo, { adminId, now, idempotencyKey }) {
  if (idempotencyKey) {
    const byKey = await prisma.crmDemoRecordingGov.findUnique({
      where: { idempotencyKey },
    });
    if (byKey) return { row: byKey, replay: true };
  }

  const existing = await prisma.crmDemoRecordingGov.findFirst({
    where: { demoId: demo.id },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return { row: existing, replay: false };

  const row = await prisma.crmDemoRecordingGov.create({
    data: {
      demoId: demo.id,
      status: CRM_DEMO_RECORDING_GOV_STATUS.OFF,
      consentStatus: CRM_CONSENT_STATUS.UNKNOWN,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      contactId: demo.contactId || null,
      requestedByAdminId: adminId || null,
      mediaFileId: null,
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { row, replay: false };
}

/**
 * Explicit recording request — default remains OFF until requested.
 */
export async function requestDemoRecording(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_recording_forbidden' };
  }
  if (!hasCrmDemoRecordingGovModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_recording_gov_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `demo-recording-req:${demo.id}`;

  const { row, replay } = await loadOrCreateGov(prisma, demo, {
    adminId: args.admin?.id,
    now,
    idempotencyKey,
  });
  if (replay && row.status !== CRM_DEMO_RECORDING_GOV_STATUS.OFF) {
    return {
      ok: true,
      recording: serializeRecordingGov(row),
      idempotentReplay: true,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      domain: getDemoDomainContract(),
    };
  }

  const contactId = args.contactId
    ? String(args.contactId).trim()
    : demo.contactId || row.contactId || null;

  let consentStatus = CRM_CONSENT_STATUS.UNKNOWN;
  if (contactId) {
    const consent = await getConsentStatus(
      prisma,
      contactId,
      CRM_CONSENT_PURPOSE.DEMO_RECORDING
    );
    consentStatus = consent?.status || CRM_CONSENT_STATUS.UNKNOWN;
  }

  let nextStatus = CRM_DEMO_RECORDING_GOV_STATUS.REQUESTED;
  if (consentStatus === CRM_CONSENT_STATUS.GRANTED) {
    nextStatus = CRM_DEMO_RECORDING_GOV_STATUS.CONSENT_GRANTED;
  } else if (consentStatus === CRM_CONSENT_STATUS.DENIED) {
    nextStatus = CRM_DEMO_RECORDING_GOV_STATUS.CONSENT_DENIED;
  } else {
    nextStatus = CRM_DEMO_RECORDING_GOV_STATUS.CONSENT_PENDING;
  }

  const updated = await prisma.crmDemoRecordingGov.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      consentStatus,
      contactId,
      requestedByAdminId: args.admin?.id || null,
      requestedAt: now,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      mediaFileId: null,
      notes: args.notes != null ? String(args.notes).trim() : row.notes,
      idempotencyKey: row.idempotencyKey || idempotencyKey,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_RECORDING_GOV,
    summary: `Demo recording requested (${nextStatus})`,
    payload: {
      status: nextStatus,
      consentStatus,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      mediaAvailable: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    recording: serializeRecordingGov(updated),
    providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
    mediaAvailable: false,
    domain: getDemoDomainContract(),
  };
}

/**
 * Record / refresh consent for DEMO_RECORDING purpose.
 */
export async function setDemoRecordingConsent(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_recording_forbidden' };
  }
  if (!hasCrmDemoRecordingGovModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_recording_gov_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const consentStatus = String(args.consentStatus || '')
    .trim()
    .toUpperCase();
  if (
    consentStatus !== CRM_CONSENT_STATUS.GRANTED &&
    consentStatus !== CRM_CONSENT_STATUS.DENIED &&
    consentStatus !== CRM_CONSENT_STATUS.WITHDRAWN
  ) {
    return { ok: false, error: 'invalid_consent_status' };
  }

  const contactId = args.contactId
    ? String(args.contactId).trim()
    : demo.contactId || null;
  if (!contactId) return { ok: false, error: 'contactId_required' };

  // RSVP must never imply consent
  if (args.fromRsvp === true) {
    return {
      ok: false,
      error: 'rsvp_equals_recording_consent_forbidden',
      domain: getDemoDomainContract(),
    };
  }

  const now = args.now || new Date();
  // Best-effort consent plane write; governance row is authoritative for Demo recording
  try {
    await recordConsent(prisma, {
      admin: args.admin,
      contactId,
      purpose: CRM_CONSENT_PURPOSE.DEMO_RECORDING,
      status: consentStatus,
      source: args.source || 'DEMO_RECORDING_GOV',
      now,
    });
  } catch {
    // ignore — gov status still updated below
  }

  const { row } = await loadOrCreateGov(prisma, demo, {
    adminId: args.admin?.id,
    now,
  });

  const nextStatus =
    consentStatus === CRM_CONSENT_STATUS.GRANTED
      ? CRM_DEMO_RECORDING_GOV_STATUS.CONSENT_GRANTED
      : CRM_DEMO_RECORDING_GOV_STATUS.CONSENT_DENIED;

  const updated = await prisma.crmDemoRecordingGov.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      consentStatus,
      contactId,
      decidedAt: now,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      mediaFileId: null,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_RECORDING_GOV,
    summary: `Demo recording consent: ${consentStatus}`,
    payload: {
      consentStatus,
      status: nextStatus,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    recording: serializeRecordingGov(updated),
    providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
    domain: getDemoDomainContract(),
  };
}

/**
 * Governance approve — still cannot start media (provider NOT_AVAILABLE).
 */
export async function approveDemoRecording(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_recording_forbidden' };
  }
  if (!hasCrmDemoRecordingGovModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_recording_gov_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const now = args.now || new Date();
  const { row } = await loadOrCreateGov(prisma, demo, {
    adminId: args.admin?.id,
    now,
  });

  if (row.consentStatus !== CRM_CONSENT_STATUS.GRANTED) {
    return {
      ok: false,
      error: 'recording_consent_not_granted',
      consentStatus: row.consentStatus || CRM_CONSENT_STATUS.UNKNOWN,
      unknownEqualsGranted: false,
    };
  }

  // Provider always NOT_AVAILABLE — approve governance but mark provider gap
  const updated = await prisma.crmDemoRecordingGov.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_RECORDING_GOV_STATUS.PROVIDER_NOT_AVAILABLE,
      approvedByAdminId: args.admin?.id || null,
      decidedAt: now,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      mediaFileId: null,
      notes: args.notes != null ? String(args.notes).trim() : row.notes,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_RECORDING_GOV,
    summary: 'Demo recording governance approved; provider NOT_AVAILABLE',
    payload: {
      status: updated.status,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      mediaAvailable: false,
      inventRecordingFileForbidden: true,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    recording: serializeRecordingGov(updated),
    providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
    mediaAvailable: false,
    mediaStarted: false,
    domain: getDemoDomainContract(),
  };
}

export async function denyDemoRecording(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_recording_forbidden' };
  }
  if (!hasCrmDemoRecordingGovModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_recording_gov_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const now = args.now || new Date();
  const { row } = await loadOrCreateGov(prisma, demo, {
    adminId: args.admin?.id,
    now,
  });

  const updated = await prisma.crmDemoRecordingGov.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_RECORDING_GOV_STATUS.DENIED,
      deniedByAdminId: args.admin?.id || null,
      decidedAt: now,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      mediaFileId: null,
      notes: args.notes != null ? String(args.notes).trim() : row.notes,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_RECORDING_GOV,
    summary: 'Demo recording denied',
    payload: { status: CRM_DEMO_RECORDING_GOV_STATUS.DENIED, mediaAvailable: false },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    recording: serializeRecordingGov(updated),
    providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
    mediaAvailable: false,
    domain: getDemoDomainContract(),
  };
}

export async function getDemoRecordingGov(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_recording_view_forbidden' };
  }
  if (!hasCrmDemoRecordingGovModel(prisma)) {
    return {
      ok: true,
      recording: null,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      meta: { unavailable: true, status: 'UNAVAILABLE' },
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const row = await prisma.crmDemoRecordingGov.findFirst({
    where: { demoId: demo.id },
    orderBy: { createdAt: 'desc' },
  });

  return {
    ok: true,
    recording: serializeRecordingGov(row) || {
      demoId: demo.id,
      status: CRM_DEMO_RECORDING_GOV_STATUS.OFF,
      consentStatus: CRM_CONSENT_STATUS.UNKNOWN,
      providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
      mediaFileId: null,
      mediaAvailable: false,
    },
    providerStatus: CRM_DEMO_RECORDING_PROVIDER_STATUS,
    domain: getDemoDomainContract(),
  };
}

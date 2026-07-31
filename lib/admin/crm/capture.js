/**
 * CRM Lead capture — Phase 11 Wave 2.
 * Idempotent public-form + shared intake path. Never fabricates Opportunities,
 * never mutates Support/CS sources, never infers consent GRANTED.
 */

import {
  CRM_CAPTURE_SOURCE,
  CRM_PUBLIC_CAPTURE_SOURCES,
  CRM_SOURCE_CHANNEL,
  CRM_LEAD_TYPE,
  CRM_PERSON_OR_ORG,
  CRM_CONSENT_STATUS,
  CRM_CONSENT_PURPOSES,
  CRM_CAPTURE_MAX_PAYLOAD_BYTES,
  CRM_CAPTURE_MAX_MESSAGE_CHARS,
  channelAvailability,
} from './catalogue.js';
import { createLead } from './leads.js';
import { normalizeEmail, normalizePhone } from './contacts.js';
import { detectDuplicateCandidates } from './duplicates.js';

const PUBLIC_SOURCE_SET = new Set(CRM_PUBLIC_CAPTURE_SOURCES);
const ALL_CAPTURE_SOURCES = new Set(Object.values(CRM_CAPTURE_SOURCE));
const CONSENT_PURPOSE_SET = new Set(CRM_CONSENT_PURPOSES);

/** Simple process-local throttle: email → timestamps (ms). */
const throttleBuckets = new Map();
const THROTTLE_WINDOW_MS = 60_000;
const THROTTLE_MAX = 8;

export function hasCrmCaptureRecordModel(prisma) {
  return typeof prisma?.crmCaptureRecord?.findMany === 'function';
}

export function _resetCaptureThrottleForTests() {
  throttleBuckets.clear();
}

function sanitizeText(value, maxLen = 500) {
  if (value == null) return null;
  const v = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
  if (!v) return null;
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function estimatePayloadBytes(args) {
  try {
    return Buffer.byteLength(JSON.stringify(args || {}), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function emailDomain(emailNormalized) {
  if (!emailNormalized || !emailNormalized.includes('@')) return null;
  return emailNormalized.split('@')[1] || null;
}

function defaultLeadType(sourceCode) {
  switch (sourceCode) {
    case CRM_CAPTURE_SOURCE.REQUEST_DEMO:
      return CRM_LEAD_TYPE.DEMO_REQUEST;
    case CRM_CAPTURE_SOURCE.CUSTOMER_SUCCESS_HANDOFF:
    case CRM_CAPTURE_SOURCE.SUPPORT_HANDOFF:
    case CRM_CAPTURE_SOURCE.PRODUCT_SIGNAL:
      return CRM_LEAD_TYPE.EXPANSION;
    case CRM_CAPTURE_SOURCE.START_TRIAL:
    case CRM_CAPTURE_SOURCE.SALES_ENQUIRY:
    case CRM_CAPTURE_SOURCE.WEBSITE_CONTACT_FORM:
      return CRM_LEAD_TYPE.NEW_BUSINESS;
    default:
      return CRM_LEAD_TYPE.OTHER;
  }
}

/**
 * Stable source identity from source code + normalized payload (or handoff ref).
 * Client-supplied sourceIdempotencyKey is ignored — never sole/overriding identity.
 */
function buildIdempotencyKey({
  sourceCode,
  emailNormalized,
  phoneNormalized,
  handoffRefType,
  handoffRefId,
}) {
  if (handoffRefType && handoffRefId) {
    return `crm-capture:${sourceCode}:${handoffRefType}:${handoffRefId}`;
  }
  const identity = [emailNormalized || '', phoneNormalized || ''].join('|');
  return `crm-capture:${sourceCode}:${identity}`.slice(0, 200);
}

function checkThrottle(emailNormalized) {
  if (!emailNormalized) return { ok: true };
  const now = Date.now();
  const arr = (throttleBuckets.get(emailNormalized) || []).filter(
    (t) => now - t < THROTTLE_WINDOW_MS
  );
  if (arr.length >= THROTTLE_MAX) {
    return { ok: false, error: 'rate_limited' };
  }
  arr.push(now);
  throttleBuckets.set(emailNormalized, arr);
  return { ok: true };
}

function serializeCapture(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.leadId,
    sourceCode: row.sourceCode,
    channel: row.channel,
    sourceIdempotencyKey: row.sourceIdempotencyKey,
    emailNormalized: row.emailNormalized || null,
    phoneNormalized: row.phoneNormalized || null,
    handoffRefType: row.handoffRefType || null,
    handoffRefId: row.handoffRefId || null,
    businessName: row.businessName || null,
    contactName: row.contactName || null,
    consentStatus: row.consentStatus || CRM_CONSENT_STATUS.UNKNOWN,
    consentPurposes: Array.isArray(row.consentPurposes) ? row.consentPurposes : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

async function resolveCandidates(prisma, { emailNormalized, phoneNormalized, businessName }) {
  const contacts = [];
  const accounts = [];

  if (typeof prisma.crmContact?.findMany === 'function') {
    const or = [];
    if (emailNormalized) or.push({ email: emailNormalized });
    if (phoneNormalized) or.push({ phone: phoneNormalized });
    if (or.length) {
      try {
        const rows = await prisma.crmContact.findMany({ where: { OR: or }, take: 10 });
        for (const r of rows || []) {
          contacts.push({
            id: r.id,
            contactNumber: r.contactNumber,
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email || null,
            phone: r.phone || null,
            suggestOnly: true,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  if (businessName && typeof prisma.crmAccount?.findMany === 'function') {
    try {
      const rows = await prisma.crmAccount.findMany({
        where: { displayName: { contains: businessName } },
        take: 10,
      });
      for (const r of rows || []) {
        accounts.push({
          id: r.id,
          accountNumber: r.accountNumber,
          displayName: r.displayName,
          suggestOnly: true,
        });
      }
    } catch {
      // contains unsupported in some mocks — try exact filter in-memory via findMany all
      try {
        const all = await prisma.crmAccount.findMany({ take: 50 });
        const q = businessName.toLowerCase();
        for (const r of all || []) {
          if (String(r.displayName || '').toLowerCase().includes(q)) {
            accounts.push({
              id: r.id,
              accountNumber: r.accountNumber,
              displayName: r.displayName,
              suggestOnly: true,
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return { contacts, accounts };
}

async function loadExistingByKey(prisma, sourceIdempotencyKey) {
  if (!sourceIdempotencyKey) return null;
  try {
    if (typeof prisma.crmCaptureRecord?.findUnique === 'function') {
      const cap = await prisma.crmCaptureRecord.findUnique({
        where: { sourceIdempotencyKey },
      });
      if (cap?.leadId && typeof prisma.crmLead?.findUnique === 'function') {
        const lead = await prisma.crmLead.findUnique({ where: { id: cap.leadId } });
        if (lead) return { lead, capture: cap };
      }
    }
  } catch {
    // continue
  }
  try {
    if (typeof prisma.crmLead?.findUnique === 'function') {
      const lead = await prisma.crmLead.findUnique({
        where: { sourceIdempotencyKey },
      });
      if (lead) return { lead, capture: null };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Shared idempotent Lead capture.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function captureLead(prisma, args = {}) {
  // Honeypot — filled by bots; silent reject
  if (args.website || args.companyUrl || args.hp_field) {
    return { ok: false, error: 'spam_rejected' };
  }

  if (estimatePayloadBytes(args) > CRM_CAPTURE_MAX_PAYLOAD_BYTES) {
    return { ok: false, error: 'payload_too_large' };
  }

  const sourceCode = String(args.sourceCode || '').trim().toUpperCase();
  if (!ALL_CAPTURE_SOURCES.has(sourceCode)) {
    return { ok: false, error: 'invalid_source_code', sourceCode };
  }

  const channel = String(
    args.channel ||
      (PUBLIC_SOURCE_SET.has(sourceCode)
        ? CRM_SOURCE_CHANNEL.WEB_FORM
        : CRM_SOURCE_CHANNEL.INTERNAL_HANDOFF)
  )
    .trim()
    .toUpperCase();

  const availability = channelAvailability(channel);
  if (availability === 'NOT_AVAILABLE') {
    return {
      ok: false,
      status: 'NOT_AVAILABLE',
      error: 'channel_not_available',
      channel,
    };
  }
  if (
    channel === CRM_SOURCE_CHANNEL.EMAIL ||
    channel === CRM_SOURCE_CHANNEL.WHATSAPP
  ) {
    return {
      ok: false,
      status: 'NOT_AVAILABLE',
      error: 'channel_not_available',
      channel,
    };
  }

  const businessName = sanitizeText(args.businessName, 200);
  const contactName = sanitizeText(args.contactName || args.clientName, 200);
  const message = sanitizeText(args.message || args.body, CRM_CAPTURE_MAX_MESSAGE_CHARS);
  const emailNormalized = normalizeEmail(args.email);
  const phoneNormalized = normalizePhone(args.phone);

  if (!contactName && !businessName) {
    return { ok: false, error: 'contactName or businessName required' };
  }
  if (!emailNormalized && !phoneNormalized && !args.handoffRefId) {
    return { ok: false, error: 'email or phone required' };
  }

  const handoffRefType = args.handoffRefType
    ? String(args.handoffRefType).trim().toUpperCase()
    : null;
  const handoffRefId = args.handoffRefId ? String(args.handoffRefId).trim() : null;

  // Always server-derived; ignore client-supplied sourceIdempotencyKey.
  const sourceIdempotencyKey = buildIdempotencyKey({
    sourceCode,
    emailNormalized,
    phoneNormalized,
    handoffRefType,
    handoffRefId,
  });

  // Idempotent replay before throttle so exact retries are never rate-limited.
  const existing = await loadExistingByKey(prisma, sourceIdempotencyKey);
  if (existing?.lead) {
    const candidates = await resolveCandidates(prisma, {
      emailNormalized,
      phoneNormalized,
      businessName,
    });
    return {
      ok: true,
      created: false,
      idempotent: true,
      lead: {
        id: existing.lead.id,
        leadNumber: existing.lead.leadNumber,
        type: existing.lead.type,
        personOrOrganisation: existing.lead.personOrOrganisation,
        accountId: existing.lead.accountId || null,
        contactId: existing.lead.contactId || null,
        source: existing.lead.source,
        channel: existing.lead.channel,
        sourceIdempotencyKey: existing.lead.sourceIdempotencyKey || null,
        status: existing.lead.status,
        title: existing.lead.title,
        summary: existing.lead.summary || null,
        ownerAdminId: existing.lead.ownerAdminId || null,
        createdByAdminId: existing.lead.createdByAdminId || null,
        createdAt: existing.lead.createdAt
          ? new Date(existing.lead.createdAt).toISOString()
          : null,
        updatedAt: existing.lead.updatedAt
          ? new Date(existing.lead.updatedAt).toISOString()
          : null,
      },
      capture: serializeCapture(existing.capture),
      candidates,
    };
  }

  const throttle = checkThrottle(emailNormalized);
  if (!throttle.ok) return throttle;

  // Consent snapshot: never GRANTED from raw client checkbox arrays.
  // Allowlisted purposes may be stored as interest flags only; legal GRANTED requires
  // CrmConsentRecord with validated purpose + source/evidence (Wave 3 admin path).
  const purposes = Array.isArray(args.consentPurposes)
    ? [
        ...new Set(
          args.consentPurposes
            .map((p) => String(p).trim().toUpperCase())
            .filter((p) => CONSENT_PURPOSE_SET.has(p))
        ),
      ]
    : [];
  const consentStatus = CRM_CONSENT_STATUS.UNKNOWN;

  const title =
    sanitizeText(args.title, 200) ||
    [businessName, contactName, sourceCode].filter(Boolean).join(' — ').slice(0, 200);

  const summaryParts = [];
  if (message) summaryParts.push(message);
  if (args.preferredAt) summaryParts.push(`Preferred: ${sanitizeText(args.preferredAt, 80)}`);
  if (args.featureCode) summaryParts.push(`Feature: ${sanitizeText(args.featureCode, 80)}`);
  if (args.tenantId) summaryParts.push(`Tenant: ${sanitizeText(args.tenantId, 80)}`);
  const summary = summaryParts.length ? summaryParts.join('\n') : null;

  const now = args.now || new Date();
  const leadResult = await createLead(prisma, {
    capture: true,
    admin: args.admin || null,
    type: args.type || defaultLeadType(sourceCode),
    personOrOrganisation: businessName
      ? CRM_PERSON_OR_ORG.ORGANISATION
      : CRM_PERSON_OR_ORG.PERSON,
    title,
    summary,
    source: sourceCode,
    channel,
    sourceIdempotencyKey,
    // Explicitly ignore public owner/team/priority
    ownerAdminId: null,
    now,
  });

  if (!leadResult.ok) return leadResult;
  if (leadResult.idempotent || leadResult.idempotentReplay) {
    return {
      ok: true,
      created: false,
      idempotent: true,
      lead: leadResult.lead,
      capture: null,
      candidates: await resolveCandidates(prisma, {
        emailNormalized,
        phoneNormalized,
        businessName,
      }),
    };
  }

  let captureRow = null;
  if (hasCrmCaptureRecordModel(prisma)) {
    try {
      captureRow = await prisma.crmCaptureRecord.create({
        data: {
          leadId: leadResult.lead.id,
          sourceCode,
          channel,
          sourceIdempotencyKey,
          emailNormalized,
          phoneNormalized,
          handoffRefType,
          handoffRefId,
          businessName,
          contactName,
          payload: {
            preferredAt: args.preferredAt || null,
            featureCode: args.featureCode || null,
            tenantId: args.tenantId || null,
            customerId: args.customerId || null,
          },
          consentStatus,
          consentPurposes: purposes.length ? purposes : null,
          createdAt: now,
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        const again = await loadExistingByKey(prisma, sourceIdempotencyKey);
        if (again?.lead) {
          return {
            ok: true,
            created: false,
            idempotent: true,
            lead: {
              id: again.lead.id,
              leadNumber: again.lead.leadNumber,
              type: again.lead.type,
              personOrOrganisation: again.lead.personOrOrganisation,
              accountId: again.lead.accountId || null,
              contactId: again.lead.contactId || null,
              source: again.lead.source,
              channel: again.lead.channel,
              sourceIdempotencyKey: again.lead.sourceIdempotencyKey || null,
              status: again.lead.status,
              title: again.lead.title,
              summary: again.lead.summary || null,
              ownerAdminId: again.lead.ownerAdminId || null,
              createdByAdminId: again.lead.createdByAdminId || null,
              createdAt: again.lead.createdAt
                ? new Date(again.lead.createdAt).toISOString()
                : null,
              updatedAt: again.lead.updatedAt
                ? new Date(again.lead.updatedAt).toISOString()
                : null,
            },
            capture: serializeCapture(again.capture),
            candidates: await resolveCandidates(prisma, {
              emailNormalized,
              phoneNormalized,
              businessName,
            }),
          };
        }
      }
      throw err;
    }
  }

  await detectDuplicateCandidates(prisma, {
    leadId: leadResult.lead.id,
    sourceCode,
    emailNormalized,
    phoneNormalized,
    handoffRefType,
    handoffRefId,
    emailDomain: emailDomain(emailNormalized),
    now,
  });

  const candidates = await resolveCandidates(prisma, {
    emailNormalized,
    phoneNormalized,
    businessName,
  });

  return {
    ok: true,
    created: true,
    idempotent: false,
    lead: leadResult.lead,
    capture: serializeCapture(captureRow),
    candidates,
  };
}


/**
 * Communication eligibility gate — Phase 11 Wave 3.
 * checkCommunicationEligibility({ contactId, purpose, channel })
 * UNKNOWN / DENIED / WITHDRAWN / DNC → block. Never infer GRANTED.
 * Service exists even when no auto-send outbound is wired.
 */

import {
  CRM_COMMUNICATION_CHANNEL,
  CRM_CONSENT_STATUS,
  CRM_DNC_FLAG,
} from './catalogue.js';
import { getConsentStatus, listActiveDncFlags } from './consent.js';

const CHANNEL_TO_DNC = Object.freeze({
  [CRM_COMMUNICATION_CHANNEL.EMAIL]: CRM_DNC_FLAG.DO_NOT_EMAIL,
  [CRM_COMMUNICATION_CHANNEL.CALL]: CRM_DNC_FLAG.DO_NOT_CALL,
  [CRM_COMMUNICATION_CHANNEL.WHATSAPP]: CRM_DNC_FLAG.DO_NOT_WHATSAPP,
  [CRM_COMMUNICATION_CHANNEL.SMS]: CRM_DNC_FLAG.DO_NOT_SMS,
});

const BLOCKING_CONSENT = new Set([
  CRM_CONSENT_STATUS.UNKNOWN,
  CRM_CONSENT_STATUS.DENIED,
  CRM_CONSENT_STATUS.WITHDRAWN,
  CRM_CONSENT_STATUS.EXPIRED,
  CRM_CONSENT_STATUS.PENDING,
]);

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   contactId: string,
 *   purpose: string,
 *   channel: string,
 * }} args
 * @returns {Promise<{
 *   ok: boolean,
 *   eligible: boolean,
 *   reasons: string[],
 *   consentStatus: string,
 *   dncFlags: string[],
 *   inferred: false,
 * }>}
 */
export async function checkCommunicationEligibility(prisma, args = {}) {
  const contactId = args.contactId ? String(args.contactId).trim() : '';
  const purpose = args.purpose ? String(args.purpose).trim().toUpperCase() : '';
  const channel = args.channel ? String(args.channel).trim().toUpperCase() : '';

  const reasons = [];
  if (!contactId) {
    return {
      ok: false,
      eligible: false,
      reasons: ['contactId_required'],
      consentStatus: CRM_CONSENT_STATUS.UNKNOWN,
      dncFlags: [],
      inferred: false,
    };
  }
  if (!purpose) reasons.push('purpose_required');
  if (!channel) reasons.push('channel_required');
  if (reasons.length) {
    return {
      ok: false,
      eligible: false,
      reasons,
      consentStatus: CRM_CONSENT_STATUS.UNKNOWN,
      dncFlags: [],
      inferred: false,
    };
  }

  const consent = await getConsentStatus(prisma, contactId, purpose);
  const consentStatus = consent.status || CRM_CONSENT_STATUS.UNKNOWN;

  // Never infer GRANTED
  if (consent.inferred === true) {
    reasons.push('consent_inferred_forbidden');
  }

  if (BLOCKING_CONSENT.has(consentStatus)) {
    reasons.push(`consent_${consentStatus.toLowerCase()}`);
  } else if (
    consentStatus !== CRM_CONSENT_STATUS.GRANTED &&
    consentStatus !== CRM_CONSENT_STATUS.NOT_REQUIRED
  ) {
    reasons.push(`consent_${String(consentStatus).toLowerCase()}`);
  }

  const dncRows = await listActiveDncFlags(prisma, contactId);
  const dncFlags = dncRows.map((r) => r.flag);
  if (dncFlags.includes(CRM_DNC_FLAG.DO_NOT_CONTACT_ALL)) {
    reasons.push('dnc_do_not_contact_all');
  }
  const channelDnc = CHANNEL_TO_DNC[channel];
  if (channelDnc && dncFlags.includes(channelDnc)) {
    reasons.push(`dnc_${channelDnc.toLowerCase()}`);
  }

  const eligible = reasons.length === 0;
  return {
    ok: true,
    eligible,
    reasons,
    consentStatus,
    consentSource: consent.source || null,
    dncFlags,
    purpose,
    channel,
    inferred: false,
  };
}

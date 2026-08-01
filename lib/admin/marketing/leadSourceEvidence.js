/**
 * Lead source evidence — read-only CRM bridge for Marketing admin.
 *
 * Does NOT create a second Lead Source SoT.
 * Authoritative fields: CrmLead.source, channel, sourceIdempotencyKey + CrmCaptureRecord rows.
 */

import { resolveMarketingAccess } from './authz.js';

function hasLeadModel(prisma) {
  return typeof prisma?.crmLead?.findUnique === 'function';
}

function hasCaptureModel(prisma) {
  return typeof prisma?.crmCaptureRecord?.findMany === 'function';
}

function serializeLeadEvidence(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadNumber: row.leadNumber,
    source: row.source,
    channel: row.channel,
    sourceIdempotencyKey: row.sourceIdempotencyKey || null,
    status: row.status,
    title: row.title,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

function serializeCaptureRecord(row) {
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
    consentStatus: row.consentStatus,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, leadId: string }} opts
 */
export async function getLeadSourceEvidence(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canViewLeadSourceEvidence) {
    return { ok: false, forbidden: true };
  }

  const leadId = opts.leadId ? String(opts.leadId).trim() : '';
  if (!leadId) {
    return { ok: false, error: 'lead_id_required' };
  }

  if (!hasLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const isLeadNumber = /^LEAD-\d{4}-\d{6}$/.test(leadId);
  const lead = await prisma.crmLead.findUnique({
    where: isLeadNumber ? { leadNumber: leadId } : { id: leadId },
  });
  if (!lead) {
    return { ok: false, error: 'lead_not_found' };
  }

  let captureRecords = [];
  if (hasCaptureModel(prisma)) {
    const rows = await prisma.crmCaptureRecord.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
    captureRecords = rows.map(serializeCaptureRecord);
  }

  return {
    ok: true,
    lead: serializeLeadEvidence(lead),
    captureRecords,
    sourceOfTruth: 'crm',
  };
}

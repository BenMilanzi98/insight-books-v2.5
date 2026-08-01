/**
 * Marketing campaigns — Phase 23 Wave 1 CRUD + status transitions.
 * Marketing Campaign ≠ Affiliate campaign.
 */

import {
  MARKETING_CAMPAIGN_STATUS,
  MARKETING_CAMPAIGN_TYPE,
  MARKETING_CAMPAIGN_TYPES,
  MARKETING_CAMPAIGN_STATUSES,
  MARKETING_NUMBER_PREFIX,
  MARKETING_CAMPAIGN_NUMBER_RE,
  MARKETING_LIST_DEFAULT_LIMIT,
  MARKETING_LIST_MAX_LIMIT,
  canTransitionCampaignStatus,
} from './catalogue.js';
import { allocateMarketingNumber } from './numbering.js';
import { resolveMarketingAccess } from './authz.js';

const CAMPAIGN_INCLUDE = {
  channel: true,
  source: true,
  medium: true,
};

function hasCampaignModel(prisma) {
  return typeof prisma?.marketingCampaign?.findMany === 'function';
}

function clampLimit(raw) {
  const n = parseInt(String(raw ?? MARKETING_LIST_DEFAULT_LIMIT), 10);
  if (!Number.isFinite(n) || n < 1) return MARKETING_LIST_DEFAULT_LIMIT;
  return Math.min(n, MARKETING_LIST_MAX_LIMIT);
}

function serializeCampaign(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignNumber: row.campaignNumber,
    campaignCode: row.campaignCode || null,
    name: row.name,
    description: row.description || null,
    objective: row.objective || null,
    campaignType: row.campaignType,
    parentCampaignId: row.parentCampaignId || null,
    channelId: row.channelId || null,
    sourceId: row.sourceId || null,
    mediumId: row.mediumId || null,
    status: row.status,
    startDate: row.startDate ? new Date(row.startDate).toISOString() : null,
    endDate: row.endDate ? new Date(row.endDate).toISOString() : null,
    timezone: row.timezone || null,
    ownerAdminId: row.ownerAdminId || null,
    teamId: row.teamId || null,
    territoryId: row.territoryId || null,
    createdByAdminId: row.createdByAdminId || null,
    version: row.version ?? 1,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    channel: row.channel
      ? {
          id: row.channel.id,
          code: row.channel.code,
          name: row.channel.name,
          status: row.channel.status,
        }
      : null,
    source: row.source
      ? {
          id: row.source.id,
          code: row.source.code,
          name: row.source.name,
          status: row.source.status,
        }
      : null,
    medium: row.medium
      ? {
          id: row.medium.id,
          code: row.medium.code,
          name: row.medium.name,
          status: row.medium.status,
        }
      : null,
  };
}

async function resolveCampaignId(prisma, idOrNumber) {
  const key = String(idOrNumber || '').trim();
  if (!key) return null;
  if (MARKETING_CAMPAIGN_NUMBER_RE.test(key)) {
    return prisma.marketingCampaign.findUnique({ where: { campaignNumber: key } });
  }
  return prisma.marketingCampaign.findUnique({ where: { id: key } });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, status?: string, campaignType?: string, ownerAdminId?: string, limit?: number, skip?: number }} [opts]
 */
export async function listCampaigns(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canView) return { ok: false, forbidden: true };
  if (!hasCampaignModel(prisma)) {
    return { ok: false, error: 'marketing_campaign_model_unavailable', status: 'UNAVAILABLE' };
  }

  const take = clampLimit(opts.limit);
  const skip = typeof opts.skip === 'number' ? Math.max(0, opts.skip) : 0;
  const where = {};
  if (opts.status) where.status = String(opts.status).trim().toUpperCase();
  if (opts.campaignType) where.campaignType = String(opts.campaignType).trim().toUpperCase();
  if (opts.ownerAdminId) where.ownerAdminId = opts.ownerAdminId;

  const rows = await prisma.marketingCampaign.findMany({
    where,
    include: CAMPAIGN_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });

  return { ok: true, items: rows.map(serializeCampaign) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, id?: string, campaignNumber?: string }} opts
 */
export async function getCampaign(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canView) return { ok: false, forbidden: true };
  if (!hasCampaignModel(prisma)) {
    return { ok: false, error: 'marketing_campaign_model_unavailable', status: 'UNAVAILABLE' };
  }

  const id = opts.id ? String(opts.id).trim() : '';
  const campaignNumber = opts.campaignNumber ? String(opts.campaignNumber).trim() : '';
  if (!id && !campaignNumber) return { ok: false, error: 'campaign_id_or_number_required' };

  const row = await prisma.marketingCampaign.findUnique({
    where: id ? { id } : { campaignNumber },
    include: CAMPAIGN_INCLUDE,
  });

  if (!row) return { ok: false, error: 'campaign_not_found' };
  return { ok: true, campaign: serializeCampaign(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function createCampaign(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canCreateCampaigns) return { ok: false, forbidden: true };
  if (!hasCampaignModel(prisma)) {
    return { ok: false, error: 'marketing_campaign_model_unavailable', status: 'UNAVAILABLE' };
  }

  const name = args.name ? String(args.name).trim() : '';
  if (!name) return { ok: false, error: 'name_required' };

  const campaignType = args.campaignType
    ? String(args.campaignType).trim().toUpperCase()
    : MARKETING_CAMPAIGN_TYPE.LEAD_GENERATION;
  if (!MARKETING_CAMPAIGN_TYPES.includes(campaignType)) {
    return { ok: false, error: 'invalid_campaign_type', campaignType };
  }

  const allocated = await allocateMarketingNumber(prisma, {
    prefix: MARKETING_NUMBER_PREFIX.CAMPAIGN,
    now: args.now || new Date(),
  });
  if (!allocated.ok) return { ok: false, error: allocated.error };

  const row = await prisma.marketingCampaign.create({
    data: {
      campaignNumber: allocated.number,
      campaignCode: args.campaignCode ? String(args.campaignCode).trim() : null,
      name,
      description: args.description ? String(args.description).trim() : null,
      objective: args.objective ? String(args.objective).trim() : null,
      campaignType,
      parentCampaignId: args.parentCampaignId || null,
      channelId: args.channelId || null,
      sourceId: args.sourceId || null,
      mediumId: args.mediumId || null,
      status: MARKETING_CAMPAIGN_STATUS.DRAFT,
      startDate: args.startDate ? new Date(args.startDate) : null,
      endDate: args.endDate ? new Date(args.endDate) : null,
      timezone: args.timezone ? String(args.timezone).trim() : 'Africa/Blantyre',
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      createdByAdminId: args.admin?.id || null,
    },
    include: CAMPAIGN_INCLUDE,
  });

  return { ok: true, campaign: serializeCampaign(row) };
}

const UPDATABLE_FIELDS = [
  'name',
  'description',
  'objective',
  'campaignType',
  'campaignCode',
  'channelId',
  'sourceId',
  'mediumId',
  'parentCampaignId',
  'ownerAdminId',
  'teamId',
  'territoryId',
  'startDate',
  'endDate',
  'timezone',
];

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, id: string, patch?: object, status?: string }} args
 */
export async function updateCampaign(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canEditCampaigns) return { ok: false, forbidden: true };
  if (!hasCampaignModel(prisma)) {
    return { ok: false, error: 'marketing_campaign_model_unavailable', status: 'UNAVAILABLE' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'campaign_id_required' };

  const existing = await resolveCampaignId(prisma, id);
  if (!existing) return { ok: false, error: 'campaign_not_found' };

  const data = {};
  const patch = args.patch || args;

  for (const field of UPDATABLE_FIELDS) {
    if (patch[field] !== undefined) {
      if (field === 'campaignType') {
        const ct = String(patch[field]).trim().toUpperCase();
        if (!MARKETING_CAMPAIGN_TYPES.includes(ct)) {
          return { ok: false, error: 'invalid_campaign_type', campaignType: ct };
        }
        data[field] = ct;
      } else if (field === 'startDate' || field === 'endDate') {
        data[field] = patch[field] ? new Date(patch[field]) : null;
      } else if (typeof patch[field] === 'string') {
        data[field] = patch[field].trim() || null;
      } else {
        data[field] = patch[field];
      }
    }
  }

  if (args.status !== undefined || patch.status !== undefined) {
    const nextStatus = String(args.status ?? patch.status).trim().toUpperCase();
    if (!MARKETING_CAMPAIGN_STATUSES.includes(nextStatus)) {
      return { ok: false, error: 'invalid_campaign_status', status: nextStatus };
    }
    if (nextStatus !== existing.status) {
      if (!canTransitionCampaignStatus(existing.status, nextStatus)) {
        return {
          ok: false,
          error: 'invalid_campaign_status_transition',
          from: existing.status,
          to: nextStatus,
        };
      }
      data.status = nextStatus;
    }
  }

  if (Object.keys(data).length === 0) return { ok: false, error: 'no_updates' };

  const row = await prisma.marketingCampaign.update({
    where: { id: existing.id },
    data,
    include: CAMPAIGN_INCLUDE,
  });

  return { ok: true, campaign: serializeCampaign(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, id: string, status: string, reason?: string }} args
 */
export async function transitionCampaignStatus(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canEditCampaigns) return { ok: false, forbidden: true };

  const id = args.id ? String(args.id).trim() : '';
  const status = args.status ? String(args.status).trim().toUpperCase() : '';
  if (!id || !status) return { ok: false, error: 'campaign_id_and_status_required' };

  if (!MARKETING_CAMPAIGN_STATUSES.includes(status)) {
    return { ok: false, error: 'invalid_campaign_status', status };
  }

  if (!hasCampaignModel(prisma)) {
    return { ok: false, error: 'marketing_campaign_model_unavailable', status: 'UNAVAILABLE' };
  }

  const existing = await resolveCampaignId(prisma, id);
  if (!existing) return { ok: false, error: 'campaign_not_found' };

  if (existing.status === status) {
    const row = await prisma.marketingCampaign.findUnique({
      where: { id: existing.id },
      include: CAMPAIGN_INCLUDE,
    });
    return { ok: true, campaign: serializeCampaign(row), noop: true };
  }

  if (!canTransitionCampaignStatus(existing.status, status)) {
    return {
      ok: false,
      error: 'invalid_campaign_status_transition',
      from: existing.status,
      to: status,
    };
  }

  const row = await prisma.marketingCampaign.update({
    where: { id: existing.id },
    data: { status },
    include: CAMPAIGN_INCLUDE,
  });

  return { ok: true, campaign: serializeCampaign(row), reason: args.reason || null };
}

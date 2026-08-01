/**
 * Marketing overview — Phase 23 Wave 1 foundation pack.
 * Never invent impressions/clicks/spend/CAC/ROAS zeros — UNAVAILABLE only.
 */

import {
  MARKETING_DEFINITION_VERSION,
  MARKETING_WAVE1_UNAVAILABLE_METRICS,
  MARKETING_WAVE1_UNAVAILABLE_REASON,
  MARKETING_READINESS,
  MARKETING_CAMPAIGN_STATUSES,
} from './catalogue.js';
import { resolveMarketingAccess } from './authz.js';

function wave1UnavailableMetric(code) {
  return {
    code,
    status: 'UNAVAILABLE',
    value: null,
    reason: MARKETING_WAVE1_UNAVAILABLE_REASON,
  };
}

async function countCampaignsByStatus(prisma) {
  if (typeof prisma?.marketingCampaign?.groupBy !== 'function') {
    return { ok: false, counts: null };
  }

  try {
    const grouped = await prisma.marketingCampaign.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const counts = {};
    for (const status of MARKETING_CAMPAIGN_STATUSES) {
      counts[status] = 0;
    }
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }
    return { ok: true, counts };
  } catch {
    return { ok: false, counts: null };
  }
}

async function countTaxonomy(prisma) {
  const result = {
    channels: null,
    sources: null,
    mediums: null,
    normalisationRules: null,
  };

  try {
    if (typeof prisma?.marketingChannel?.count === 'function') {
      result.channels = await prisma.marketingChannel.count();
    }
    if (typeof prisma?.marketingSource?.count === 'function') {
      result.sources = await prisma.marketingSource.count();
    }
    if (typeof prisma?.marketingMedium?.count === 'function') {
      result.mediums = await prisma.marketingMedium.count();
    }
    if (typeof prisma?.marketingSourceNormalisationRule?.count === 'function') {
      result.normalisationRules = await prisma.marketingSourceNormalisationRule.count();
    }
    return { ok: true, counts: result };
  } catch {
    return { ok: false, counts: result };
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object }} opts
 */
export async function getMarketingOverview(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true };
  }

  const metrics = MARKETING_WAVE1_UNAVAILABLE_METRICS.map(wave1UnavailableMetric);

  const campaignResult = await countCampaignsByStatus(prisma);
  const taxonomyResult = await countTaxonomy(prisma);

  return {
    ok: true,
    catalogueVersion: MARKETING_DEFINITION_VERSION,
    wave: 1,
    readiness: MARKETING_READINESS.WAVE1_FOUNDATION,
    metrics,
    campaignCounts: campaignResult.counts,
    campaignCountsAvailable: campaignResult.ok,
    taxonomyCounts: taxonomyResult.counts,
    taxonomyCountsAvailable: taxonomyResult.ok,
  };
}

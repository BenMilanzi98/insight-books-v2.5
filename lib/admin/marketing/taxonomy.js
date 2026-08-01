/**
 * Marketing taxonomy — channels, sources, mediums, normalisation rules.
 * Governed codes; seed catalogue is idempotent when tables are empty.
 */

import {
  MARKETING_TAXONOMY_STATUS,
  MARKETING_NORMALISATION_RULE_STATUS,
  MARKETING_SEED_CHANNELS,
  MARKETING_SEED_SOURCES,
  MARKETING_SEED_MEDIUMS,
} from './catalogue.js';
import { resolveMarketingAccess } from './authz.js';

function hasChannelModel(prisma) {
  return typeof prisma?.marketingChannel?.findMany === 'function';
}

function hasSourceModel(prisma) {
  return typeof prisma?.marketingSource?.findMany === 'function';
}

function hasMediumModel(prisma) {
  return typeof prisma?.marketingMedium?.findMany === 'function';
}

function hasNormalisationModel(prisma) {
  return typeof prisma?.marketingSourceNormalisationRule?.findMany === 'function';
}

function serializeTaxonomyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
    status: row.status,
    sortOrder: row.sortOrder ?? 0,
    channelId: row.channelId || null,
    sourceId: row.sourceId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function serializeNormalisationRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    ruleCode: row.ruleCode,
    version: row.version,
    status: row.status,
    rawSourcePattern: row.rawSourcePattern,
    rawMediumPattern: row.rawMediumPattern || null,
    channelCode: row.channelCode,
    sourceCode: row.sourceCode,
    mediumCode: row.mediumCode,
    priority: row.priority ?? 100,
    effectiveFrom: row.effectiveFrom ? new Date(row.effectiveFrom).toISOString() : null,
    effectiveTo: row.effectiveTo ? new Date(row.effectiveTo).toISOString() : null,
    createdByAdminId: row.createdByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function buildStatusFilter(status) {
  if (!status) return {};
  return { status: String(status).trim().toUpperCase() };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, status?: string }} [opts]
 */
export async function listChannels(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canView) return { ok: false, forbidden: true };
  if (!hasChannelModel(prisma)) {
    return { ok: false, error: 'marketing_channel_model_unavailable', status: 'UNAVAILABLE' };
  }

  const rows = await prisma.marketingChannel.findMany({
    where: buildStatusFilter(opts.status),
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  return { ok: true, items: rows.map(serializeTaxonomyRow) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, status?: string }} [opts]
 */
export async function listSources(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canView) return { ok: false, forbidden: true };
  if (!hasSourceModel(prisma)) {
    return { ok: false, error: 'marketing_source_model_unavailable', status: 'UNAVAILABLE' };
  }

  const rows = await prisma.marketingSource.findMany({
    where: buildStatusFilter(opts.status),
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  return { ok: true, items: rows.map(serializeTaxonomyRow) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, status?: string }} [opts]
 */
export async function listMediums(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canView) return { ok: false, forbidden: true };
  if (!hasMediumModel(prisma)) {
    return { ok: false, error: 'marketing_medium_model_unavailable', status: 'UNAVAILABLE' };
  }

  const rows = await prisma.marketingMedium.findMany({
    where: buildStatusFilter(opts.status),
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  return { ok: true, items: rows.map(serializeTaxonomyRow) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, code: string, name: string, description?: string|null, sortOrder?: number }} args
 */
export async function createChannel(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canManageTaxonomy) return { ok: false, forbidden: true };
  if (!hasChannelModel(prisma)) {
    return { ok: false, error: 'marketing_channel_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  const name = args.name ? String(args.name).trim() : '';
  if (!code || !name) return { ok: false, error: 'code_and_name_required' };

  try {
    const row = await prisma.marketingChannel.create({
      data: {
        code,
        name,
        description: args.description ? String(args.description).trim() : null,
        status: MARKETING_TAXONOMY_STATUS.ACTIVE,
        sortOrder: typeof args.sortOrder === 'number' ? args.sortOrder : 0,
      },
    });
    return { ok: true, channel: serializeTaxonomyRow(row) };
  } catch (err) {
    if (err?.code === 'P2002') return { ok: false, error: 'channel_code_exists', code };
    throw err;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, code: string, name: string, channelId?: string|null, description?: string|null, sortOrder?: number }} args
 */
export async function createSource(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canManageTaxonomy) return { ok: false, forbidden: true };
  if (!hasSourceModel(prisma)) {
    return { ok: false, error: 'marketing_source_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  const name = args.name ? String(args.name).trim() : '';
  if (!code || !name) return { ok: false, error: 'code_and_name_required' };

  try {
    const row = await prisma.marketingSource.create({
      data: {
        code,
        name,
        channelId: args.channelId || null,
        description: args.description ? String(args.description).trim() : null,
        status: MARKETING_TAXONOMY_STATUS.ACTIVE,
        sortOrder: typeof args.sortOrder === 'number' ? args.sortOrder : 0,
      },
    });
    return { ok: true, source: serializeTaxonomyRow(row) };
  } catch (err) {
    if (err?.code === 'P2002') return { ok: false, error: 'source_code_exists', code };
    throw err;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, code: string, name: string, sourceId?: string|null, description?: string|null, sortOrder?: number }} args
 */
export async function createMedium(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canManageTaxonomy) return { ok: false, forbidden: true };
  if (!hasMediumModel(prisma)) {
    return { ok: false, error: 'marketing_medium_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  const name = args.name ? String(args.name).trim() : '';
  if (!code || !name) return { ok: false, error: 'code_and_name_required' };

  try {
    const row = await prisma.marketingMedium.create({
      data: {
        code,
        name,
        sourceId: args.sourceId || null,
        description: args.description ? String(args.description).trim() : null,
        status: MARKETING_TAXONOMY_STATUS.ACTIVE,
        sortOrder: typeof args.sortOrder === 'number' ? args.sortOrder : 0,
      },
    });
    return { ok: true, medium: serializeTaxonomyRow(row) };
  } catch (err) {
    if (err?.code === 'P2002') return { ok: false, error: 'medium_code_exists', code };
    throw err;
  }
}

/**
 * Idempotent seed — upserts catalogue codes only when channel table is empty.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function ensureSeedTaxonomy(prisma) {
  if (!hasChannelModel(prisma) || !hasSourceModel(prisma) || !hasMediumModel(prisma)) {
    return { ok: false, error: 'marketing_taxonomy_models_unavailable', status: 'UNAVAILABLE' };
  }

  const existingCount = await prisma.marketingChannel.count();
  if (existingCount > 0) {
    return { ok: true, seeded: false, reason: 'taxonomy_already_present' };
  }

  for (const seed of MARKETING_SEED_CHANNELS) {
    await prisma.marketingChannel.upsert({
      where: { code: seed.code },
      create: {
        code: seed.code,
        name: seed.name,
        status: MARKETING_TAXONOMY_STATUS.ACTIVE,
        sortOrder: seed.sortOrder,
      },
      update: {},
    });
  }

  for (const seed of MARKETING_SEED_SOURCES) {
    await prisma.marketingSource.upsert({
      where: { code: seed.code },
      create: {
        code: seed.code,
        name: seed.name,
        status: MARKETING_TAXONOMY_STATUS.ACTIVE,
        sortOrder: seed.sortOrder,
      },
      update: {},
    });
  }

  for (const seed of MARKETING_SEED_MEDIUMS) {
    await prisma.marketingMedium.upsert({
      where: { code: seed.code },
      create: {
        code: seed.code,
        name: seed.name,
        status: MARKETING_TAXONOMY_STATUS.ACTIVE,
        sortOrder: seed.sortOrder,
      },
      update: {},
    });
  }

  return { ok: true, seeded: true };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, status?: string, ruleCode?: string }} [opts]
 */
export async function listNormalisationRules(prisma, opts = {}) {
  const access = resolveMarketingAccess(opts.admin);
  if (!access.canView) return { ok: false, forbidden: true };
  if (!hasNormalisationModel(prisma)) {
    return {
      ok: false,
      error: 'marketing_normalisation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const where = { ...buildStatusFilter(opts.status) };
  if (opts.ruleCode) where.ruleCode = String(opts.ruleCode).trim().toUpperCase();

  const rows = await prisma.marketingSourceNormalisationRule.findMany({
    where,
    orderBy: [{ ruleCode: 'asc' }, { version: 'desc' }],
  });

  return { ok: true, items: rows.map(serializeNormalisationRule) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object,
 *   ruleCode: string,
 *   rawSourcePattern: string,
 *   rawMediumPattern?: string|null,
 *   channelCode: string,
 *   sourceCode: string,
 *   mediumCode: string,
 *   priority?: number,
 * }} args
 */
export async function createNormalisationRule(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canManageNormalisation) return { ok: false, forbidden: true };
  if (!hasNormalisationModel(prisma)) {
    return {
      ok: false,
      error: 'marketing_normalisation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const ruleCode = args.ruleCode ? String(args.ruleCode).trim().toUpperCase() : '';
  const rawSourcePattern = args.rawSourcePattern
    ? String(args.rawSourcePattern).trim()
    : '';
  const channelCode = args.channelCode ? String(args.channelCode).trim().toUpperCase() : '';
  const sourceCode = args.sourceCode ? String(args.sourceCode).trim().toUpperCase() : '';
  const mediumCode = args.mediumCode ? String(args.mediumCode).trim().toUpperCase() : '';

  if (!ruleCode || !rawSourcePattern || !channelCode || !sourceCode || !mediumCode) {
    return { ok: false, error: 'normalisation_rule_fields_required' };
  }

  const latest = await prisma.marketingSourceNormalisationRule.findFirst({
    where: { ruleCode },
    orderBy: { version: 'desc' },
  });
  const version = latest ? latest.version + 1 : 1;

  const row = await prisma.marketingSourceNormalisationRule.create({
    data: {
      ruleCode,
      version,
      status: MARKETING_NORMALISATION_RULE_STATUS.DRAFT,
      rawSourcePattern,
      rawMediumPattern: args.rawMediumPattern
        ? String(args.rawMediumPattern).trim()
        : null,
      channelCode,
      sourceCode,
      mediumCode,
      priority: typeof args.priority === 'number' ? args.priority : 100,
      createdByAdminId: args.admin?.id || null,
    },
  });

  return { ok: true, rule: serializeNormalisationRule(row) };
}

/**
 * Activate a DRAFT rule. ACTIVE rows are immutable — create a new version to change.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, ruleId: string }} args
 */
export async function activateNormalisationRule(prisma, args = {}) {
  const access = resolveMarketingAccess(args.admin);
  if (!access.canManageNormalisation) return { ok: false, forbidden: true };
  if (!hasNormalisationModel(prisma)) {
    return {
      ok: false,
      error: 'marketing_normalisation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const ruleId = args.ruleId ? String(args.ruleId).trim() : '';
  if (!ruleId) return { ok: false, error: 'rule_id_required' };

  const draft = await prisma.marketingSourceNormalisationRule.findUnique({
    where: { id: ruleId },
  });
  if (!draft) return { ok: false, error: 'normalisation_rule_not_found' };
  if (draft.status !== MARKETING_NORMALISATION_RULE_STATUS.DRAFT) {
    return { ok: false, error: 'normalisation_rule_not_draft', status: draft.status };
  }

  const now = new Date();

  const run = async (tx) => {
    const priorActive = await tx.marketingSourceNormalisationRule.findMany({
      where: {
        ruleCode: draft.ruleCode,
        status: MARKETING_NORMALISATION_RULE_STATUS.ACTIVE,
      },
    });

    for (const prior of priorActive) {
      await tx.marketingSourceNormalisationRule.update({
        where: { id: prior.id },
        data: {
          status: MARKETING_NORMALISATION_RULE_STATUS.SUPERSEDED,
          effectiveTo: now,
        },
      });
    }

    return tx.marketingSourceNormalisationRule.update({
      where: { id: draft.id },
      data: {
        status: MARKETING_NORMALISATION_RULE_STATUS.ACTIVE,
        approvedByAdminId: args.admin?.id || null,
        approvedAt: now,
        effectiveFrom: now,
      },
    });
  };

  const row =
    typeof prisma.$transaction === 'function' ? await prisma.$transaction(run) : await run(prisma);

  return { ok: true, rule: serializeNormalisationRule(row) };
}

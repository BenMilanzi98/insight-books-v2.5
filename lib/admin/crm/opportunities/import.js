/**
 * Opportunity bulk import — Phase 12 Wave 4.
 * Preview + confirm; idempotent keys; honesty gates (no fake success %).
 * Currency + amountBasis required when amount present; fail closed on invalid stage/currency/pipeline.
 * Terminal CLOSED_* stages rejected (use close service); EXPANSION requires accountId.
 * Audited import path (≠ invent Opportunities outside READY handoff or this path).
 */

import { CRM_NUMBER_PREFIX } from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { allocateCrmNumber } from '../numbering.js';
import {
  CRM_PIPELINE_CODE,
  CRM_PIPELINE_CODES,
  CRM_PIPELINE_STAGE,
  CRM_PIPELINE_STAGES_ORDERED,
  CRM_PIPELINE_TERMINAL_STAGES,
  CRM_OPPORTUNITY_STATUS,
} from '../pipeline/catalogue.js';
import { getPipelineDefinitionByCode } from '../pipeline/definitions.js';
import { CRM_AMOUNT_BASES, isIso4217Currency } from './commercial.js';
import {
  hasCrmOpportunityModel,
  hasCrmOpportunityStageHistoryModel,
  serializeOpportunity,
} from './model.js';

export const CRM_OPP_IMPORT_VERSION = 'crm-opportunity-import-v1-2026-07-30';

const ALLOWED_PIPELINES = new Set(CRM_PIPELINE_CODES);
const ALLOWED_STAGES = new Set(CRM_PIPELINE_STAGES_ORDERED);
const TERMINAL_STAGES = new Set(CRM_PIPELINE_TERMINAL_STAGES);
const ALLOWED_BASES = new Set(CRM_AMOUNT_BASES);

function normalizeRow(raw, index) {
  const row = raw && typeof raw === 'object' ? raw : {};
  return {
    index,
    importIdempotencyKey:
      row.importIdempotencyKey != null
        ? String(row.importIdempotencyKey).trim()
        : row.idempotencyKey != null
          ? String(row.idempotencyKey).trim()
          : '',
    title: row.title != null ? String(row.title).trim() : '',
    pipelineCode: String(row.pipelineCode || CRM_PIPELINE_CODE.NEW_BUSINESS)
      .trim()
      .toUpperCase(),
    stageCode: String(row.stageCode || CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED)
      .trim()
      .toUpperCase(),
    accountId: row.accountId != null ? String(row.accountId).trim() : null,
    contactId: row.contactId != null ? String(row.contactId).trim() : null,
    leadId: row.leadId != null ? String(row.leadId).trim() : null,
    ownerAdminId: row.ownerAdminId != null ? String(row.ownerAdminId).trim() : null,
    amount: row.amount != null && row.amount !== '' ? row.amount : null,
    currency: row.currency != null ? String(row.currency).trim().toUpperCase() : null,
    amountBasis: row.amountBasis != null ? String(row.amountBasis).trim().toUpperCase() : null,
  };
}

/**
 * Validate a single normalized import row (fail closed).
 * @param {ReturnType<typeof normalizeRow>} row
 */
export function validateOpportunityImportRow(row) {
  const errors = [];
  if (!row.importIdempotencyKey) {
    errors.push({ code: 'IMPORT_IDEMPOTENCY_KEY_REQUIRED' });
  }
  if (!row.title) {
    errors.push({ code: 'TITLE_REQUIRED' });
  }
  if (!ALLOWED_PIPELINES.has(row.pipelineCode)) {
    errors.push({
      code: 'INVALID_PIPELINE_CODE',
      allowed: CRM_PIPELINE_CODES,
    });
  } else if (!getPipelineDefinitionByCode(row.pipelineCode)) {
    errors.push({ code: 'PIPELINE_DEFINITION_MISSING' });
  }
  if (!ALLOWED_STAGES.has(row.stageCode)) {
    errors.push({ code: 'INVALID_STAGE_CODE', allowed: CRM_PIPELINE_STAGES_ORDERED });
  } else if (TERMINAL_STAGES.has(row.stageCode)) {
    // Import always creates OPEN rows — terminal stages require close service + evidence.
    errors.push({ code: 'TERMINAL_STAGE_USE_CLOSE_SERVICE' });
  }
  if (row.pipelineCode === CRM_PIPELINE_CODE.EXPANSION && !row.accountId) {
    errors.push({ code: 'EXPANSION_ACCOUNT_REQUIRED' });
  }
  if (row.amount != null) {
    const n = Number(row.amount);
    if (!Number.isFinite(n) || n < 0) {
      errors.push({ code: 'AMOUNT_INVALID' });
    }
    if (!row.currency || !isIso4217Currency(row.currency)) {
      errors.push({ code: 'CURRENCY_REQUIRED' });
    }
    if (!row.amountBasis || !ALLOWED_BASES.has(row.amountBasis)) {
      errors.push({ code: 'AMOUNT_BASIS_REQUIRED', allowed: CRM_AMOUNT_BASES });
    }
  } else if (row.currency && !isIso4217Currency(row.currency)) {
    errors.push({ code: 'CURRENCY_INVALID' });
  }
  return errors;
}

/**
 * Preview Opportunity import — never creates rows; never invents success %.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, rows: object[] }} args
 */
export async function previewOpportunityImport(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canCreateOpportunities && !access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_import_forbidden' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const rawRows = Array.isArray(args.rows) ? args.rows : null;
  if (!rawRows) {
    return { ok: false, error: 'rows_required' };
  }
  if (rawRows.length === 0) {
    return {
      ok: true,
      preview: {
        total: 0,
        valid: 0,
        invalid: 0,
        duplicateKeys: 0,
        items: [],
      },
      honesty: {
        inventSuccessRateForbidden: true,
        successRate: null,
        status: 'EMPTY',
      },
      definitionVersion: CRM_OPP_IMPORT_VERSION,
      weightedUiEnabled: false,
    };
  }

  const modelOk = hasCrmOpportunityModel(prisma);
  const items = [];
  let valid = 0;
  let invalid = 0;
  let duplicateKeys = 0;
  const seenKeys = new Set();

  for (let i = 0; i < rawRows.length; i += 1) {
    const row = normalizeRow(rawRows[i], i);
    const errors = validateOpportunityImportRow(row);
    let wouldSkipAsExisting = false;

    if (row.importIdempotencyKey) {
      if (seenKeys.has(row.importIdempotencyKey)) {
        errors.push({ code: 'DUPLICATE_KEY_IN_BATCH' });
        duplicateKeys += 1;
      } else {
        seenKeys.add(row.importIdempotencyKey);
      }

      if (modelOk && typeof prisma.crmOpportunity.findFirst === 'function') {
        try {
          const existing = await prisma.crmOpportunity.findFirst({
            where: { importIdempotencyKey: row.importIdempotencyKey },
          });
          if (existing) {
            wouldSkipAsExisting = true;
            duplicateKeys += 1;
          }
        } catch {
          // leave wouldSkipAsExisting false — never invent
        }
      }
    }

    const ok = errors.length === 0;
    if (ok) valid += 1;
    else invalid += 1;

    items.push({
      index: i,
      importIdempotencyKey: row.importIdempotencyKey || null,
      title: row.title || null,
      pipelineCode: row.pipelineCode,
      stageCode: row.stageCode,
      ok,
      errors,
      wouldCreate: ok && !wouldSkipAsExisting,
      wouldSkipAsExisting,
    });
  }

  return {
    ok: true,
    preview: {
      total: rawRows.length,
      valid,
      invalid,
      duplicateKeys,
      items,
      modelAvailable: modelOk,
    },
    honesty: {
      inventSuccessRateForbidden: true,
      successRate: null,
      status: invalid > 0 ? 'HAS_ERRORS' : 'READY',
    },
    definitionVersion: CRM_OPP_IMPORT_VERSION,
    weightedUiEnabled: false,
  };
}

/**
 * Confirm Opportunity import — idempotent by importIdempotencyKey.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, rows: object[], now?: Date }} args
 */
export async function confirmOpportunityImport(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canCreateOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_import_forbidden' };
  }

  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const preview = await previewOpportunityImport(prisma, {
    admin: args.admin,
    rows: args.rows,
  });
  if (!preview.ok) return preview;

  if (preview.preview.invalid > 0) {
    return {
      ok: false,
      error: 'IMPORT_VALIDATION_FAILED',
      preview: preview.preview,
      honesty: preview.honesty,
      definitionVersion: CRM_OPP_IMPORT_VERSION,
    };
  }

  const now = args.now || new Date();
  const created = [];
  const skipped = [];
  const failed = [];

  for (const item of preview.preview.items) {
    if (item.wouldSkipAsExisting) {
      let existing = null;
      try {
        existing = await prisma.crmOpportunity.findFirst({
          where: { importIdempotencyKey: item.importIdempotencyKey },
        });
      } catch {
        existing = null;
      }
      skipped.push({
        index: item.index,
        importIdempotencyKey: item.importIdempotencyKey,
        opportunityId: existing?.id || null,
        opportunityNumber: existing?.opportunityNumber || null,
        reason: 'idempotent_skip',
      });
      continue;
    }

    const raw = Array.isArray(args.rows) ? args.rows[item.index] : null;
    const row = normalizeRow(raw, item.index);
    const def = getPipelineDefinitionByCode(row.pipelineCode);

    try {
      const allocated = await allocateCrmNumber(prisma, {
        prefix: CRM_NUMBER_PREFIX.OPP,
        now,
      });
      if (!allocated?.ok || !allocated.number) {
        failed.push({
          index: item.index,
          importIdempotencyKey: row.importIdempotencyKey,
          error: 'number_allocation_failed',
        });
        continue;
      }

      const data = {
        opportunityNumber: allocated.number,
        pipelineCode: row.pipelineCode,
        pipelineVersionId: def?.versionId || def?.version || null,
        stageCode: row.stageCode,
        status: CRM_OPPORTUNITY_STATUS.OPEN,
        title: row.title,
        accountId: row.accountId || null,
        contactId: row.contactId || null,
        leadId: row.leadId || null,
        ownerAdminId: row.ownerAdminId || args.admin?.id || null,
        createdByAdminId: args.admin?.id || null,
        importIdempotencyKey: row.importIdempotencyKey,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      if (row.amount != null) {
        data.amount = row.amount;
        data.currency = row.currency;
        data.amountBasis = row.amountBasis;
      }

      const opp = await prisma.crmOpportunity.create({ data });

      if (hasCrmOpportunityStageHistoryModel(prisma)) {
        try {
          await prisma.crmOpportunityStageHistory.create({
            data: {
              opportunityId: opp.id,
              fromStageCode: null,
              toStageCode: row.stageCode,
              changedByAdminId: args.admin?.id || null,
              reason: 'import_confirm',
              evidenceReferences: {
                importIdempotencyKey: row.importIdempotencyKey,
                importVersion: CRM_OPP_IMPORT_VERSION,
              },
              idempotencyKey: `import:${row.importIdempotencyKey}`,
              at: now,
            },
          });
        } catch {
          // history best-effort; opportunity already created
        }
      }

      created.push({
        index: item.index,
        importIdempotencyKey: row.importIdempotencyKey,
        opportunity: serializeOpportunity(opp),
      });
    } catch (err) {
      // Unique violation → treat as idempotent skip when possible
      if (err?.code === 'P2002') {
        let existing = null;
        try {
          existing = await prisma.crmOpportunity.findFirst({
            where: { importIdempotencyKey: row.importIdempotencyKey },
          });
        } catch {
          existing = null;
        }
        skipped.push({
          index: item.index,
          importIdempotencyKey: row.importIdempotencyKey,
          opportunityId: existing?.id || null,
          opportunityNumber: existing?.opportunityNumber || null,
          reason: 'idempotent_conflict',
        });
        continue;
      }
      failed.push({
        index: item.index,
        importIdempotencyKey: row.importIdempotencyKey,
        error: 'create_failed',
      });
    }
  }

  return {
    ok: failed.length === 0,
    created: created.length,
    skipped: skipped.length,
    failed: failed.length,
    items: { created, skipped, failed },
    honesty: {
      inventSuccessRateForbidden: true,
      successRate: null,
      createdCount: created.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
    },
    definitionVersion: CRM_OPP_IMPORT_VERSION,
    weightedUiEnabled: false,
    provisioned: false,
  };
}

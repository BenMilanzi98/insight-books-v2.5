import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { createSiteMapping, createTaxMapping, createPaymentMethodMapping } from '../services/mappingService.js';
import { normalizeTaxTreatment, inferTreatmentFromExternalCategory } from './taxTreatment.js';
import { MRA_PAYMENT_CODE } from '../../domain/operationalEnums.js';

const SUGGESTION_ALGORITHM_VERSION = 'phase9-suggest-v1';

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Advisory site suggestions only — never ACTIVE.
 */
export async function generateBranchSiteSuggestions({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  persist = true,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const branches = await db.branch.findMany({
    where: { tenantId: businessId, isActive: true },
  });
  const sites = await db.mraEisSite.findMany({
    where: { tenantId, businessId, environment: env, active: true },
  });

  const suggestions = [];
  const generatedAt = new Date().toISOString();

  for (const branch of branches) {
    const candidates = [];
    for (const site of sites) {
      const reasons = [];
      const conflicts = [];
      let confidence = 0;
      const bn = normalizeText(branch.name);
      const sn = normalizeText(site.siteName);
      const bc = normalizeText(branch.code);
      if (bn && sn && bn === sn) {
        confidence += 0.55;
        reasons.push('EXACT_SITE_NAME_MATCH');
      } else if (bn && sn && (bn.includes(sn) || sn.includes(bn))) {
        confidence += 0.25;
        reasons.push('PARTIAL_NAME_SIMILARITY');
        conflicts.push('FUZZY_NAME_ONLY');
      }
      if (bc && (bc === normalizeText(site.mraSiteId) || bc === sn)) {
        confidence += 0.3;
        reasons.push('BRANCH_CODE_MATCH');
      }
      if (site.city && bn.includes(normalizeText(site.city))) {
        confidence += 0.1;
        reasons.push('CITY_MATCH');
      }
      if (confidence > 0) {
        candidates.push({
          mraSiteId: site.mraSiteId,
          siteName: site.siteName,
          confidence: Math.min(confidence, 0.99),
          reasons,
          conflictingSignals: conflicts,
          configurationVersion: site.sourceConfigurationSnapshotId,
        });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    const top = candidates[0] || null;

    let mapping = null;
    if (persist && top) {
      // Do not auto-activate; create SUGGESTED only if no active mapping
      const existing = await db.mraEisSiteMapping.findFirst({
        where: {
          tenantId,
          businessId,
          branchId: branch.id,
          environment: env,
          status: { in: [MAPPING_STATUS.ACTIVE, MAPPING_STATUS.VERIFIED, MAPPING_STATUS.SUGGESTED] },
        },
      });
      if (!existing) {
        mapping = await createSiteMapping({
          tenantId,
          businessId,
          branchId: branch.id,
          mraSiteId: top.mraSiteId,
          environment: env,
          status: MAPPING_STATUS.SUGGESTED,
          db,
        });
        await db.mraEisSiteMapping.update({
          where: { id: mapping.id },
          data: {
            suggestionSource: SUGGESTION_ALGORITHM_VERSION,
            confidenceScore: top.confidence,
          },
        });
      }
    }

    suggestions.push({
      branchId: branch.id,
      branchName: branch.name,
      candidates,
      topCandidate: top,
      mappingId: mapping?.id || null,
      status: mapping ? MAPPING_STATUS.SUGGESTED : MAPPING_STATUS.UNMAPPED,
      generatedAt,
      suggestionAlgorithmVersion: SUGGESTION_ALGORITHM_VERSION,
      note: 'Suggestions are advisory and never auto-activate.',
    });
  }

  return { suggestions, suggestionAlgorithmVersion: SUGGESTION_ALGORITHM_VERSION };
}

export async function generateTaxMappingSuggestions({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  localTaxRates = [],
  persist = false,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const externals = await db.mraEisExternalTaxDefinition.findMany({
    where: { tenantId, businessId, environment: env, active: true },
  }).catch(() => []);

  const rates =
    localTaxRates.length > 0
      ? localTaxRates
      : (await db.taxRate?.findMany?.({ where: { tenantId: businessId } }).catch?.(() => [])) || [];

  const suggestions = [];
  for (const local of rates) {
    const localTreatment = normalizeTaxTreatment(local.treatment || local.category || local.name);
    const candidates = [];
    for (const ext of externals) {
      const reasons = [];
      const risks = [];
      let confidence = 0;
      const mraTreatment = inferTreatmentFromExternalCategory(ext.category || ext.taxCode, ext.rate);
      if (local.rate != null && Number(local.rate) === Number(ext.rate)) {
        confidence += 0.4;
        reasons.push('EXACT_PERCENTAGE_MATCH');
        risks.push('PERCENTAGE_ALONE_INSUFFICIENT');
      }
      if (localTreatment && mraTreatment && localTreatment === mraTreatment) {
        confidence += 0.45;
        reasons.push('TREATMENT_MATCH');
      } else if (localTreatment && mraTreatment) {
        risks.push('TREATMENT_MISMATCH_RISK');
        confidence -= 0.5;
      }
      if (normalizeText(local.name) === normalizeText(ext.name || ext.taxCode)) {
        confidence += 0.2;
        reasons.push('NAME_OR_CODE_MATCH');
      }
      if (confidence > 0.2) {
        candidates.push({
          externalTaxDefinitionId: ext.id,
          mraTaxRateId: ext.externalTaxId,
          mraRate: ext.rate,
          mraTreatment,
          confidence: Math.max(0, Math.min(confidence, 0.99)),
          reasons,
          risks,
          requiredReviewerAction: 'VERIFY_TREATMENT_AND_RATE',
        });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    suggestions.push({
      localTaxRateId: local.id,
      localName: local.name,
      localRate: local.rate,
      localTreatment,
      candidates,
      note: 'Tax suggestions never auto-activate. Percentage match alone is insufficient.',
    });

    if (persist && candidates[0] && candidates[0].confidence >= 0.7) {
      const top = candidates[0];
      try {
        await createTaxMapping({
          tenantId,
          businessId,
          localTaxRateId: local.id,
          mraTaxRateId: top.mraTaxRateId,
          localRateSnapshot: local.rate ?? 0,
          mraRateSnapshot: top.mraRate ?? 0,
          status: MAPPING_STATUS.SUGGESTED,
          db,
        });
      } catch {
        /* idempotent / conflict — ignore for suggestion batch */
      }
    }
  }

  return { suggestions, suggestionAlgorithmVersion: SUGGESTION_ALGORITHM_VERSION };
}

/**
 * Map local payment methods to verified MRA codes — never from display label alone.
 */
export async function generatePaymentMappingSuggestions({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  localMethods = [],
  persist = false,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const methods =
    localMethods.length > 0
      ? localMethods
      : (await db.paymentMethod?.findMany?.({ where: { tenantId: businessId, isActive: true } }).catch?.(() => [])) || [];

  const TYPE_TO_CODE = {
    CASH: MRA_PAYMENT_CODE.CASH,
    CARD: MRA_PAYMENT_CODE.CARD,
    MOBILE_MONEY: MRA_PAYMENT_CODE.MOBILE_MONEY,
    MPAMBA: MRA_PAYMENT_CODE.MOBILE_MONEY,
    AIRTEL_MONEY: MRA_PAYMENT_CODE.MOBILE_MONEY,
    BANK_TRANSFER: MRA_PAYMENT_CODE.BANK_TRANSFER,
    BANK: MRA_PAYMENT_CODE.BANK_TRANSFER,
    CHEQUE: MRA_PAYMENT_CODE.CHEQUE,
    CREDIT: MRA_PAYMENT_CODE.CREDIT,
    VOUCHER: MRA_PAYMENT_CODE.VOUCHER,
  };

  const suggestions = [];
  for (const method of methods) {
    const typeKey = String(method.type || method.code || '').toUpperCase().replace(/[\s-]+/g, '_');
    const code = TYPE_TO_CODE[typeKey] || null;
    const displayAsCode = Object.values(MRA_PAYMENT_CODE).includes(String(method.name || '').toUpperCase());
    const candidates = [];
    if (code) {
      candidates.push({
        mraPaymentMethodCode: code,
        confidence: 0.75,
        reasons: ['LOCAL_TYPE_TO_VERIFIED_MRA_CODE'],
        risks: displayAsCode ? [] : ['CONFIRM_PROVIDER_NOT_LABEL'],
        requiredReviewerAction: 'VERIFY_PAYMENT_CODE',
      });
    } else {
      candidates.push({
        mraPaymentMethodCode: null,
        confidence: 0,
        reasons: [],
        risks: ['UNSUPPORTED_OR_UNMAPPED_TYPE', 'DO_NOT_USE_DISPLAY_LABEL_AS_CODE'],
        requiredReviewerAction: 'MANUAL_REVIEW_OR_BLOCK',
      });
    }

    suggestions.push({
      localPaymentMethodId: method.id,
      localName: method.name,
      localType: method.type,
      candidates,
      note: 'Display labels are never used as MRA API codes.',
    });

    if (persist && code) {
      try {
        await createPaymentMethodMapping({
          tenantId,
          businessId,
          localPaymentMethodId: method.id,
          mraPaymentMethodCode: code,
          environment: env,
          status: MAPPING_STATUS.SUGGESTED,
          db,
        });
      } catch {
        /* ignore */
      }
    }
  }

  return { suggestions, suggestionAlgorithmVersion: SUGGESTION_ALGORITHM_VERSION };
}

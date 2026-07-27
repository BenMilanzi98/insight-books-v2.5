import prisma from '@/lib/prisma.js';
import { EXTERNAL_CATALOGUE_TYPE, MAPPING_STATUS, MAPPING_TYPE } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { createProductMapping } from '../services/mappingService.js';
import { discoverLocalProducts, discoverLocalServices } from './localItemDiscovery.js';
import { validateProductTaxConsistency } from './taxConsistency.js';
import { unitsCompatible } from './uomMapping.js';

const ALGORITHM = 'phase10-catalogue-suggest-v1';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function preserveBarcode(raw) {
  return raw == null ? null : String(raw);
}

/**
 * Advisory suggestions only — never ACTIVE.
 * Exact unique barcode may be high confidence but still requires verification.
 */
export async function generateProductMappingSuggestions({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  mraSiteId = null,
  persist = false,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const locals = await discoverLocalProducts({ tenantId, businessId, db });
  const externals = await db.mraEisExternalCatalogueItem.findMany({
    where: {
      tenantId,
      businessId,
      environment: env,
      externalType: EXTERNAL_CATALOGUE_TYPE.PRODUCT,
      active: true,
      supersededAt: null,
      ...(mraSiteId ? { mraSiteId } : {}),
    },
  });

  const barcodeCounts = {};
  for (const e of externals) {
    const b = preserveBarcode(e.barcode);
    if (b) barcodeCounts[b] = (barcodeCounts[b] || 0) + 1;
  }
  const localBarcodeCounts = {};
  for (const l of locals) {
    const b = preserveBarcode(l.barcode);
    if (b) localBarcodeCounts[b] = (localBarcodeCounts[b] || 0) + 1;
  }

  const suggestions = [];
  for (const local of locals.filter((l) => l.requiresMapping)) {
    const candidates = [];
    for (const ext of externals) {
      const reasons = [];
      const conflicts = [];
      let confidence = 0;
      const localBarcode = preserveBarcode(local.barcode);
      const extBarcode = preserveBarcode(ext.barcode);

      if (localBarcode && extBarcode && localBarcode === extBarcode) {
        if ((barcodeCounts[extBarcode] || 0) > 1 || (localBarcodeCounts[localBarcode] || 0) > 1) {
          conflicts.push('BARCODE_CONFLICT');
          confidence -= 0.5;
        } else {
          confidence += 0.7;
          reasons.push('EXACT_UNIQUE_BARCODE');
        }
      }
      if (local.sku && ext.mraCode && String(local.sku) === String(ext.mraCode)) {
        confidence += 0.45;
        reasons.push('EXACT_PRODUCT_CODE');
      } else if (norm(local.sku) && norm(local.sku) === norm(ext.mraCode)) {
        confidence += 0.2;
        reasons.push('NORMALIZED_CODE_MATCH');
        conflicts.push('NORMALIZED_ONLY');
      }
      if (norm(local.name) && norm(local.name) === norm(ext.name)) {
        confidence += 0.25;
        reasons.push('EXACT_NORMALIZED_NAME');
      } else if (norm(local.name) && norm(ext.name) && (norm(local.name).includes(norm(ext.name)) || norm(ext.name).includes(norm(local.name)))) {
        confidence += 0.1;
        reasons.push('FUZZY_NAME');
        conflicts.push('FUZZY_TEXT_INSUFFICIENT');
      }

      const uomOk = !ext.unitOfMeasure || unitsCompatible('EA', ext.unitOfMeasure, null)
        || String(ext.unitOfMeasure).toUpperCase() === 'EA';
      if (!uomOk) conflicts.push('UNIT_OF_MEASURE_MISMATCH');

      const tax = await validateProductTaxConsistency({
        tenantId,
        businessId,
        localTaxRateValue: local.taxRate,
        externalTaxId: ext.rawRecordReference || null, // may be null — then EXTERNAL_TAX_MISSING soft
        environment: env,
        db,
      });
      // Re-check using catalogue tax if stored in description metadata — use selling path lightly
      if (ext.active === false) conflicts.push('EXTERNAL_PRODUCT_INACTIVE');

      if (confidence > 0.15) {
        candidates.push({
          externalCatalogueItemId: ext.id,
          mraProductCode: ext.mraCode,
          confidence: Math.max(0, Math.min(confidence, 0.99)),
          reasons,
          conflicts,
          barcodeComparison: { local: localBarcode, external: extBarcode },
          codeComparison: { local: local.sku, external: ext.mraCode },
          uomComparison: { local: 'EA', external: ext.unitOfMeasure },
          priceComparison: {
            local: local.price,
            external: ext.sellingPrice,
            status: Number(local.price) === Number(ext.sellingPrice) ? 'EXACT_MATCH' : 'LOCAL_DIFFERENT',
          },
          taxStatus: tax.status,
          requiredReviewerAction: 'VERIFY_BEFORE_ACTIVATION',
          suggestedMappingType: MAPPING_TYPE.PRODUCT_TO_PRODUCT,
        });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    const top = candidates[0] || null;

    let mappingId = null;
    if (persist && top && top.conflicts.length === 0 && top.confidence >= 0.5) {
      try {
        const row = await createProductMapping({
          tenantId,
          businessId,
          localItemId: local.localProductId,
          externalCatalogueItemId: top.externalCatalogueItemId,
          mappingType: MAPPING_TYPE.PRODUCT_TO_PRODUCT,
          status: MAPPING_STATUS.SUGGESTED,
          db,
        });
        mappingId = row.id;
      } catch {
        /* ignore duplicates */
      }
    }

    suggestions.push({
      localProductId: local.localProductId,
      localName: local.name,
      candidates,
      topCandidate: top,
      mappingId,
      status: mappingId ? MAPPING_STATUS.SUGGESTED : MAPPING_STATUS.UNMAPPED,
      note: 'Suggestions never auto-activate. Barcode match still requires verification.',
      suggestionAlgorithmVersion: ALGORITHM,
    });
  }

  return { suggestions, suggestionAlgorithmVersion: ALGORITHM, autoActivated: false };
}

export async function generateServiceMappingSuggestions({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  persist = false,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const locals = await discoverLocalServices({ tenantId, businessId, db });
  const externals = await db.mraEisExternalCatalogueItem.findMany({
    where: {
      tenantId,
      businessId,
      environment: env,
      externalType: EXTERNAL_CATALOGUE_TYPE.SERVICE,
      active: true,
      supersededAt: null,
    },
  });

  const suggestions = [];
  for (const local of locals.filter((s) => s.requiresMapping)) {
    const candidates = [];
    for (const ext of externals) {
      const reasons = [];
      let confidence = 0;
      if (local.code && ext.mraCode && String(local.code) === String(ext.mraCode)) {
        confidence += 0.55;
        reasons.push('EXACT_SERVICE_CODE');
      }
      if (norm(local.name) === norm(ext.name)) {
        confidence += 0.35;
        reasons.push('EXACT_NORMALIZED_NAME');
      }
      if (confidence > 0.2) {
        candidates.push({
          externalCatalogueItemId: ext.id,
          mraServiceCode: ext.mraCode,
          confidence: Math.min(confidence, 0.99),
          reasons,
          conflicts: [],
          requiredReviewerAction: 'VERIFY_BEFORE_ACTIVATION',
          suggestedMappingType: MAPPING_TYPE.SERVICE_TO_SERVICE,
        });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    let mappingId = null;
    if (persist && candidates[0]) {
      try {
        const row = await createProductMapping({
          tenantId,
          businessId,
          localServiceId: local.localServiceId,
          externalCatalogueItemId: candidates[0].externalCatalogueItemId,
          mappingType: MAPPING_TYPE.SERVICE_TO_SERVICE,
          status: MAPPING_STATUS.SUGGESTED,
          db,
        });
        mappingId = row.id;
      } catch {
        /* ignore */
      }
    }
    suggestions.push({
      localServiceId: local.localServiceId,
      localName: local.name,
      candidates,
      mappingId,
      note: 'Service suggestions never auto-activate. Inventory/barcode not required.',
      suggestionAlgorithmVersion: ALGORITHM,
    });
  }
  return { suggestions, suggestionAlgorithmVersion: ALGORITHM, autoActivated: false };
}

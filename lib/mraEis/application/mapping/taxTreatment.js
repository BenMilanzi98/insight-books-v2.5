import { TAX_TREATMENT_TYPE } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';

/**
 * Explicit tax treatments. Zero-rated ≠ exempt. VAT5 ≠ ordinary zero-rate.
 * Rate value of zero alone does not determine treatment.
 */
export function normalizeTaxTreatment(input) {
  const t = String(input || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (Object.values(TAX_TREATMENT_TYPE).includes(t)) return t;
  if (t.includes('VAT5')) return TAX_TREATMENT_TYPE.VAT5_RELIEF;
  if (t.includes('ZERO')) return TAX_TREATMENT_TYPE.ZERO_RATED;
  if (t.includes('EXEMPT')) return TAX_TREATMENT_TYPE.EXEMPT;
  if (t.includes('RELIEF')) return TAX_TREATMENT_TYPE.RELIEF;
  if (t.includes('STANDARD') || t === 'VAT' || t === 'A') return TAX_TREATMENT_TYPE.STANDARD_RATED;
  return null;
}

export function assertCompatibleTaxTreatments(localTreatment, mraTreatment) {
  const local = normalizeTaxTreatment(localTreatment);
  const mra = normalizeTaxTreatment(mraTreatment);
  if (!local || !mra) {
    throw EisErrors.taxMappingConflict({
      message: 'Tax treatment must be explicit on both local and MRA sides.',
      details: { localTreatment, mraTreatment },
    });
  }
  if (local === TAX_TREATMENT_TYPE.VAT5_RELIEF || mra === TAX_TREATMENT_TYPE.VAT5_RELIEF) {
    if (local !== mra) {
      throw EisErrors.taxMappingConflict({
        message: 'VAT5 Relief cannot be mapped as an ordinary tax treatment.',
        code: 'VAT5_MAPPING_INVALID',
      });
    }
  }
  if (
    (local === TAX_TREATMENT_TYPE.ZERO_RATED && mra === TAX_TREATMENT_TYPE.EXEMPT) ||
    (local === TAX_TREATMENT_TYPE.EXEMPT && mra === TAX_TREATMENT_TYPE.ZERO_RATED)
  ) {
    throw EisErrors.taxMappingConflict({
      message: 'Zero-rated and exempt treatments are distinct and cannot be interchanged.',
      code: 'ZERO_RATE_EXEMPT_MISMATCH',
    });
  }
  if (local !== mra) {
    throw EisErrors.taxMappingConflict({
      message: 'Tax treatment mismatch between local and MRA definitions.',
      code: 'TREATMENT_MISMATCH',
      details: { local, mra },
    });
  }
  return { local, mra };
}

export function inferTreatmentFromExternalCategory(category, rate) {
  const c = String(category || '').toUpperCase();
  if (c.includes('VAT5')) return TAX_TREATMENT_TYPE.VAT5_RELIEF;
  if (c.includes('EXEMPT')) return TAX_TREATMENT_TYPE.EXEMPT;
  if (c.includes('ZERO') || c === 'B') return TAX_TREATMENT_TYPE.ZERO_RATED;
  if (c.includes('RELIEF')) return TAX_TREATMENT_TYPE.RELIEF;
  if (Number(rate) === 0 && !c) return null; // zero alone insufficient
  return TAX_TREATMENT_TYPE.STANDARD_RATED;
}

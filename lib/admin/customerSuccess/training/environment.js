/**
 * Training practice environment isolation — Phase 22 Wave 3 harden.
 * No Production Customer data / GL / journals / stock / MRA fiscal in exercises.
 */

import {
  TRAINING_FORBIDDEN_FISCAL_PLANES,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  resolveTrainingActor,
} from './model.js';

const FORBIDDEN_FISCAL = new Set(TRAINING_FORBIDDEN_FISCAL_PLANES);

/**
 * Assert environment isolation for practice / shared training sandboxes.
 */
export async function assertTrainingEnvironmentIsolation(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_environment_assert_forbidden',
    };
  }

  const environmentKind = String(args.environmentKind || '')
    .trim()
    .toUpperCase();
  const dataClassification = String(args.dataClassification || '')
    .trim()
    .toUpperCase();
  const fiscalPlane = String(args.fiscalPlane || args.productionPlane || '')
    .trim()
    .toUpperCase();
  const includesProductionCustomerData =
    args.includesProductionCustomerData === true ||
    dataClassification === 'PRODUCTION';

  if (fiscalPlane && FORBIDDEN_FISCAL.has(fiscalPlane)) {
    return {
      ok: false,
      error: 'production_fiscal_plane_forbidden',
      fiscalPlane,
      note: 'Exercises must not target Production GL/journals/stock/MRA fiscal',
      domain: getTrainingDomainContract(),
    };
  }

  if (
    (environmentKind === 'SHARED_PRACTICE' ||
      environmentKind === 'PRACTICE' ||
      environmentKind === 'SANDBOX') &&
    includesProductionCustomerData
  ) {
    return {
      ok: false,
      error: 'production_data_in_practice_env_forbidden',
      environmentKind,
      dataClassification,
      domain: getTrainingDomainContract(),
    };
  }

  return {
    ok: true,
    environmentKind: environmentKind || null,
    dataClassification: dataClassification || null,
    fiscalPlane: fiscalPlane || null,
    includesProductionCustomerData: false,
    isolated: true,
    programId: args.programId || null,
    domain: getTrainingDomainContract(),
  };
}

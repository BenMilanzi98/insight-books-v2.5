/**
 * Training lineage — Phase 18 Wave 4.
 * Preserve commercial → handoff → request → program → completion → certificate.
 * Portfolio-scoped via programAccess.
 */

import { getTrainingDomainContract } from './catalogue.js';
import { loadTrainingProgramForActor } from './programAccess.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, programId?: string }} args
 */
export async function getTrainingLineage(prisma, args = {}) {
  const access = await loadTrainingProgramForActor(prisma, args);
  if (!access.ok) {
    return { ...access, lineage: null };
  }

  const program = access.programRow || access.program;
  const programId = program.id;

  let certificate = null;
  if (typeof prisma.customerTrainingCertificate?.findFirst === 'function') {
    certificate = await prisma.customerTrainingCertificate.findFirst({
      where: { programId },
    });
  }

  return {
    ok: true,
    lineage: {
      conversionId: program.conversionId || null,
      handoffId: program.handoffId || null,
      trainingRequestId: program.trainingRequestId || null,
      onboardingProjectId: program.onboardingProjectId || null,
      program: access.program,
      certificateId: certificate?.id || null,
      certificateChecksum: certificate?.checksum || null,
    },
    domain: getTrainingDomainContract(),
  };
}

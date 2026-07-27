import prisma from '@/lib/prisma.js';
import { RECEIPT_EIS_STATUS } from '../../domain/operationalEnums.js';

/**
 * Read-only integrity validators for Phase 5 foundation.
 * Do not auto-correct accepted evidence.
 */
export async function runEisIntegrityChecks({ tenantId = null, businessId = null, db = prisma } = {}) {
  const findings = [];

  const terminals = await db.mraEisTerminal.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(businessId ? { businessId } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      businessId: true,
      status: true,
      currentCredentialReferenceId: true,
      offlineCertified: true,
    },
  });

  for (const t of terminals) {
    if (t.tenantId !== t.businessId) {
      findings.push({
        code: 'TERMINAL_TENANT_BUSINESS_MISMATCH',
        severity: 'CRITICAL',
        entityType: 'MraEisTerminal',
        entityId: t.id,
      });
    }
    if (t.status === 'ACTIVE' && !t.currentCredentialReferenceId) {
      findings.push({
        code: 'ACTIVE_TERMINAL_WITHOUT_CREDENTIAL_REF',
        severity: 'HIGH',
        entityType: 'MraEisTerminal',
        entityId: t.id,
      });
    }
  }

  const falseValidated = await db.mraEisReceiptProjection.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      eisStatus: {
        in: [
          RECEIPT_EIS_STATUS.EIS_PENDING,
          RECEIPT_EIS_STATUS.EIS_REJECTED,
          RECEIPT_EIS_STATUS.EIS_UNKNOWN_OUTCOME,
        ],
      },
      NOT: { validationUrl: null },
    },
    select: { id: true, eisStatus: true },
    take: 100,
  });
  for (const r of falseValidated) {
    findings.push({
      code: 'PENDING_OR_REJECTED_HAS_VALIDATION_URL',
      severity: 'CRITICAL',
      entityType: 'MraEisReceiptProjection',
      entityId: r.id,
    });
  }

  const offlineWithoutCert = await db.mraEisOfflineQueueEntry.findMany({
    where: tenantId ? { tenantId } : {},
    select: { id: true, terminalId: true },
    take: 100,
  });
  for (const o of offlineWithoutCert) {
    const terminal = await db.mraEisTerminal.findUnique({
      where: { id: o.terminalId },
      select: { offlineCertified: true },
    });
    if (terminal && !terminal.offlineCertified) {
      findings.push({
        code: 'OFFLINE_ENTRY_WITHOUT_CERTIFICATION',
        severity: 'CRITICAL',
        entityType: 'MraEisOfflineQueueEntry',
        entityId: o.id,
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    findingCount: findings.length,
    findings,
  };
}

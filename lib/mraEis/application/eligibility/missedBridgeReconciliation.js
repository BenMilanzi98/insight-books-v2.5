/**
 * Missed-bridge reconciliation scan — Phase 11.
 * Dry-run by default. Never reposts accounting or inventory.
 * Does not broadly backfill historical pre-go-live transactions.
 */
import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { resolveEisGoLiveBoundary } from './eisApplicability.js';
import {
  attachEisSalesBridgeAfterFinalization,
  BRIDGE_STATUS,
  appendFiscalSnapshotRequestedOutbox,
  transitionSalesBridge,
} from './salesBridgeService.js';
import { SALES_SOURCE_TYPE } from './salesTransactionTypeRegistry.js';
import { SalesEligibilityErrors } from './salesEligibilityErrors.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

export const HISTORICAL_CLASS = Object.freeze({
  BEFORE_EIS_GO_LIVE: 'BEFORE_EIS_GO_LIVE',
  AFTER_GO_LIVE_ALREADY_BRIDGED: 'AFTER_GO_LIVE_ALREADY_BRIDGED',
  AFTER_GO_LIVE_BRIDGE_MISSING: 'AFTER_GO_LIVE_BRIDGE_MISSING',
  AMBIGUOUS_FINALIZATION_DATE: 'AMBIGUOUS_FINALIZATION_DATE',
  SOURCE_DATA_INCOMPLETE: 'SOURCE_DATA_INCOMPLETE',
  CORRECTION_WORKFLOW_REQUIRED: 'CORRECTION_WORKFLOW_REQUIRED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

/**
 * Scan for missed bridges / missing outbox (read-only unless repair approved).
 */
export async function scanMissedSalesBridges({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  dryRun = true,
  limit = 50,
  repairMissingBridge = false,
  repairMissingOutbox = false,
  approvedBy = null,
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const goLive = await resolveEisGoLiveBoundary({ tenantId, businessId, environment, db });
  const findings = [];

  const saleWhere = {
    tenantId,
    status: { in: ['Completed', 'COMPLETED', 'Paid', 'PAID', 'Finalized', 'FINALIZED'] },
  };
  if (goLive.eisGoLiveAt) {
    saleWhere.saleDate = { gte: goLive.eisGoLiveAt };
  }

  const sales = await db.sale.findMany({
    where: saleWhere,
    take: limit,
    orderBy: { saleDate: 'desc' },
    include: { items: true, payments: true },
  }).catch(() => []);

  for (const sale of sales) {
    if (goLive.eisGoLiveAt && sale.saleDate && new Date(sale.saleDate) < goLive.eisGoLiveAt) {
      findings.push({
        sourceType: SALES_SOURCE_TYPE.POS_SALE,
        sourceId: sale.id,
        classification: HISTORICAL_CLASS.BEFORE_EIS_GO_LIVE,
        action: 'EXCLUDE',
      });
      continue;
    }

    const bridges = await db.mraEisSalesBridge.findMany({
      where: {
        tenantId,
        businessId,
        sourceType: SALES_SOURCE_TYPE.POS_SALE,
        sourceId: sale.id,
        environment: String(environment).toUpperCase(),
      },
    });

    if (bridges.length > 1) {
      findings.push({
        sourceType: SALES_SOURCE_TYPE.POS_SALE,
        sourceId: sale.id,
        classification: HISTORICAL_CLASS.MANUAL_REVIEW,
        action: 'ALERT_DUPLICATE_BRIDGES',
        bridgeIds: bridges.map((b) => b.id),
      });
      continue;
    }

    if (!bridges.length) {
      findings.push({
        sourceType: SALES_SOURCE_TYPE.POS_SALE,
        sourceId: sale.id,
        classification: HISTORICAL_CLASS.AFTER_GO_LIVE_BRIDGE_MISSING,
        action: dryRun || !repairMissingBridge ? 'DRY_RUN_REPORT' : 'REPAIR_CREATE_BRIDGE',
        saleNumber: sale.saleNumber,
      });

      if (!dryRun && repairMissingBridge) {
        if (!approvedBy) {
          throw SalesEligibilityErrors.eligibilityBlocked({
            message: 'Bridge repair requires approval.',
            code: 'MRA_EIS_BRIDGE_REPAIR_APPROVAL_REQUIRED',
          });
        }
        await attachEisSalesBridgeAfterFinalization({
          tenantId,
          businessId,
          sourceType: SALES_SOURCE_TYPE.POS_SALE,
          sourceId: sale.id,
          sourceVersion: String(sale.updatedAt?.getTime?.() || '1'),
          sourceState: 'COMPLETED',
          sourceTransactionNumber: sale.saleNumber,
          finalizedAt: sale.saleDate || sale.createdAt,
          branchId: sale.branchId,
          environment,
          currency: 'MWK',
          lines: (sale.items || []).map((i) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxAmount: i.taxAmount,
            description: i.description,
            isService: i.isService,
          })),
          payments: (sale.payments || []).map((p) => ({
            localPaymentMethodId: p.paymentMethod || p.method || 'Cash',
            amount: p.amount,
          })),
          header: {
            subtotal: sale.subtotal,
            taxAmount: sale.totalTaxAmount || sale.taxAmount,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
          },
          buyer: { customerName: sale.clientName, customerTPIN: sale.customerTPIN },
          blockFinalizationOnEligibilityFailure: false,
          actorContext: { userId: approvedBy },
          db,
        });
      }
      continue;
    }

    const bridge = bridges[0];
    findings.push({
      sourceType: SALES_SOURCE_TYPE.POS_SALE,
      sourceId: sale.id,
      classification: HISTORICAL_CLASS.AFTER_GO_LIVE_ALREADY_BRIDGED,
      bridgeId: bridge.id,
      bridgeStatus: bridge.status,
      action: 'NONE',
    });

    if (
      bridge.status === BRIDGE_STATUS.ELIGIBLE ||
      bridge.status === BRIDGE_STATUS.OUTBOX_PENDING
    ) {
      const outbox = await db.mraEisOutbox.findFirst({
        where: {
          tenantId,
          aggregateType: 'MraEisSalesBridge',
          aggregateId: bridge.id,
        },
      });
      if (!outbox) {
        findings.push({
          sourceType: SALES_SOURCE_TYPE.POS_SALE,
          sourceId: sale.id,
          bridgeId: bridge.id,
          classification: HISTORICAL_CLASS.AFTER_GO_LIVE_BRIDGE_MISSING,
          action: dryRun || !repairMissingOutbox ? 'MISSING_OUTBOX' : 'REPAIR_CREATE_OUTBOX',
        });
        if (!dryRun && repairMissingOutbox && approvedBy) {
          if (bridge.status === BRIDGE_STATUS.ELIGIBLE) {
            await transitionSalesBridge({
              bridgeId: bridge.id,
              tenantId,
              businessId,
              fromStatus: BRIDGE_STATUS.ELIGIBLE,
              toStatus: BRIDGE_STATUS.OUTBOX_PENDING,
              expectedVersion: bridge.version,
              db,
              actorId: approvedBy,
            });
          }
          const refreshed = await db.mraEisSalesBridge.findUnique({ where: { id: bridge.id } });
          await appendFiscalSnapshotRequestedOutbox({
            tenantId,
            businessId,
            bridge: refreshed,
            eligibilityDecisionId: refreshed.eligibilityDecisionId,
            db,
          });
        }
      }
    }
  }

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: approvedBy,
    actorType: approvedBy ? 'USER' : 'SERVICE',
    action: 'MISSED_BRIDGE_SCAN',
    resourceType: 'MraEisSalesBridge',
    resourceId: tenantId,
    metadata: {
      dryRun,
      repairMissingBridge,
      repairMissingOutbox,
      findingCount: findings.length,
      repostsAccounting: false,
      repostsInventory: false,
    },
  }, db).catch(() => {});

  return {
    tenantId,
    businessId,
    environment,
    dryRun,
    goLive,
    findings,
    summary: {
      missingBridges: findings.filter((f) => f.classification === HISTORICAL_CLASS.AFTER_GO_LIVE_BRIDGE_MISSING).length,
      alreadyBridged: findings.filter((f) => f.classification === HISTORICAL_CLASS.AFTER_GO_LIVE_ALREADY_BRIDGED).length,
      beforeGoLive: findings.filter((f) => f.classification === HISTORICAL_CLASS.BEFORE_EIS_GO_LIVE).length,
      manualReview: findings.filter((f) => f.classification === HISTORICAL_CLASS.MANUAL_REVIEW).length,
    },
    guarantees: {
      repostsAccounting: false,
      repostsInventory: false,
      submitsToMra: false,
      broadHistoricalBackfill: false,
    },
  };
}

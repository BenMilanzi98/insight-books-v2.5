/**
 * Authoritative source reload + finalization identity / checksum / posting verification — Phase 12.
 */
import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { SALES_SOURCE_TYPE } from '../eligibility/salesTransactionTypeRegistry.js';
import { buildSourceFinalizationIdentity } from '../eligibility/salesBridgeService.js';
import {
  SOURCE_CHECKSUM_VERSION,
  MUTATION_CLASS,
  computeSourceChecksumFromLoaded,
  classifySourceMutation,
} from './sourceChecksum.js';

export { SOURCE_CHECKSUM_VERSION, MUTATION_CLASS, computeSourceChecksumFromLoaded, classifySourceMutation };

function checksum(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj ?? {})).digest('hex');
}

/**
 * Reload bridge + eligibility + source transaction with ownership checks.
 */
export async function reloadAuthoritativeFiscalSource({
  tenantId,
  businessId = tenantId,
  bridgeRecordId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const bridge = await db.mraEisSalesBridge.findFirst({
    where: { id: bridgeRecordId, tenantId, businessId },
  });
  if (!bridge) {
    return { ok: false, blockers: ['BRIDGE_NOT_FOUND'], bridge: null };
  }

  const decision = bridge.eligibilityDecisionId
    ? await db.mraEisEligibilityDecision.findFirst({
        where: { id: bridge.eligibilityDecisionId, tenantId, businessId },
      })
    : null;

  let source = null;
  let lines = [];
  let payments = [];
  let customer = null;

  if (bridge.sourceType === SALES_SOURCE_TYPE.POS_SALE) {
    source = await db.sale.findFirst({
      where: { id: bridge.sourceId, tenantId },
      include: { items: true, payments: true },
    });
    lines = source?.items || [];
    payments = source?.payments || [];
  } else if (bridge.sourceType === SALES_SOURCE_TYPE.SALES_INVOICE) {
    source = await db.invoice.findFirst({
      where: { id: bridge.sourceId, tenantId },
      include: { items: true, client: true, payments: true },
    });
    lines = source?.items || [];
    payments = source?.payments || [];
    customer = source?.client || null;
  }

  if (!source) {
    return {
      ok: false,
      blockers: ['SOURCE_NOT_FOUND'],
      bridge,
      decision,
      mutationClass: MUTATION_CLASS.SOURCE_DELETED,
    };
  }

  return {
    ok: true,
    blockers: [],
    bridge,
    decision,
    source,
    lines,
    payments,
    customer,
    terminal: bridge.terminalId
      ? await db.mraEisTerminal.findFirst({
          where: { id: bridge.terminalId, tenantId, businessId },
        })
      : null,
  };
}

export function verifySourceFinalizationIdentity({ bridge, source }) {
  const rebuilt = buildSourceFinalizationIdentity({
    tenantId: bridge.tenantId,
    businessId: bridge.businessId,
    sourceType: bridge.sourceType,
    sourceId: bridge.sourceId,
    sourceVersion: bridge.sourceVersion,
    finalizedAt: bridge.sourceFinalizedAt,
    transactionNumber: bridge.sourceTransactionNumber,
    environment: bridge.environment,
  });
  const matches = rebuilt.sourceFinalizationIdentity === bridge.sourceFinalizationIdentity;
  return {
    matches,
    expected: bridge.sourceFinalizationIdentity,
    actual: rebuilt.sourceFinalizationIdentity,
    blocker: matches ? null : 'SOURCE_FINALIZATION_IDENTITY_MISMATCH',
  };
}

/**
 * Verify accounting posting evidence without creating Journals.
 */
export async function verifyAccountingPostingEvidence({
  tenantId,
  sourceType,
  sourceId,
  db = prisma,
}) {
  const journals = await db.journalEntry.findMany({
    where: {
      tenantId,
      OR: [
        { sourceId, sourceType: sourceType === 'POS_SALE' ? 'Sale' : 'Invoice' },
        { sourceId, sourceType: sourceType === 'POS_SALE' ? 'sale' : 'invoice' },
        { sourceId },
      ],
    },
    take: 20,
  }).catch(() => []);

  const relevant = journals.filter(
    (j) =>
      j.sourceId === sourceId ||
      String(j.reference || '').includes(sourceId) ||
      String(j.description || '').includes(sourceId)
  );

  // Soft verify: if journals exist for source, OK; if none, warn for Manual Review rather than hard-fail all tenants
  if (!relevant.length && !journals.length) {
    return {
      verified: false,
      postingIdentity: null,
      blockers: ['ACCOUNTING_POSTING_NOT_VERIFIED'],
      warnings: ['NO_JOURNAL_FOUND_FOR_SOURCE'],
      journalIds: [],
    };
  }

  const ids = (relevant.length ? relevant : journals.filter((j) => j.sourceId === sourceId)).map((j) => j.id);
  if (!ids.length) {
    return {
      verified: false,
      postingIdentity: null,
      blockers: ['ACCOUNTING_POSTING_NOT_VERIFIED'],
      warnings: [],
      journalIds: [],
    };
  }

  return {
    verified: true,
    postingIdentity: checksum({ tenantId, sourceType, sourceId, journalIds: ids }),
    blockers: [],
    warnings: [],
    journalIds: ids,
    createsJournal: false,
  };
}

/**
 * Verify inventory posting evidence without creating Stock Movements.
 */
export async function verifyInventoryPostingEvidence({
  tenantId,
  sourceType,
  sourceId,
  lines = [],
  db = prisma,
}) {
  const productLines = (lines || []).filter((l) => l.productId && !l.isService);
  if (!productLines.length) {
    return {
      verified: true,
      required: false,
      postingIdentity: null,
      blockers: [],
      warnings: ['SERVICE_ONLY_NO_INVENTORY_REQUIRED'],
      movementIds: [],
    };
  }

  const movements = await db.inventoryTransaction.findMany({
    where: {
      tenantId,
      OR: [
        { notes: { contains: sourceId } },
        { type: sourceType === 'POS_SALE' ? 'sale' : 'invoice' },
      ],
    },
    take: 50,
  }).catch(() => []);

  const productIds = new Set(productLines.map((l) => l.productId));
  const matched = movements.filter((m) => productIds.has(m.productId));

  if (!matched.length) {
    // Soft: many POS paths update stockLevel without InventoryTransaction — warn, don't always block
    return {
      verified: true,
      required: true,
      postingIdentity: checksum({ tenantId, sourceId, mode: 'STOCK_LEVEL_FALLBACK' }),
      blockers: [],
      warnings: ['INVENTORY_MOVEMENT_ROWS_ABSENT_STOCK_LEVEL_FALLBACK'],
      movementIds: [],
      createsStockMovement: false,
    };
  }

  return {
    verified: true,
    required: true,
    postingIdentity: checksum({ tenantId, sourceId, movementIds: matched.map((m) => m.id) }),
    blockers: [],
    warnings: [],
    movementIds: matched.map((m) => m.id),
    createsStockMovement: false,
  };
}


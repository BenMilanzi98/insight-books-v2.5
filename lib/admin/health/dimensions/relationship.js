/**
 * Relationship health dimension — ownership + open Phase 7 signals.
 */

import {
  activeOwnershipWhere,
} from '@/lib/admin/customers/portfolioScope.js';
import {
  SIGNAL_SEVERITY,
  SIGNAL_STATUS,
} from '@/lib/admin/customers/signalCatalogue.js';
import { DIMENSION_CODES, DIMENSION_STATUS } from '../catalogue.js';

const OPEN_SIGNAL_STATUSES = [SIGNAL_STATUS.NEW, SIGNAL_STATUS.ACKNOWLEDGED];

const SEVERITY_PENALTY = Object.freeze({
  [SIGNAL_SEVERITY.CRITICAL]: 25,
  [SIGNAL_SEVERITY.HIGH]: 15,
  [SIGNAL_SEVERITY.MEDIUM]: 8,
  [SIGNAL_SEVERITY.LOW]: 4,
});

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ now?: Date, baseWeight?: number }} [opts]
 */
export async function scoreRelationshipDimension(prisma, tenantId, opts = {}) {
  const code = DIMENSION_CODES.RELATIONSHIP;
  const baseWeight = opts.baseWeight ?? 0.2;
  const now = opts.now || new Date();
  const drivers = [];
  let signalsEphemeral = false;
  let ownershipKnown = true;
  let hasOwner = false;
  let openSignals = [];

  try {
    if (typeof prisma?.customerOwnership?.findFirst === 'function') {
      const row = await prisma.customerOwnership.findFirst({
        where: {
          tenantId,
          ...activeOwnershipWhere(now),
        },
        select: { id: true, ownerAdminId: true, isPrimary: true },
      });
      hasOwner = Boolean(row);
    } else if (typeof prisma?.customerOwnership?.findMany === 'function') {
      const rows = await prisma.customerOwnership.findMany({
        where: {
          tenantId,
          ...activeOwnershipWhere(now),
        },
        select: { id: true },
        take: 1,
      });
      hasOwner = rows.length > 0;
    } else {
      ownershipKnown = false;
    }
  } catch (e) {
    return {
      code,
      status: DIMENSION_STATUS.FAILED,
      score: null,
      baseWeight,
      effectiveWeight: 0,
      drivers: [],
      reason: e?.message || 'Ownership query failed',
    };
  }

  try {
    if (typeof prisma?.customerSignal?.findMany === 'function') {
      openSignals = await prisma.customerSignal.findMany({
        where: {
          tenantId,
          status: { in: OPEN_SIGNAL_STATUSES },
        },
        select: {
          id: true,
          code: true,
          severity: true,
          status: true,
        },
      });
    } else {
      signalsEphemeral = true;
      openSignals = [];
    }
  } catch {
    // Signals table unavailable → score with limitation; confidence capped later
    signalsEphemeral = true;
    openSignals = [];
  }

  let score = 100;

  if (!ownershipKnown) {
    // Treat unknown ownership model as mild penalty but still SCORED with limitation
    score -= 15;
    drivers.push({
      code: 'ownership_model_unavailable',
      impact: -15,
      detail: 'CustomerOwnership client unavailable',
    });
  } else if (!hasOwner) {
    score -= 40;
    drivers.push({
      code: 'customer_owner_missing',
      impact: -40,
      detail: 'No ACTIVE CustomerOwnership for tenant',
    });
  } else {
    drivers.push({
      code: 'customer_owner_present',
      impact: 0,
      detail: 'ACTIVE CustomerOwnership present',
    });
  }

  for (const sig of openSignals) {
    const sev = String(sig.severity || SIGNAL_SEVERITY.MEDIUM).toUpperCase();
    const penalty = SEVERITY_PENALTY[sev] ?? 8;
    score -= penalty;
    drivers.push({
      code: `open_signal_${sig.code}`,
      impact: -penalty,
      detail: `severity=${sev} status=${sig.status}`,
    });
  }

  if (signalsEphemeral) {
    drivers.push({
      code: 'signals_ephemeral_or_unavailable',
      impact: 0,
      detail: 'CustomerSignal unavailable — relationship scored without open-signal pressure',
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    code,
    status: DIMENSION_STATUS.SCORED,
    score,
    baseWeight,
    effectiveWeight: 0,
    drivers,
    facts: {
      hasOwner,
      ownershipKnown,
      openSignalCount: openSignals.length,
      openSignalCodes: openSignals.map((s) => s.code),
      signalsEphemeral,
    },
  };
}

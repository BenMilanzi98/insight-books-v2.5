import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import { EisErrors } from '../domain/errors.js';

export function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
}

/**
 * Claim or return prior idempotent result.
 * @returns {{ hit: boolean, result?: object }}
 */
export async function beginIdempotentAction({
  actionKey,
  requestId,
  tenantId = null,
  businessId = null,
  payload,
  db = prisma,
}) {
  if (!requestId) return { hit: false };
  const payloadHash = hashPayload(payload);
  const identity = `${actionKey}:${requestId}`;

  const existing = await db.mraEisControlIdempotency.findUnique({ where: { identity } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw EisErrors.idempotencyConflict({
        tenantId,
        businessId,
        details: { identity },
      });
    }
    return { hit: true, result: existing.result };
  }

  try {
    await db.mraEisControlIdempotency.create({
      data: {
        identity,
        actionKey,
        requestId,
        tenantId,
        businessId,
        payloadHash,
        status: 'IN_PROGRESS',
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const again = await db.mraEisControlIdempotency.findUnique({ where: { identity } });
      if (again?.payloadHash !== payloadHash) {
        throw EisErrors.idempotencyConflict({ tenantId, businessId });
      }
      if (again?.result) return { hit: true, result: again.result };
    }
    throw err;
  }

  return { hit: false, identity, payloadHash };
}

export async function completeIdempotentAction({ identity, result, db = prisma }) {
  if (!identity) return;
  await db.mraEisControlIdempotency.update({
    where: { identity },
    data: {
      status: 'COMPLETED',
      result,
      completedAt: new Date(),
    },
  });
}

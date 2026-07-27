import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { EisErrors } from '../../domain/errors.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

/**
 * Stable, non-ephemeral platform identity for EIS terminals.
 * Does NOT use container IDs or browser-generated values.
 * Format: ibeis:{env}:{tenant}:{business}:{installationHash}
 */
export async function ensureStablePlatformIdentity({
  tenantId,
  businessId = tenantId,
  environment,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  if (env === 'PRODUCTION') {
    throw EisErrors.validation({
      message: 'Production SaaS terminal identity is blocked pending MRA clarification (Q-017–019).',
      code: 'STABLE_PLATFORM_IDENTITY_REQUIRED',
    });
  }

  const existing = await db.mraEisPlatformIdentity.findFirst({
    where: { tenantId, businessId, environment: env, identityKey: 'INSTALLATION', status: 'ACTIVE' },
  });
  if (existing) return existing;

  const seed =
    process.env.MRA_EIS_INSTALLATION_ID ||
    process.env.APP_URL ||
    'insightbooks-local-installation';
  const hash = crypto
    .createHash('sha256')
    .update(`${seed}|${tenantId}|${businessId}|${env}|v1`)
    .digest('hex')
    .slice(0, 32);
  const identityValue = `ibeis:${env.toLowerCase()}:${tenantId.slice(0, 8)}:${hash}`;

  const row = await db.mraEisPlatformIdentity.create({
    data: {
      tenantId,
      businessId,
      environment: env,
      identityKey: 'INSTALLATION',
      identityValue,
      version: 'v1',
      status: 'ACTIVE',
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorType: 'SERVICE',
    action: 'STABLE_IDENTITY_ASSIGNED',
    resourceType: 'MraEisPlatformIdentity',
    resourceId: row.id,
    environment: env,
    metadata: { identityKey: 'INSTALLATION', version: 'v1' },
  }, db);

  return row;
}

import './serverOnly.js';
import prisma from '@/lib/prisma.js';
import { envelopeEncrypt, envelopeDecrypt } from './envelopeEncryption.js';
import { CryptoErrors } from './cryptoErrors.js';
import { EIS_SECRET_TYPE } from './secretTypes.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../audit.js';
import { redactSecrets } from './redaction.js';
import { incSecurityMetric } from './securityMetrics.js';
import { EIS_SERVICE_IDENTITY } from './serviceIdentity.js';

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export async function storeEphemeralSecret({
  tenantId,
  businessId = tenantId,
  terminalId = null,
  environment,
  secretType,
  purpose,
  plaintext,
  ttlMs = DEFAULT_TTL_MS,
  oneTime = true,
  createdByService = EIS_SERVICE_IDENTITY.PHASE6_SECURITY_SERVICE,
  requestId = null,
  correlationId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (
    ![
      EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE,
      EIS_SECRET_TYPE.MRA_BUYER_AUTHORIZATION_CODE,
    ].includes(secretType)
  ) {
    throw CryptoErrors.secretStore({ message: 'Invalid ephemeral secret type.' });
  }
  if (!plaintext || String(plaintext).length < 4) {
    throw CryptoErrors.secretStore({ message: 'Ephemeral secret format invalid.' });
  }

  const id = `eph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const sealed = envelopeEncrypt(plaintext, {
    tenantId,
    businessId,
    terminalId: terminalId || '',
    environment,
    secretType,
    ephemeralId: id,
  });

  const row = await db.mraEisEphemeralSecret.create({
    data: {
      id,
      tenantId,
      businessId,
      terminalId,
      environment,
      secretType,
      purpose,
      ciphertext: sealed.ciphertext,
      wrappedDataKey: sealed.wrappedDataKey,
      nonce: sealed.nonce,
      authenticationTag: sealed.authenticationTag,
      masterKeyId: sealed.masterKeyId,
      keyVersion: sealed.keyVersion,
      metadataHash: sealed.authenticatedMetadataHash,
      expiresAt: new Date(Date.now() + ttlMs),
      oneTime,
      createdByService,
      requestId,
      correlationId,
    },
  });

  incSecurityMetric(
    secretType === EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE
      ? 'eis.tac.creations'
      : 'eis.buyer_auth.creations'
  );

  await recordEisControlAudit(
    {
      tenantId,
      businessId,
      actorType: 'SERVICE',
      actorId: createdByService,
      action:
        secretType === EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE
          ? 'TAC_STORED_EPHEMERALLY'
          : 'BUYER_AUTH_STORED_EPHEMERALLY',
      resourceType: 'MraEisEphemeralSecret',
      resourceId: row.id,
      environment,
      metadata: redactSecrets({ purpose, expiresAt: row.expiresAt, oneTime }),
    },
    db
  );

  return { ephemeralSecretId: row.id, expiresAt: row.expiresAt, secretType };
}

export async function withEphemeralSecret(
  {
    ephemeralSecretId,
    tenantId,
    businessId = tenantId,
    terminalId = null,
    environment,
    secretType,
    destroyAfter = true,
    db = prisma,
  },
  fn
) {
  assertTenantBusinessMatch(tenantId, businessId);
  const row = await db.mraEisEphemeralSecret.findFirst({
    where: { id: ephemeralSecretId, tenantId, businessId, secretType },
  });
  if (!row || row.destroyedAt) throw CryptoErrors.ephemeralExpired();
  if (row.oneTime && row.consumedAt) {
    throw CryptoErrors.ephemeralExpired({ message: 'Ephemeral secret already consumed.' });
  }
  if (row.expiresAt < new Date()) throw CryptoErrors.ephemeralExpired();
  if (environment && row.environment !== environment) throw CryptoErrors.environmentMismatch();
  if (terminalId && row.terminalId && row.terminalId !== terminalId) throw CryptoErrors.terminalMismatch();

  let plaintext = envelopeDecrypt(row, {
    tenantId,
    businessId,
    terminalId: row.terminalId || '',
    environment: row.environment,
    secretType: row.secretType,
    ephemeralId: row.id,
  });

  await db.mraEisEphemeralSecret.update({
    where: { id: row.id },
    data: {
      // Mark consumed only on final destroy or strict one-time leases
      ...(row.oneTime || destroyAfter ? { consumedAt: new Date() } : {}),
      ...(destroyAfter
        ? {
            destroyedAt: new Date(),
            ciphertext: 'DESTROYED',
            wrappedDataKey: 'DESTROYED',
            nonce: 'DESTROYED',
            authenticationTag: 'DESTROYED',
          }
        : {}),
    },
  });

  await recordEisControlAudit(
    {
      tenantId,
      businessId,
      actorType: 'SERVICE',
      action:
        secretType === EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE
          ? 'TAC_ACCESSED'
          : 'BUYER_AUTH_ACCESSED',
      resourceType: 'MraEisEphemeralSecret',
      resourceId: row.id,
      environment: row.environment,
      metadata: redactSecrets({ destroyed: destroyAfter }),
    },
    db
  );

  try {
    return await fn(plaintext);
  } finally {
    plaintext = null;
  }
}

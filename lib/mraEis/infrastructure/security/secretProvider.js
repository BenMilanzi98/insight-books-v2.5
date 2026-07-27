import './serverOnly.js';
import prisma from '@/lib/prisma.js';
import { envelopeEncrypt, envelopeDecrypt, rewrapDataKey } from './envelopeEncryption.js';
import { CryptoErrors } from './cryptoErrors.js';
import {
  CREDENTIAL_SECRET_STATUS,
  CREDENTIAL_TYPE_TO_SECRET,
  EIS_SECRET_TYPE,
  SECRET_TYPE_POLICY,
} from './secretTypes.js';
import { assertServiceMayAccess, EIS_SERVICE_IDENTITY } from './serviceIdentity.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../audit.js';
import { redactSecrets, safeFingerprint } from './redaction.js';
import { incSecurityMetric } from './securityMetrics.js';
import crypto from 'crypto';

function vaultRef(encryptedSecretId) {
  return `env-envelope://v1/${encryptedSecretId}`;
}

function mapCredentialType(credentialType) {
  return CREDENTIAL_TYPE_TO_SECRET[credentialType] || EIS_SECRET_TYPE.OTHER_APPROVED_SECRET;
}

async function auditAccess(db, payload) {
  await recordEisControlAudit(
    {
      tenantId: payload.tenantId,
      businessId: payload.businessId,
      actorType: 'SERVICE',
      actorId: payload.serviceIdentity,
      action: payload.action,
      resourceType: 'MraEisEncryptedSecret',
      resourceId: payload.credentialReferenceId || payload.encryptedSecretId,
      newStatus: payload.outcome,
      environment: payload.environment,
      reason: payload.reason || null,
      metadata: redactSecrets({
        secretType: payload.secretType,
        operation: payload.operation,
        keyVersion: payload.keyVersion,
        fingerprint: payload.fingerprint,
        requestId: payload.requestId,
        correlationId: payload.correlationId,
      }),
    },
    db
  );
}

/**
 * Store plaintext once → encrypt → persist ciphertext → return safe reference metadata only.
 */
export async function storeSecret({
  tenantId,
  businessId = tenantId,
  terminalId,
  environment,
  credentialType,
  plaintext,
  expiresAt = null,
  serviceIdentity = EIS_SERVICE_IDENTITY.PHASE6_SECURITY_SERVICE,
  createdByService = 'phase6-secret-provider',
  activate = true,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const secretType = mapCredentialType(credentialType);
  assertServiceMayAccess({
    serviceIdentity,
    secretType,
    operation: 'CREDENTIAL_ROTATION',
  });

  const policy = SECRET_TYPE_POLICY[secretType];
  if (policy?.ephemeral) {
    throw CryptoErrors.secretStore({
      message: 'Use ephemeral secret store for TAC / buyer authorization codes.',
    });
  }

  return db.$transaction(async (tx) => {
    const terminal = await tx.mraEisTerminal.findFirst({
      where: { id: terminalId, tenantId, businessId },
    });
    if (!terminal) throw CryptoErrors.secretAccessDenied({ message: 'Terminal not in scope.' });
    if (terminal.environment && terminal.environment !== environment) {
      throw CryptoErrors.environmentMismatch();
    }

    const ref = await tx.mraEisCredentialReference.create({
      data: {
        tenantId,
        businessId,
        terminalId,
        environment,
        credentialType,
        provider: 'ENV_ENVELOPE',
        vaultReference: `pending:${crypto.randomUUID()}`,
        keyVersion: 'v1',
        status: activate ? CREDENTIAL_SECRET_STATUS.ACTIVE : CREDENTIAL_SECRET_STATUS.PENDING,
        activatedAt: activate ? new Date() : null,
        expiresAt,
        createdByService,
        version: 1,
      },
    });

    const sealed = envelopeEncrypt(plaintext, {
      tenantId,
      businessId,
      terminalId,
      environment,
      credentialType: secretType,
      credentialReferenceId: ref.id,
    });

    const enc = await tx.mraEisEncryptedSecret.create({
      data: {
        credentialReferenceId: ref.id,
        tenantId,
        businessId,
        terminalId,
        environment,
        credentialType: secretType,
        ...sealed,
        status: activate ? CREDENTIAL_SECRET_STATUS.ACTIVE : CREDENTIAL_SECRET_STATUS.PENDING,
      },
    });

    const updatedRef = await tx.mraEisCredentialReference.update({
      where: { id: ref.id },
      data: {
        vaultReference: vaultRef(enc.id),
        keyVersion: sealed.keyVersion,
        metadataChecksum: sealed.authenticatedMetadataHash,
      },
    });

    if (activate) {
      await tx.mraEisCredentialReference.updateMany({
        where: {
          terminalId,
          credentialType,
          status: CREDENTIAL_SECRET_STATUS.ACTIVE,
          NOT: { id: ref.id },
        },
        data: {
          status: CREDENTIAL_SECRET_STATUS.ROTATED,
          rotatedAt: new Date(),
          replacedByReferenceId: ref.id,
        },
      });
      await tx.mraEisEncryptedSecret.updateMany({
        where: {
          terminalId,
          credentialType: secretType,
          status: CREDENTIAL_SECRET_STATUS.ACTIVE,
          NOT: { id: enc.id },
        },
        data: { status: CREDENTIAL_SECRET_STATUS.ROTATED, rotatedAt: new Date() },
      });
      await tx.mraEisTerminal.updateMany({
        where: { id: terminalId, tenantId, businessId },
        data: { currentCredentialReferenceId: ref.id },
      });
    }

    incSecurityMetric('eis.secret.stores');
    await auditAccess(tx, {
      tenantId,
      businessId,
      environment,
      serviceIdentity,
      action: 'CREDENTIAL_ENCRYPTED',
      credentialReferenceId: ref.id,
      secretType,
      operation: 'STORE',
      outcome: updatedRef.status,
      keyVersion: sealed.keyVersion,
      fingerprint: safeFingerprint(plaintext),
    });

    return {
      credentialReferenceId: updatedRef.id,
      credentialType,
      secretType,
      status: updatedRef.status,
      environment,
      createdAt: updatedRef.createdAt,
      expiresAt: updatedRef.expiresAt,
      keyVersion: updatedRef.keyVersion,
      fingerprint: safeFingerprint(plaintext),
      vaultReference: updatedRef.vaultReference,
    };
  });
}

/**
 * Narrow decryption via callback — plaintext never returned to caller as a free string API.
 */
export async function withSecret(
  {
    credentialReferenceId,
    tenantId,
    businessId = tenantId,
    terminalId,
    environment,
    operation,
    serviceIdentity,
    requestId = null,
    correlationId = null,
    db = prisma,
  },
  fn
) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (typeof fn !== 'function') throw CryptoErrors.secretAccessDenied({ message: 'Callback required.' });

  const ref = await db.mraEisCredentialReference.findFirst({
    where: { id: credentialReferenceId, tenantId, businessId },
  });
  if (!ref) {
    incSecurityMetric('eis.secret.access_denials');
    throw CryptoErrors.secretNotFound();
  }
  if (ref.terminalId !== terminalId) throw CryptoErrors.terminalMismatch();
  if (ref.environment !== environment) throw CryptoErrors.environmentMismatch();

  const secretType = mapCredentialType(ref.credentialType);
  try {
    assertServiceMayAccess({ serviceIdentity, secretType, operation });
  } catch (err) {
    incSecurityMetric('eis.secret.access_denials');
    await auditAccess(db, {
      tenantId,
      businessId,
      environment,
      serviceIdentity,
      action: 'CREDENTIAL_ACCESS_DENIED',
      credentialReferenceId,
      secretType,
      operation,
      outcome: 'DENIED',
      reason: err.message,
      requestId,
      correlationId,
    });
    throw err;
  }

  if (ref.status === CREDENTIAL_SECRET_STATUS.REVOKED) {
    throw CryptoErrors.secretRevoked();
  }
  if (ref.status === CREDENTIAL_SECRET_STATUS.EXPIRED || (ref.expiresAt && ref.expiresAt < new Date())) {
    throw CryptoErrors.secretExpired();
  }
  if (
    ![
      CREDENTIAL_SECRET_STATUS.ACTIVE,
      CREDENTIAL_SECRET_STATUS.PENDING,
      CREDENTIAL_SECRET_STATUS.EXPIRING,
    ].includes(ref.status)
  ) {
    throw CryptoErrors.secretAccessDenied({ message: `Credential status ${ref.status} is not usable.` });
  }

  const enc = await db.mraEisEncryptedSecret.findFirst({
    where: { credentialReferenceId: ref.id, tenantId, businessId },
  });
  if (!enc || enc.status === CREDENTIAL_SECRET_STATUS.REVOKED) {
    throw CryptoErrors.secretNotFound();
  }

  let plaintext;
  try {
    plaintext = envelopeDecrypt(enc, {
      tenantId,
      businessId,
      terminalId,
      environment,
      credentialType: secretType,
      credentialReferenceId: ref.id,
    });
  } catch (err) {
    incSecurityMetric('eis.secret.decryption_failures');
    await auditAccess(db, {
      tenantId,
      businessId,
      environment,
      serviceIdentity,
      action: 'CREDENTIAL_DECRYPTION_FAILED',
      credentialReferenceId,
      secretType,
      operation,
      outcome: 'FAILED',
      requestId,
      correlationId,
    });
    throw err;
  }

  incSecurityMetric('eis.secret.retrievals');
  await auditAccess(db, {
    tenantId,
    businessId,
    environment,
    serviceIdentity,
    action: 'CREDENTIAL_ACCESS_GRANTED',
    credentialReferenceId,
    secretType,
    operation,
    outcome: 'GRANTED',
    keyVersion: enc.keyVersion,
    fingerprint: safeFingerprint(plaintext),
    requestId,
    correlationId,
  });

  try {
    return await fn(plaintext);
  } finally {
    plaintext = null;
  }
}

export async function revokeSecret({
  tenantId,
  businessId = tenantId,
  credentialReferenceId,
  serviceIdentity = EIS_SERVICE_IDENTITY.CREDENTIAL_ROTATION_WORKER,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const ref = await db.mraEisCredentialReference.findFirst({
    where: { id: credentialReferenceId, tenantId, businessId },
  });
  if (!ref) throw CryptoErrors.secretNotFound();

  await db.mraEisCredentialReference.update({
    where: { id: ref.id },
    data: { status: CREDENTIAL_SECRET_STATUS.REVOKED, revokedAt: new Date() },
  });
  await db.mraEisEncryptedSecret.updateMany({
    where: { credentialReferenceId: ref.id },
    data: { status: CREDENTIAL_SECRET_STATUS.REVOKED, revokedAt: new Date() },
  });
  incSecurityMetric('eis.secret.revocations');
  await auditAccess(db, {
    tenantId,
    businessId,
    environment: ref.environment,
    serviceIdentity,
    action: 'CREDENTIAL_REVOKED',
    credentialReferenceId,
    secretType: mapCredentialType(ref.credentialType),
    operation: 'REVOKE',
    outcome: 'REVOKED',
  });
}

export async function getCredentialMetadata({
  tenantId,
  businessId = tenantId,
  credentialReferenceId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const ref = await db.mraEisCredentialReference.findFirst({
    where: { id: credentialReferenceId, tenantId, businessId },
  });
  if (!ref) throw CryptoErrors.secretNotFound();
  return {
    credentialReferenceId: ref.id,
    credentialType: ref.credentialType,
    status: ref.status,
    environment: ref.environment,
    terminalId: ref.terminalId,
    createdAt: ref.createdAt,
    expiresAt: ref.expiresAt,
    keyVersion: ref.keyVersion,
    rotatedAt: ref.rotatedAt,
    revokedAt: ref.revokedAt,
    provider: ref.provider,
    // Never ciphertext / vault internals beyond opaque pointer shape
    vaultReferencePresent: Boolean(ref.vaultReference?.startsWith('env-envelope://')),
  };
}

export async function rotateCredential({
  tenantId,
  businessId = tenantId,
  terminalId,
  environment,
  credentialType,
  newPlaintext,
  serviceIdentity = EIS_SERVICE_IDENTITY.CREDENTIAL_ROTATION_WORKER,
  db = prisma,
}) {
  const meta = await storeSecret({
    tenantId,
    businessId,
    terminalId,
    environment,
    credentialType,
    plaintext: newPlaintext,
    serviceIdentity,
    createdByService: 'phase6-credential-rotation',
    activate: true,
    db,
  });
  incSecurityMetric('eis.secret.rotations');
  return meta;
}

export async function rewrapSecretsBatch({
  fromKeyVersion,
  toKeyVersion,
  dryRun = false,
  take = 50,
  cursor = null,
  db = prisma,
}) {
  const rows = await db.mraEisEncryptedSecret.findMany({
    where: {
      keyVersion: fromKeyVersion,
      status: { in: [CREDENTIAL_SECRET_STATUS.ACTIVE, CREDENTIAL_SECRET_STATUS.PENDING] },
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: 'asc' },
    take,
  });

  let processed = 0;
  let failed = 0;
  let lastId = cursor;
  for (const row of rows) {
    lastId = row.id;
    try {
      const meta = {
        tenantId: row.tenantId,
        businessId: row.businessId,
        terminalId: row.terminalId,
        environment: row.environment,
        credentialType: row.credentialType,
        credentialReferenceId: row.credentialReferenceId,
      };
      const next = rewrapDataKey(row, meta, { fromKeyVersion, toKeyVersion });
      if (!dryRun) {
        await db.mraEisEncryptedSecret.update({
          where: { id: row.id },
          data: {
            wrappedDataKey: next.wrappedDataKey,
            masterKeyId: next.masterKeyId,
            keyVersion: next.keyVersion,
            version: { increment: 1 },
          },
        });
        await db.mraEisCredentialReference.updateMany({
          where: { id: row.credentialReferenceId },
          data: { keyVersion: next.keyVersion },
        });
      }
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  incSecurityMetric('eis.key.rotation_batches');
  return {
    processed,
    failed,
    cursor: lastId,
    dryRun,
    done: rows.length < take,
  };
}

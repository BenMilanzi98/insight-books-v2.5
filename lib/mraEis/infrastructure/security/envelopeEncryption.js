import './serverOnly.js';
import crypto from 'crypto';
import { resolveMasterKey, assertEnvironmentKeyBinding } from './masterKey.js';
import { CryptoErrors } from './cryptoErrors.js';
import { encodeBase64Standard, decodeBase64Standard, utf8Bytes } from './encoding.js';

const ALGO = 'aes-256-gcm';
const ALGO_VERSION = 'ENV_ENVELOPE_V1';
const IV_LEN = 12;
const TAG_LEN = 16;

function buildAad(meta) {
  return utf8Bytes(
    [
      meta.tenantId,
      meta.businessId,
      meta.terminalId || '',
      meta.environment,
      meta.credentialType || meta.secretType || '',
      meta.credentialReferenceId || meta.ephemeralId || '',
      ALGO_VERSION,
    ].join('|')
  );
}

function aadHash(meta) {
  return crypto.createHash('sha256').update(buildAad(meta)).digest('hex');
}

/**
 * Envelope encrypt: random DEK encrypts plaintext (GCM); DEK wrapped by master key (GCM).
 */
export function envelopeEncrypt(plaintext, meta, { keyVersion = 'v1', deploymentEnvironment } = {}) {
  if (plaintext == null || plaintext === '') {
    throw CryptoErrors.encryption({ message: 'Empty secret rejected.' });
  }
  const text = String(plaintext);
  if (Buffer.byteLength(text, 'utf8') > 64 * 1024) {
    throw CryptoErrors.encryption({ message: 'Oversized secret rejected.' });
  }

  const master = resolveMasterKey({
    environment: deploymentEnvironment || process.env.MRA_EIS_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
    keyVersion,
  });
  assertEnvironmentKeyBinding(master, meta.environment);

  const dek = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(IV_LEN);
  const aad = buildAad(meta);

  const cipher = crypto.createCipheriv(ALGO, dek, nonce);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const wrapNonce = crypto.randomBytes(IV_LEN);
  const wrapCipher = crypto.createCipheriv(ALGO, master.key, wrapNonce);
  wrapCipher.setAAD(aad);
  const wrapped = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();

  // Zeroize DEK best-effort
  dek.fill(0);

  return Object.freeze({
    ciphertext: encodeBase64Standard(ct),
    wrappedDataKey: `${encodeBase64Standard(wrapNonce)}.${encodeBase64Standard(wrapped)}.${encodeBase64Standard(wrapTag)}`,
    nonce: encodeBase64Standard(nonce),
    authenticationTag: encodeBase64Standard(tag),
    algorithm: 'AES-256-GCM',
    algorithmVersion: ALGO_VERSION,
    masterKeyId: master.keyId,
    keyVersion: master.keyVersion,
    authenticatedMetadataHash: aadHash(meta),
  });
}

export function envelopeDecrypt(record, meta, { keyVersion } = {}) {
  const master = resolveMasterKey({
    environment: process.env.MRA_EIS_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
    keyVersion: keyVersion || record.keyVersion || 'v1',
  });

  if (record.masterKeyId && !record.masterKeyId.includes(master.keyVersion)) {
    // soft check — keyId embeds version; hard fail if env fingerprint clearly wrong later
  }
  if (record.authenticatedMetadataHash !== aadHash(meta)) {
    throw CryptoErrors.ciphertextIntegrity({
      message: 'Authenticated metadata binding mismatch.',
    });
  }

  const aad = buildAad(meta);
  try {
    const [wn, wct, wtag] = String(record.wrappedDataKey).split('.');
    const wrapDecipher = crypto.createDecipheriv(ALGO, master.key, decodeBase64Standard(wn));
    wrapDecipher.setAAD(aad);
    wrapDecipher.setAuthTag(decodeBase64Standard(wtag));
    const dek = Buffer.concat([
      wrapDecipher.update(decodeBase64Standard(wct)),
      wrapDecipher.final(),
    ]);

    const decipher = crypto.createDecipheriv(ALGO, dek, decodeBase64Standard(record.nonce));
    decipher.setAAD(aad);
    decipher.setAuthTag(decodeBase64Standard(record.authenticationTag));
    const plain = Buffer.concat([
      decipher.update(decodeBase64Standard(record.ciphertext)),
      decipher.final(),
    ]).toString('utf8');
    dek.fill(0);
    return plain;
  } catch (err) {
    if (err?.code?.startsWith?.('EIS_')) throw err;
    throw CryptoErrors.decryption({ message: 'Decryption or integrity verification failed.' });
  }
}

/** Rewrap DEK under a new master key without exposing credential plaintext. */
export function rewrapDataKey(record, meta, { fromKeyVersion, toKeyVersion }) {
  const oldMaster = resolveMasterKey({
    environment: process.env.MRA_EIS_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
    keyVersion: fromKeyVersion,
  });
  const newMaster = resolveMasterKey({
    environment: process.env.MRA_EIS_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
    keyVersion: toKeyVersion,
  });
  const aad = buildAad(meta);

  const [wn, wct, wtag] = String(record.wrappedDataKey).split('.');
  const wrapDecipher = crypto.createDecipheriv(ALGO, oldMaster.key, decodeBase64Standard(wn));
  wrapDecipher.setAAD(aad);
  wrapDecipher.setAuthTag(decodeBase64Standard(wtag));
  const dek = Buffer.concat([
    wrapDecipher.update(decodeBase64Standard(wct)),
    wrapDecipher.final(),
  ]);

  const wrapNonce = crypto.randomBytes(IV_LEN);
  const wrapCipher = crypto.createCipheriv(ALGO, newMaster.key, wrapNonce);
  wrapCipher.setAAD(aad);
  const wrapped = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();
  dek.fill(0);

  return {
    wrappedDataKey: `${encodeBase64Standard(wrapNonce)}.${encodeBase64Standard(wrapped)}.${encodeBase64Standard(wrapTag)}`,
    masterKeyId: newMaster.keyId,
    keyVersion: newMaster.keyVersion,
  };
}

export { ALGO_VERSION, TAG_LEN };

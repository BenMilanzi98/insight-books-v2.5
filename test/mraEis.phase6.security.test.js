import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_TEST_MASTER_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
});

describe('Phase 6 envelope encryption', () => {
  it('encrypts and decrypts with unique ciphertext (nonce)', async () => {
    const { envelopeEncrypt, envelopeDecrypt } = await import(
      '../lib/mraEis/infrastructure/security/envelopeEncryption.js'
    );
    const meta = {
      tenantId: 't1',
      businessId: 't1',
      terminalId: 'term1',
      environment: 'SANDBOX',
      credentialType: 'MRA_TERMINAL_SECRET',
      credentialReferenceId: 'ref1',
    };
    const a = envelopeEncrypt('synthetic-secret-value', meta);
    const b = envelopeEncrypt('synthetic-secret-value', meta);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.nonce).not.toBe(b.nonce);
    expect(envelopeDecrypt(a, meta)).toBe('synthetic-secret-value');
    expect(a.algorithm).toBe('AES-256-GCM');
  });

  it('rejects tenant substitution via AAD', async () => {
    const { envelopeEncrypt, envelopeDecrypt } = await import(
      '../lib/mraEis/infrastructure/security/envelopeEncryption.js'
    );
    const meta = {
      tenantId: 't1',
      businessId: 't1',
      terminalId: 'term1',
      environment: 'SANDBOX',
      credentialType: 'MRA_TERMINAL_JWT',
      credentialReferenceId: 'ref1',
    };
    const sealed = envelopeEncrypt('jwt-synthetic.not.real', meta);
    expect(() =>
      envelopeDecrypt(sealed, { ...meta, tenantId: 't2', businessId: 't2' })
    ).toThrow(/integrity|metadata|Decryption/i);
  });

  it('rejects environment substitution', async () => {
    const { envelopeEncrypt, envelopeDecrypt } = await import(
      '../lib/mraEis/infrastructure/security/envelopeEncryption.js'
    );
    const meta = {
      tenantId: 't1',
      businessId: 't1',
      terminalId: 'term1',
      environment: 'SANDBOX',
      credentialType: 'MRA_TERMINAL_JWT',
      credentialReferenceId: 'ref1',
    };
    const sealed = envelopeEncrypt('jwt-synthetic.not.real', meta);
    expect(() => envelopeDecrypt(sealed, { ...meta, environment: 'PRODUCTION' })).toThrow();
  });
});

describe('Phase 6 activation confirmation KAT', () => {
  it('matches official Phase 1 known-answer vector', async () => {
    const { computeActivationConfirmationSignature, ACTIVATION_CONFIRMATION_KAT } = await import(
      '../lib/mraEis/infrastructure/security/activationHmac.js'
    );
    const sig = computeActivationConfirmationSignature(
      ACTIVATION_CONFIRMATION_KAT.plaintext,
      ACTIVATION_CONFIRMATION_KAT.key
    );
    expect(sig).toBe(ACTIVATION_CONFIRMATION_KAT.expected);
  });
});

describe('Phase 6 blocked crypto', () => {
  it('blocks message hashing', async () => {
    const { hashEisMessage } = await import('../lib/mraEis/infrastructure/security/messageHasher.js');
    await expect(hashEisMessage({})).rejects.toThrow(/unverified|fail/i);
  });

  it('blocks offline signing', async () => {
    const { signOfflineTransaction } = await import(
      '../lib/mraEis/infrastructure/security/offlineSigner.js'
    );
    await expect(signOfflineTransaction({})).rejects.toThrow(/unavailable|blocked/i);
  });
});

describe('Phase 6 canonicalization & encoding', () => {
  it('is deterministic with sorted keys and preserved arrays', async () => {
    const { canonicalize } = await import('../lib/mraEis/infrastructure/security/canonicalization.js');
    const a = canonicalize({ b: 1, a: 2, lines: [{ q: 1 }, { q: 2 }] });
    const b = canonicalize({ a: 2, b: 1, lines: [{ q: 1 }, { q: 2 }] });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.checksum).toBe(b.checksum);
    expect(a.canonicalJson).toContain('"lines":[{"q":1},{"q":2}]');
  });

  it('encodes base64 variants', async () => {
    const {
      encodeBase64Standard,
      encodeBase64UrlSafeWithoutPadding,
      utf8Bytes,
      decodeBase64UrlSafe,
    } = await import('../lib/mraEis/infrastructure/security/encoding.js');
    const bytes = utf8Bytes('hello');
    expect(encodeBase64Standard(bytes)).toBe('aGVsbG8=');
    const url = encodeBase64UrlSafeWithoutPadding(bytes);
    expect(url).not.toContain('=');
    expect(decodeBase64UrlSafe(url).toString('utf8')).toBe('hello');
  });

  it('uses constant-time compare', async () => {
    const { constantTimeEqual } = await import(
      '../lib/mraEis/infrastructure/security/constantTime.js'
    );
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'ab')).toBe(false);
  });
});

describe('Phase 6 redaction', () => {
  it('redacts nested secrets and JWT-like strings', async () => {
    const { redactSecrets, assertNoSecretMaterial } = await import(
      '../lib/mraEis/infrastructure/security/redaction.js'
    );
    const out = redactSecrets({
      authorization: 'Bearer abc.def.ghi',
      nested: { secretKey: 'nope', ok: 1 },
      note: 'prefix eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb suffix',
    });
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.nested.secretKey).toBe('[REDACTED]');
    expect(out.nested.ok).toBe(1);
    expect(out.note).toContain('[REDACTED_JWT]');
    expect(() => assertNoSecretMaterial({ secretKey: 'abc123' })).toThrow(/blocked|leakage/i);
  });
});

describe('Phase 6 server-only boundary', () => {
  it('assertServerOnly throws when window exists', async () => {
    const { assertServerOnly } = await import('../lib/mraEis/infrastructure/security/serverOnly.js');
    globalThis.window = {};
    expect(() => assertServerOnly('test')).toThrow(/server-only/i);
    delete globalThis.window;
  });
});

describe('Phase 6 schema hygiene', () => {
  it('encrypted secret model has no plaintext value column', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schema = fs.readFileSync(path.resolve('prisma/schema.prisma'), 'utf8');
    const start = schema.indexOf('model MraEisEncryptedSecret');
    expect(start).toBeGreaterThan(-1);
    const block = schema.slice(start, start + 1200);
    expect(block).toContain('ciphertext');
    expect(block).toContain('wrappedDataKey');
    expect(block).not.toMatch(/\bplaintext\b/);
    expect(block).not.toMatch(/\bjwt\s+String/);
    expect(block).not.toMatch(/\bsecretKey\s+String/);
  });
});

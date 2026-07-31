import { createHmac, timingSafeEqual } from 'crypto';
import { WebhookReplayError, WebhookSignatureError } from './errors.js';

const seenNonces = new Map();

/**
 * Verify HMAC-SHA256 signature header.
 * signatureHeader format: sha256=<hex>
 */
export function verifyWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  timestampHeader,
  maxSkewSec = 300,
  nonce = null,
} = {}) {
  if (!secret) throw new WebhookSignatureError('Webhook secret not configured.');
  if (!signatureHeader) throw new WebhookSignatureError('Missing signature.');

  if (timestampHeader) {
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > maxSkewSec) {
      throw new WebhookSignatureError('Webhook timestamp outside allowed skew.');
    }
  }

  if (nonce) {
    const key = `${nonce}:${timestampHeader || ''}`;
    if (seenNonces.has(key)) throw new WebhookReplayError();
    seenNonces.set(key, Date.now());
    // prune
    if (seenNonces.size > 5000) {
      const cutoff = Date.now() - maxSkewSec * 1000;
      for (const [k, t] of seenNonces) {
        if (t < cutoff) seenNonces.delete(k);
      }
    }
  }

  const provided = String(signatureHeader).replace(/^sha256=/i, '').trim();
  const expected = createHmac('sha256', secret)
    .update(timestampHeader ? `${timestampHeader}.${rawBody}` : String(rawBody))
    .digest('hex');
  try {
    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new WebhookSignatureError();
    }
  } catch (e) {
    if (e instanceof WebhookSignatureError) throw e;
    throw new WebhookSignatureError();
  }
  return { ok: true };
}

export function _resetWebhookNonces() {
  seenNonces.clear();
}

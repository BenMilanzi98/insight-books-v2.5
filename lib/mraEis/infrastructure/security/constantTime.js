import { timingSafeEqual } from 'crypto';

/**
 * Constant-time equality for buffers/strings used in signature verification.
 * Length mismatch returns false without leaking position.
 */
export function constantTimeEqual(a, b) {
  const ba = Buffer.isBuffer(a) ? a : Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? ''), 'utf8');
  if (ba.length !== bb.length) {
    // Compare against self to keep timing roughly stable, then fail.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

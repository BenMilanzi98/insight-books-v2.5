import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Must be a 32-byte (64 hex char) key.');
  }
  if (key.length === 64) return Buffer.from(key, 'hex');
  if (key.length === 32) return Buffer.from(key, 'utf8');
  throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars or 32 ASCII chars).');
}

export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const parts = encryptedText.split(':');
  if (parts.length < 2) return encryptedText;
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts.slice(1).join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

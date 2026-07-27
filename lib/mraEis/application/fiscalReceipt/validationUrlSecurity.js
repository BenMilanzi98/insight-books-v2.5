/**
 * Phase 14 — SSRF-safe MRA validation URL policy.
 * Does not fetch arbitrary URLs. Rejects localhost, private IPs, credentials, non-HTTPS.
 */

import net from 'net';
import { FiscalReceiptErrors } from './fiscalReceiptErrors.js';

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function isPrivateOrLocalIp(hostname) {
  if (!net.isIP(hostname)) return false;
  if (hostname === '127.0.0.1' || hostname === '::1') return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('169.254.')) return true;
  const m = hostname.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) {
    return true;
  }
  return false;
}

/**
 * @param {string} rawUrl
 * @param {object} urlPolicy from QR source contract
 */
export function validateMraValidationUrl(rawUrl, urlPolicy = {}) {
  const exactValue = rawUrl == null ? '' : String(rawUrl);
  if (!exactValue) {
    return {
      valid: false,
      securityStatus: 'MISSING',
      blocker: 'VALIDATION_URL_MISSING',
      normalizedValue: null,
      exactValue,
    };
  }

  if (CONTROL_CHARS.test(exactValue)) {
    return {
      valid: false,
      securityStatus: 'CONTROL_CHARACTERS',
      blocker: 'VALIDATION_URL_CONTROL_CHARACTERS',
      exactValue,
      normalizedValue: null,
    };
  }

  const maxLength = urlPolicy.maxLength || 2048;
  if (exactValue.length > maxLength) {
    return {
      valid: false,
      securityStatus: 'OVERSIZED',
      blocker: 'VALIDATION_URL_OVERSIZED',
      exactValue,
      normalizedValue: null,
    };
  }

  let parsed;
  try {
    parsed = new URL(exactValue);
  } catch {
    return {
      valid: false,
      securityStatus: 'MALFORMED',
      blocker: 'VALIDATION_URL_MALFORMED',
      exactValue,
      normalizedValue: null,
    };
  }

  const allowedSchemes = (urlPolicy.allowedSchemes || ['https']).map((s) => s.toLowerCase());
  if (!allowedSchemes.includes(parsed.protocol.replace(':', '').toLowerCase())) {
    return {
      valid: false,
      securityStatus: 'SCHEME_REJECTED',
      blocker: 'VALIDATION_URL_SCHEME_REJECTED',
      exactValue,
      host: parsed.hostname,
      normalizedValue: null,
    };
  }

  if (urlPolicy.requireHttps !== false && parsed.protocol !== 'https:') {
    return {
      valid: false,
      securityStatus: 'HTTPS_REQUIRED',
      blocker: 'VALIDATION_URL_HTTPS_REQUIRED',
      exactValue,
      normalizedValue: null,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      securityStatus: 'EMBEDDED_CREDENTIALS',
      blocker: 'VALIDATION_URL_EMBEDDED_CREDENTIALS',
      exactValue,
      normalizedValue: null,
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) {
    return {
      valid: false,
      securityStatus: 'HOST_MISSING',
      blocker: 'VALIDATION_URL_HOST_MISSING',
      exactValue,
      normalizedValue: null,
    };
  }

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return {
      valid: false,
      securityStatus: 'LOCALHOST_REJECTED',
      blocker: 'VALIDATION_URL_LOCALHOST',
      exactValue,
      normalizedValue: null,
    };
  }

  if (isPrivateOrLocalIp(host) && urlPolicy.allowPrivateNetworks !== true) {
    return {
      valid: false,
      securityStatus: 'PRIVATE_NETWORK_REJECTED',
      blocker: 'VALIDATION_URL_PRIVATE_NETWORK',
      exactValue,
      normalizedValue: null,
    };
  }

  if (net.isIP(host) && urlPolicy.allowIpHosts !== true) {
    return {
      valid: false,
      securityStatus: 'IP_HOST_REJECTED',
      blocker: 'VALIDATION_URL_IP_HOST',
      exactValue,
      normalizedValue: null,
    };
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  if (urlPolicy.allowNonStandardPorts !== true && port !== 443 && port !== 80) {
    return {
      valid: false,
      securityStatus: 'NON_STANDARD_PORT',
      blocker: 'VALIDATION_URL_NON_STANDARD_PORT',
      exactValue,
      normalizedValue: null,
    };
  }

  const allowlist = (urlPolicy.allowlistedHosts || urlPolicy.allowedHosts || []).map((h) =>
    String(h).toLowerCase()
  );
  if (allowlist.length && !allowlist.includes(host)) {
    return {
      valid: false,
      securityStatus: 'HOST_NOT_ALLOWLISTED',
      blocker: 'VALIDATION_URL_UNTRUSTED',
      exactValue,
      host,
      normalizedValue: null,
    };
  }

  // Preserve exact semantic value — do not rewrite query order or shorten.
  return {
    valid: true,
    securityStatus: 'ALLOWLISTED',
    blocker: null,
    exactValue,
    normalizedValue: exactValue,
    host,
    scheme: parsed.protocol.replace(':', ''),
    href: exactValue,
  };
}

export function assertTrustedValidationUrl(rawUrl, urlPolicy) {
  const result = validateMraValidationUrl(rawUrl, urlPolicy);
  if (!result.valid) {
    if (result.blocker === 'VALIDATION_URL_UNTRUSTED') {
      throw FiscalReceiptErrors.validationUrlUntrusted({
        details: { blocker: result.blocker, securityStatus: result.securityStatus },
      });
    }
    throw FiscalReceiptErrors.validationUrlInvalid({
      details: { blocker: result.blocker, securityStatus: result.securityStatus },
    });
  }
  return result;
}

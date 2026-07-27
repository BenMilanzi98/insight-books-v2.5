/**
 * Phase 14 — deterministic server-side QR generation + decode verification.
 * Generator version is pinned. No logos, gradients, or quiet-zone cropping.
 */

import crypto from 'crypto';
import { FiscalReceiptErrors } from './fiscalReceiptErrors.js';

export const QR_GENERATOR_VERSION = 'phase14-qrcode-v1';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function loadQrcode() {
  try {
    const mod = await import('qrcode');
    return mod.default || mod;
  } catch {
    throw FiscalReceiptErrors.qrGeneration({
      message: 'qrcode package is not installed. Run: npm install qrcode --legacy-peer-deps',
      retryable: false,
    });
  }
}

async function loadDecodeDeps() {
  const [jsQRMod, PNGMod] = await Promise.all([import('jsqr'), import('pngjs')]);
  return {
    jsQR: jsQRMod.default || jsQRMod,
    PNG: PNGMod.PNG || PNGMod.default?.PNG || PNGMod.default,
  };
}

/**
 * Generate PNG QR artifact and verify by decode.
 */
export async function generateAndVerifyQr({
  exactSourceValue,
  errorCorrectionLevel = 'M',
  quietZoneModules = 4,
  minimumPixelSize = 160,
  width = null,
} = {}) {
  if (!exactSourceValue) {
    throw FiscalReceiptErrors.qrSourceMissing();
  }

  const QRCode = await loadQrcode();
  const pixelSize = Math.max(Number(width || minimumPixelSize), minimumPixelSize);
  const margin = quietZoneModules;

  const pngBuffer = await QRCode.toBuffer(String(exactSourceValue), {
    type: 'png',
    errorCorrectionLevel,
    margin,
    width: pixelSize,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const svgString = await QRCode.toString(String(exactSourceValue), {
    type: 'svg',
    errorCorrectionLevel,
    margin,
    width: pixelSize,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const decodeResult = await decodePngQr(pngBuffer);
  if (!decodeResult.ok) {
    throw FiscalReceiptErrors.qrDecode({
      details: { reason: decodeResult.reason },
    });
  }

  if (decodeResult.value !== String(exactSourceValue)) {
    throw FiscalReceiptErrors.qrDecode({
      details: {
        reason: 'DECODED_VALUE_MISMATCH',
        expectedChecksum: sha256(Buffer.from(String(exactSourceValue), 'utf8')),
        decodedChecksum: sha256(Buffer.from(decodeResult.value, 'utf8')),
      },
    });
  }

  return {
    generatorVersion: QR_GENERATOR_VERSION,
    exactSourceValue: String(exactSourceValue),
    exactSourceChecksum: sha256(Buffer.from(String(exactSourceValue), 'utf8')),
    pngBuffer,
    svgString,
    pngChecksum: sha256(pngBuffer),
    svgChecksum: sha256(Buffer.from(svgString, 'utf8')),
    dimensions: { width: pixelSize, height: pixelSize },
    errorCorrectionLevel,
    quietZone: margin,
    decodeVerified: true,
    decodedValueChecksum: sha256(Buffer.from(decodeResult.value, 'utf8')),
    verificationVersion: 'phase14-qr-decode-v1',
    outputFormats: ['PNG', 'SVG'],
    highContrast: true,
    logoEmbedded: false,
  };
}

export async function decodePngQr(pngBuffer) {
  try {
    const { jsQR, PNG } = await loadDecodeDeps();
    const png = PNG.sync.read(pngBuffer);
    const code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height, {
      inversionAttempts: 'dontInvert',
    });
    if (!code?.data) {
      return { ok: false, reason: 'DECODE_EMPTY' };
    }
    return { ok: true, value: code.data, width: png.width, height: png.height };
  } catch (err) {
    return { ok: false, reason: err.message || 'DECODE_ERROR' };
  }
}

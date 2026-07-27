/**
 * Server-only MRA Sales HTTP client — Phase 13.
 * MOCK default. Live sandbox/production blocked until contract verified.
 * No redirect following with Authorization. TLS required for production URLs.
 */
import { resolveActivationMode, resolveMraBaseUrl } from './environmentConfig.js';
import { mockSubmitSalesTransaction } from './mockMraSalesServer.js';
import { resolveSalesEndpointContract } from '../../application/salesTransmission/salesEndpointContractRegistry.js';
import { EisErrors } from '../../domain/errors.js';

export async function submitSalesTransactionToMra({
  environment = 'SANDBOX',
  requestBody,
  transmittedBytes,
  messageHashHeader,
  authorizationBearer,
  maxResponseBytes = 512000,
  timeoutMs = 30000,
} = {}) {
  const mode = resolveActivationMode(environment);
  const contractResult = resolveSalesEndpointContract({ environment, mode });
  const contract = contractResult.contract;

  if (!contractResult.allowsTransmission) {
    throw EisErrors.validation({
      message: contractResult.message,
      code: 'MRA_EIS_SALES_CONTRACT_UNVERIFIED',
      httpStatus: 409,
    });
  }

  if (String(contract.httpMethod).toUpperCase() !== 'POST') {
    throw EisErrors.validation({
      message: 'Sales client does not fall back between HTTP methods.',
      code: 'SALES_METHOD_CONFLICT',
    });
  }

  const headers = {
    'Content-Type': contract.contentType || 'application/json',
    Accept: 'application/json',
    [contract.requestHashHeaderName || 'x-eis-message-hash']: messageHashHeader,
    Authorization: `Bearer ${authorizationBearer}`,
  };

  // Ensure we send the exact hashed bytes
  const bodyText =
    typeof transmittedBytes === 'string'
      ? transmittedBytes
      : Buffer.isBuffer(transmittedBytes)
        ? transmittedBytes.toString('utf8')
        : JSON.stringify(requestBody);

  if (mode === 'MOCK') {
    return mockSubmitSalesTransaction({
      body: requestBody,
      headers,
      fiscalNumber: requestBody?.header?.fiscalNumber,
    });
  }

  // Live path — currently unreachable because contract.allowsTransmission is false
  // Kept for future verified enablement with hard guards.
  const baseUrl = resolveMraBaseUrl(mode);
  if (!baseUrl || !String(baseUrl).startsWith('https://')) {
    throw EisErrors.validation({
      message: 'Live Sales base URL must be HTTPS and server-configured.',
    });
  }

  const url = `${baseUrl.replace(/\/$/, '')}${contract.endpointPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyText,
      redirect: 'error',
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length > maxResponseBytes) {
      return {
        ok: false,
        httpStatus: res.status,
        contentType,
        body: null,
        bodyText: null,
        errorKind: 'RESPONSE_TOO_LARGE',
        responseByteLength: raw.length,
      };
    }
    const bodyTextOut = raw.toString('utf8');
    let body = null;
    let parseError = null;
    try {
      body = JSON.parse(bodyTextOut);
    } catch {
      parseError = 'MALFORMED_JSON';
    }
    return {
      ok: res.ok,
      httpStatus: res.status,
      contentType,
      body,
      bodyText: bodyTextOut,
      parseError,
      responseByteLength: raw.length,
      isMock: false,
    };
  } catch (err) {
    const kind = err?.name === 'AbortError' ? 'TIMEOUT' : 'CONNECTION';
    return {
      ok: false,
      httpStatus: null,
      contentType: null,
      body: null,
      bodyText: null,
      errorKind: kind,
      isMock: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

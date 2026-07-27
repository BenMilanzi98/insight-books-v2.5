import { getActivationEndpointConfig } from './environmentConfig.js';
import { mockActivateTerminal, mockConfirmTerminal } from './mockMraActivationServer.js';
import { ACTIVATION_MODE } from '../../domain/operationalEnums.js';
import { redactSecrets } from '../security/redaction.js';
import { incSecurityMetric } from '../security/securityMetrics.js';

/**
 * Server-only MRA activation/confirmation client.
 * No automatic retry for ambiguous post-dispatch outcomes.
 */
export async function activateTerminalViaMra({ environment, requestBody, requestId }) {
  const cfg = getActivationEndpointConfig(environment);
  incSecurityMetric('eis.activation.requests');

  if (cfg.mode === ACTIVATION_MODE.MOCK) {
    return mockActivateTerminal(requestBody);
  }

  if (cfg.mode === ACTIVATION_MODE.PRODUCTION) {
    // Hard gate — never call production from Phase 7 foundation until readiness clears
    const err = new Error('Production MRA activation is blocked until Phase 7 production gates pass.');
    err.code = 'PRODUCTION_ACTIVATION_BLOCKED';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}${cfg.activatePath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Request-Id': requestId || '',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const text = await res.text();
    if (text.length > cfg.maxResponseBytes) {
      throw Object.assign(new Error('MRA response exceeded size limit'), { code: 'RESPONSE_TOO_LARGE' });
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { statusCode: 0, remark: 'Invalid JSON', errors: [{ code: 'INVALID_RESPONSE' }] };
    }
    // Redact before any incidental logging by callers
    void redactSecrets(body);
    return { httpStatus: res.status, body, dispatched: true };
  } catch (err) {
    if (err?.name === 'AbortError') {
      const e = new Error('Activation request timed out');
      e.code = 'ACTIVATION_TIMEOUT';
      e.dispatched = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function confirmTerminalViaMra({
  environment,
  requestBody,
  signature,
  requestId,
  confirmationScenario,
}) {
  const cfg = getActivationEndpointConfig(environment);
  incSecurityMetric('eis.confirmation.requests');

  if (cfg.mode === ACTIVATION_MODE.MOCK) {
    return mockConfirmTerminal(requestBody, { scenario: confirmationScenario || 'SUCCESS' });
  }

  if (cfg.mode === ACTIVATION_MODE.PRODUCTION) {
    const err = new Error('Production MRA confirmation is blocked until Phase 7 production gates pass.');
    err.code = 'PRODUCTION_CONFIRMATION_BLOCKED';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}${cfg.confirmPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-signature': signature,
        'X-Request-Id': requestId || '',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { statusCode: 0, remark: 'Invalid JSON', errors: [{ code: 'INVALID_RESPONSE' }] };
    }
    return { httpStatus: res.status, body, dispatched: true };
  } catch (err) {
    if (err?.name === 'AbortError') {
      const e = new Error('Confirmation request timed out');
      e.code = 'CONFIRMATION_TIMEOUT';
      e.dispatched = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

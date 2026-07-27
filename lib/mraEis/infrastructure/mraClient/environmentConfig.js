import { ACTIVATION_MODE } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';

/**
 * Server-controlled MRA environment configuration.
 * Browser cannot override base URL.
 */
export function resolveActivationMode(environment) {
  const env = String(environment || '').toUpperCase();
  const forced = String(process.env.MRA_EIS_ACTIVATION_MODE || '').toUpperCase();
  if (forced && Object.values(ACTIVATION_MODE).includes(forced)) return forced;
  if (env === 'PRODUCTION') return ACTIVATION_MODE.PRODUCTION;
  if (env === 'CERTIFICATION') return ACTIVATION_MODE.CERTIFICATION;
  if (process.env.MRA_EIS_USE_MOCK === '0') return ACTIVATION_MODE.SANDBOX;
  // Default safe mode for development/tests
  return ACTIVATION_MODE.MOCK;
}

export function resolveMraBaseUrl(mode) {
  switch (mode) {
    case ACTIVATION_MODE.PRODUCTION:
      return process.env.MRA_EIS_PRODUCTION_BASE_URL || process.env.EIS_API_BASE_URL || null;
    case ACTIVATION_MODE.CERTIFICATION:
      return process.env.MRA_EIS_CERTIFICATION_BASE_URL || null;
    case ACTIVATION_MODE.SANDBOX:
      return process.env.MRA_EIS_SANDBOX_BASE_URL || process.env.EIS_API_BASE_URL || null;
    case ACTIVATION_MODE.MOCK:
      return 'mock://mra-eis';
    default:
      return null;
  }
}

export function getActivationEndpointConfig(environment) {
  const mode = resolveActivationMode(environment);
  const baseUrl = resolveMraBaseUrl(mode);
  if (!baseUrl && mode !== ACTIVATION_MODE.MOCK) {
    throw EisErrors.validation({
      message: 'MRA base URL is not configured for this environment.',
      details: { mode },
    });
  }
  if (mode === ACTIVATION_MODE.PRODUCTION && !String(baseUrl || '').startsWith('https://')) {
    throw EisErrors.validation({ message: 'Production MRA base URL must use HTTPS.' });
  }
  return {
    mode,
    baseUrl,
    activatePath: '/api/v1/onboarding/activate-terminal',
    confirmPath: '/api/v1/onboarding/terminal-activated-confirmation',
    timeoutMs: Number(process.env.MRA_EIS_ACTIVATION_TIMEOUT_MS || 30000),
    maxResponseBytes: Number(process.env.MRA_EIS_MAX_RESPONSE_BYTES || 512000),
  };
}

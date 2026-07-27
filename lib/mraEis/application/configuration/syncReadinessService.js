import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { evaluateTenantEisCapability } from '../capabilityService.js';
import { EIS_OPERATION } from '../../domain/constants.js';
import {
  TERMINAL_STATUS,
  CONFIGURATION_TYPE,
  SYNC_STATUS,
  ACTIVATION_MODE,
} from '../../domain/operationalEnums.js';
import { resolveActivationMode } from '../../infrastructure/mraClient/environmentConfig.js';
import {
  getConfigurationTypeEntry,
  listRequiredConfigurationTypes,
  CRYPTO_CONTRACT_STATUS,
} from './configurationTypeRegistry.js';
import { resolveMasterKey } from '../../infrastructure/security/masterKey.js';

const SYNC_ELIGIBLE_STATUSES = new Set([
  TERMINAL_STATUS.ACTIVE,
  TERMINAL_STATUS.CONFIGURATION_STALE,
  'CONFIGURATION_REFRESH_DUE',
  'CONFIGURATION_SYNC_IN_PROGRESS',
  'CONFIGURATION_SYNC_FAILED',
  'CONFIGURATION_CONFLICT',
]);

const ACTIVE_SYNC_STATUSES = [
  SYNC_STATUS.CREATED,
  SYNC_STATUS.QUEUED,
  SYNC_STATUS.CLAIMED,
  SYNC_STATUS.VALIDATING_READINESS,
  SYNC_STATUS.FETCHING_GLOBAL,
  SYNC_STATUS.FETCHING_TERMINAL,
  SYNC_STATUS.FETCHING_TAXPAYER,
  SYNC_STATUS.VALIDATING_RESPONSES,
  SYNC_STATUS.STORING_SNAPSHOTS,
  SYNC_STATUS.EXTRACTING_DERIVED_RULES,
  SYNC_STATUS.VALIDATING_CONFIGURATION_SET,
  SYNC_STATUS.REVALIDATING_MAPPINGS,
  SYNC_STATUS.ACTIVATING,
  SYNC_STATUS.RUNNING,
];

/**
 * Server-authoritative configuration sync readiness.
 */
export async function evaluateConfigurationSyncReadiness({
  tenantId,
  businessId = tenantId,
  terminalId,
  configurationTypes = listRequiredConfigurationTypes(),
  trigger = null,
  environment = null,
  actorOrServiceContext = null,
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const blockers = [];
  const warnings = [];
  const requiredActions = [];

  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  const terminalExists = Boolean(terminal);
  if (!terminalExists) {
    blockers.push({ code: 'TERMINAL_NOT_FOUND', message: 'Terminal not found for this Business.' });
  }

  const env = String(environment || terminal?.environment || 'SANDBOX').toUpperCase();
  const mode = resolveActivationMode(env);

  const capability = await evaluateTenantEisCapability({
    tenantId,
    businessId,
    requestedOperation: EIS_OPERATION.START_SETUP,
    environment: env,
  }).catch(() => ({
    platformEnabled: false,
    tenantEntitled: false,
    tenantParticipating: false,
  }));

  const platformEnabled = Boolean(capability.platformEnabled);
  const tenantEntitled = Boolean(capability.tenantEntitled);
  const tenantParticipating = Boolean(capability.tenantParticipating);
  const businessOperationalStatus = capability.businessOperationalStatus || capability.businessStatus || 'UNKNOWN';

  if (!platformEnabled) blockers.push({ code: 'PLATFORM_EIS_DISABLED', message: 'Platform EIS is disabled.' });
  if (!tenantEntitled) blockers.push({ code: 'TENANT_NOT_ENTITLED', message: 'Tenant is not entitled.' });
  if (!tenantParticipating) blockers.push({ code: 'TENANT_SUSPENDED', message: 'Tenant is not participating.' });
  if (['DISABLED', 'PAUSED'].includes(String(businessOperationalStatus).toUpperCase())) {
    blockers.push({ code: 'BUSINESS_OPERATION_DISABLED', message: 'Business EIS operation is disabled.' });
  }

  const terminalBlocked = terminal?.status === TERMINAL_STATUS.BLOCKED;
  const environmentMatches = !terminal || terminal.environment === env;
  const terminalActive = terminal ? SYNC_ELIGIBLE_STATUSES.has(terminal.status) : false;

  if (terminal && !terminalActive) {
    blockers.push({
      code: 'TERMINAL_NOT_ACTIVE',
      message: `Terminal status ${terminal.status} cannot synchronize.`,
    });
  }
  if (terminalBlocked) blockers.push({ code: 'TERMINAL_BLOCKED', message: 'Terminal is blocked by MRA.' });
  if (terminal && !environmentMatches) {
    blockers.push({ code: 'ENVIRONMENT_MISMATCH', message: 'Requested environment does not match terminal.' });
  }

  const tokenExpired =
    terminal?.status === TERMINAL_STATUS.TOKEN_EXPIRED ||
    Boolean(terminal?.tokenExpiresAt && terminal.tokenExpiresAt < new Date());
  const tokenExpiring =
    Boolean(terminal?.tokenExpiresAt) &&
    terminal.tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 3600 * 1000 &&
    !tokenExpired;

  if (tokenExpired) blockers.push({ code: 'TERMINAL_TOKEN_EXPIRED', message: 'Terminal JWT is expired.' });
  if (tokenExpiring) warnings.push({ code: 'TOKEN_EXPIRING', message: 'Terminal JWT is expiring soon.' });

  let credentialAvailable = false;
  let credentialValid = false;
  if (terminal) {
    const jwtRef = await db.mraEisCredentialReference.findFirst({
      where: {
        terminalId,
        tenantId,
        businessId,
        credentialType: 'TERMINAL_JWT',
        status: 'ACTIVE',
      },
    });
    credentialAvailable = Boolean(jwtRef);
    credentialValid = Boolean(jwtRef) && !tokenExpired;
    if (!credentialAvailable) {
      blockers.push({
        code: 'TERMINAL_CREDENTIAL_MISSING',
        message: 'Active terminal JWT reference is missing.',
      });
    }
  }

  let secretProviderAvailable = false;
  try {
    resolveMasterKey({ environment: process.env.MRA_EIS_DEPLOYMENT_ENV || 'development' });
    secretProviderAvailable = true;
  } catch {
    if (process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY === '1') secretProviderAvailable = true;
    else blockers.push({ code: 'SECRET_PROVIDER_UNAVAILABLE', message: 'Secret Provider unavailable.' });
  }

  const types = configurationTypes.length ? configurationTypes : listRequiredConfigurationTypes();
  let contractVerified = true;
  let requestHasherVerified = mode === ACTIVATION_MODE.MOCK;

  for (const t of types) {
    const entry = getConfigurationTypeEntry(t);
    if (!entry) {
      blockers.push({ code: 'CONFIGURATION_ENDPOINT_MISSING', message: `Unknown configuration type ${t}.` });
      contractVerified = false;
      continue;
    }
    if (entry.contractStatus === CRYPTO_CONTRACT_STATUS.BLOCKED) {
      blockers.push({ code: 'CONFIGURATION_CONTRACT_UNVERIFIED', message: `${t} contract is blocked.` });
      contractVerified = false;
    }
    if (
      entry.requestHashRequired &&
      entry.requestHashContractStatus === CRYPTO_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION &&
      mode !== ACTIVATION_MODE.MOCK
    ) {
      blockers.push({
        code: 'REQUEST_HASH_CONTRACT_UNVERIFIED',
        message: `Request hash for ${t} is unverified (Q-010/Q-011). Non-mock sync blocked.`,
      });
      requestHasherVerified = false;
    }
  }

  if (mode === ACTIVATION_MODE.PRODUCTION) {
    warnings.push({ code: 'PRODUCTION_SYNC_GATED', message: 'Production configuration sync remains gated.' });
    blockers.push({
      code: 'CONFIGURATION_CONTRACT_UNVERIFIED',
      message: 'Production configuration sync blocked until sandbox verification and hash contract close.',
    });
  }

  const activeSync = terminal
    ? await db.mraEisSyncRun.findFirst({
        where: {
          terminalId,
          tenantId,
          businessId,
          syncType: 'CONFIGURATION',
          status: { in: ACTIVE_SYNC_STATUSES },
        },
      })
    : null;
  if (activeSync && trigger !== 'RECOVERY') {
    blockers.push({
      code: 'ACTIVE_SYNC_ALREADY_RUNNING',
      message: 'A configuration Sync Run is already active.',
    });
  }

  const currentVersions = {};
  if (terminal) {
    for (const t of [CONFIGURATION_TYPE.GLOBAL, CONFIGURATION_TYPE.TERMINAL, CONFIGURATION_TYPE.TAXPAYER]) {
      const snap = await db.mraEisConfigurationSnapshot.findFirst({
        where: { terminalId, configurationType: t, status: 'ACTIVE' },
        orderBy: { activatedAt: 'desc' },
      });
      currentVersions[t] = snap
        ? { version: snap.mraVersion, checksum: snap.sourceChecksum, snapshotId: snap.id }
        : null;
      if (!snap) warnings.push({ code: 'CONFIGURATION_MISSING', message: `No active ${t} configuration.` });
    }
  }

  const seen = new Set();
  const uniqueBlockers = [];
  for (const b of blockers) {
    if (seen.has(b.code)) continue;
    seen.add(b.code);
    uniqueBlockers.push(b);
  }

  if (mode === ACTIVATION_MODE.MOCK && !requestHasherVerified) requestHasherVerified = true;

  return {
    platformEnabled,
    tenantEntitled,
    tenantParticipating,
    businessOperationalStatus,
    terminalExists,
    terminalActive: terminal?.status === TERMINAL_STATUS.ACTIVE,
    terminalBlocked,
    terminalStatus: terminal?.status || null,
    terminalEnvironment: terminal?.environment || null,
    requestedEnvironment: env,
    environmentMatches,
    credentialAvailable,
    credentialValid,
    tokenExpired: Boolean(tokenExpired),
    tokenExpiring: Boolean(tokenExpiring),
    apiConfigured: true,
    contractVerified,
    requestHasherVerified,
    secretProviderAvailable,
    queueAvailable: true,
    activationMode: mode,
    currentVersions,
    stalenessStatus: null,
    synchronizationAllowed: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    warnings,
    requiredActions,
    configurationTypes: types,
    trigger,
    activeSyncRunId: activeSync?.id || null,
    policyVersion: 'phase8-config-sync-readiness-v1',
    evaluatedAt: new Date().toISOString(),
    actorId: actorOrServiceContext?.actorId || null,
  };
}

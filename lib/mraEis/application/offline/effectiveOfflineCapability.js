/**
 * Phase 16 — Effective Offline Capability Policy (server-authoritative, fail-closed).
 * Offline is NOT enabled merely because the network is unavailable.
 */

import {
  resolveOfflineModeContract,
  resolveOfflineSignatureContract,
  resolveOfflineNumberingContract,
  resolveOfflineReceiptContract,
  resolveOfflineUploadContract,
} from './offlineContractRegistry.js';
import { evaluateOfflineCertification } from './offlineCertificationPolicy.js';
import { OFFLINE_DEPLOYMENT_ARCHITECTURE } from '../../domain/operationalEnums.js';

export function evaluateEffectiveOfflineCapability({
  tenantId = null,
  businessId = null,
  branchId = null,
  siteId = null,
  terminalId = null,
  agentId = null,
  deviceId = null,
  environment = 'SANDBOX',
  mode = 'MOCK',
  platformOfflineAvailable = false,
  tenantOfflineEntitled = false,
  businessOfflineEnabled = false,
  certification = null,
  terminal = null,
  agent = null,
  device = null,
  configurationFresh = false,
  mappingsAvailable = false,
  offlineLimitsAvailable = false,
  sequenceAvailable = false,
  clockTrusted = false,
  storageHealthy = false,
  queueHealthy = false,
  keyAvailable = false,
  keyRevoked = false,
  browserContext = false,
  architecture = OFFLINE_DEPLOYMENT_ARCHITECTURE.BROWSER_ONLY_PROHIBITED,
  now = new Date(),
} = {}) {
  const blockers = [];
  const warnings = [];
  const requiredActions = [];
  const isMock = String(mode).toUpperCase() === 'MOCK';

  const push = (code, action = null) => {
    blockers.push(code);
    if (action) requiredActions.push(action);
  };

  const modeContract = resolveOfflineModeContract({ environment, mode });
  const sigContract = resolveOfflineSignatureContract({ environment, mode });
  const numContract = resolveOfflineNumberingContract({ environment, mode });
  const receiptContract = resolveOfflineReceiptContract({ environment, mode });
  const uploadContract = resolveOfflineUploadContract({ environment, mode });
  const certEval = evaluateOfflineCertification({ certification, environment, mode, now });

  if (!isMock && !platformOfflineAvailable) {
    push('PLATFORM_OFFLINE_DISABLED', 'Enable platform offline capability after certification.');
  }
  if (!isMock && !tenantOfflineEntitled) {
    push('TENANT_NOT_ENTITLED', 'Request offline EIS entitlement.');
  }
  if (!isMock && !businessOfflineEnabled) {
    push('BUSINESS_OFFLINE_DISABLED', 'Approve Business offline participation.');
  }
  if (!certEval.valid) {
    for (const b of certEval.blockers) push(b, 'Obtain valid MRA offline certification.');
  }
  if (!modeContract.allowsOfflineSales) {
    push('OFFLINE_MODE_CONTRACT_BLOCKED', 'Wait for verified offline mode contract.');
  }
  if (!sigContract.allowsSigning) {
    push('OFFLINE_SIGNATURE_CONTRACT_UNVERIFIED', 'Verify offline signature contract.');
  }
  if (!numContract.allowsAllocation) {
    push('OFFLINE_NUMBERING_CONTRACT_UNVERIFIED', 'Verify offline numbering contract.');
  }
  if (!receiptContract.allowsReceipt) {
    push('OFFLINE_RECEIPT_CONTRACT_UNVERIFIED', 'Verify offline receipt/QR contract.');
  }
  if (!isMock && !uploadContract.allowsUpload) {
    push('OFFLINE_UPLOAD_CONTRACT_UNVERIFIED', 'Verify offline upload contract.');
  }

  if (!isMock && (browserContext || architecture === OFFLINE_DEPLOYMENT_ARCHITECTURE.BROWSER_ONLY_PROHIBITED)) {
    push('BROWSER_ONLY_PROHIBITED', 'Deploy a certified branch/device agent.');
  } else if (isMock) {
    warnings.push('MOCK_SIMULATES_AGENT_BOUNDARY_NOT_BROWSER_AUTHORITATIVE');
  }

  if (terminal?.status === 'BLOCKED' || terminal?.blocked) {
    push('TERMINAL_BLOCKED', 'Resolve Terminal block via Phase 17 workflow.');
  } else if (!isMock && terminal && terminal.status !== 'ACTIVE') {
    push('TERMINAL_NOT_ACTIVE', 'Activate Terminal.');
  }

  if (!isMock && !agentId) {
    push('AGENT_NOT_REGISTERED', 'Register trusted agent.');
  } else if (!isMock && agent) {
    if (!['ACTIVE', 'OFFLINE_ACTIVE', 'SYNCHRONIZING'].includes(agent.lifecycleState)) {
      push('AGENT_NOT_ACTIVE', 'Activate or remediate agent.');
    }
    if (['COMPROMISED', 'REVOKED', 'LOST'].includes(agent.lifecycleState)) {
      push('DEVICE_COMPROMISED', 'Open security recovery workflow.');
    }
    if (['SECURITY_BLOCKED', 'CERTIFICATION_BLOCKED'].includes(agent.versionPolicyState)) {
      push('AGENT_VERSION_UNSUPPORTED', 'Upgrade agent to certified version.');
    }
  }

  if (!isMock && device && !['VERIFIED', 'ATTESTED'].includes(device.trustState)) {
    push('DEVICE_NOT_TRUSTED', 'Complete device trust/attestation.');
  }

  if (keyRevoked) push('OFFLINE_KEY_REVOKED', 'Rotate and re-provision signing key.');
  else if (!isMock && !keyAvailable) push('OFFLINE_KEY_MISSING', 'Provision offline signing key.');

  if (!isMock && !configurationFresh) push('CONFIGURATION_STALE', 'Synchronize configuration package.');
  if (!isMock && !mappingsAvailable) push('MAPPING_PACKAGE_INCOMPLETE', 'Sync mapping package.');
  if (!isMock && !offlineLimitsAvailable) push('OFFLINE_LIMITS_MISSING', 'Sync limit package.');
  if (!isMock && !sequenceAvailable) push('OFFLINE_SEQUENCE_UNAVAILABLE', 'Initialize offline sequence.');
  if (!isMock && !clockTrusted) push('DEVICE_CLOCK_UNTRUSTED', 'Restore trusted clock.');
  if (!isMock && !storageHealthy) push('LOCAL_STORAGE_UNHEALTHY', 'Repair agent storage.');
  if (!isMock && !queueHealthy) push('OFFLINE_QUEUE_UNHEALTHY', 'Repair queue integrity.');

  const offlineEntryAllowed = blockers.length === 0;

  return {
    tenantId,
    businessId,
    branchId,
    siteId,
    terminalId,
    agentId,
    deviceId,
    environment,
    mode,
    platformOfflineAvailable: platformOfflineAvailable || isMock,
    tenantOfflineEntitled: tenantOfflineEntitled || isMock,
    businessOfflineEnabled: businessOfflineEnabled || isMock,
    certificationValid: certEval.valid,
    certificationStatus: certEval.status,
    environmentAllowed: modeContract.allowsOfflineSales,
    terminalAllowed: !blockers.includes('TERMINAL_BLOCKED') && !blockers.includes('TERMINAL_NOT_ACTIVE'),
    terminalActive: terminal?.status === 'ACTIVE' || isMock,
    terminalBlocked: Boolean(terminal?.blocked || terminal?.status === 'BLOCKED'),
    siteAllowed: Boolean(siteId) || isMock,
    agentRegistered: Boolean(agentId) || isMock,
    agentActive: agent?.lifecycleState === 'ACTIVE' || isMock,
    agentVersionAllowed: !blockers.includes('AGENT_VERSION_UNSUPPORTED'),
    deviceRegistered: Boolean(deviceId) || isMock,
    deviceTrusted: device?.trustState === 'ATTESTED' || isMock,
    keyAvailable: keyAvailable || isMock,
    keyNotRevoked: !keyRevoked,
    configurationFresh: configurationFresh || isMock,
    mappingsAvailable: mappingsAvailable || isMock,
    offlineLimitsAvailable: offlineLimitsAvailable || isMock,
    sequenceAvailable: sequenceAvailable || isMock,
    clockTrusted: clockTrusted || isMock,
    storageHealthy: storageHealthy || isMock,
    queueHealthy: queueHealthy || isMock,
    contracts: {
      mode: modeContract.decision,
      signature: sigContract.decision,
      numbering: numContract.decision,
      receipt: receiptContract.decision,
      upload: uploadContract.decision,
    },
    architecture,
    browserAuthoritativeForbidden: true,
    navigatorOnlineInsufficient: true,
    localStorageAuthoritativeForbidden: true,
    maintenanceAutoEnableForbidden: true,
    offlineEntryAllowed,
    blockers,
    warnings: [
      ...warnings,
      ...certEval.warnings,
      ...(isMock ? ['MOCK_ONLY_NOT_PRODUCTION'] : []),
    ],
    requiredActions,
    policyVersion: 'effective-offline-capability-v1',
    evaluatedAt: now.toISOString(),
  };
}
